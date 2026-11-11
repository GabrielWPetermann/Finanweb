// Registry da turma (lib/registro.ts):
//   GET     find: ?setor= &nome= &protocolo= &consumidor= &situacao=
//   POST    publish: corpo JSON do servico, com "Authorization: Bearer <chave>"
//   DELETE  remove: ?nome= &versao= &protocolo=, com a chave
// Fora do login, como o resto de /api; publicar e remover exigem a chave do
// setor, gerada por um admin em /admin/registro.

import { json, opcoes } from "@/lib/integracao/rest";
import { buscarServicos, publicarServico, removerServico, setorDaRequisicao } from "@/lib/registro";

const ERRO_BANCO = "Não foi possível acessar o registry agora. Tente de novo em alguns minutos.";
const SEM_CHAVE =
  'Envie a chave do setor no cabeçalho "Authorization: Bearer <chave>". Peça a chave ao Financeiro.';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const filtros = Object.fromEntries(url.searchParams);
  try {
    const servicos = await buscarServicos(filtros, url.origin);
    return json({ total: servicos.length, servicos });
  } catch (erro) {
    console.error(erro);
    return json({ ok: false, erro: ERRO_BANCO }, 503);
  }
}

export async function POST(request: Request): Promise<Response> {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return json({ ok: false, erro: "O corpo da requisição não é um JSON válido." }, 400);
  }

  try {
    const setor = await setorDaRequisicao(request);
    if (!setor) return json({ ok: false, erro: SEM_CHAVE }, 401);

    const resultado = await publicarServico(setor, corpo);
    if (!resultado.ok) return json({ ok: false, erros: resultado.erros }, 422);
    return json({ ok: true, servico: resultado.servico }, resultado.criado ? 201 : 200);
  } catch (erro) {
    console.error(erro);
    return json({ ok: false, erro: ERRO_BANCO }, 503);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const p = new URL(request.url).searchParams;
  const alvo = { nome: p.get("nome") ?? "", versao: p.get("versao") ?? "", protocolo: p.get("protocolo") ?? "" };
  if (!alvo.nome || !alvo.versao || !alvo.protocolo) {
    return json({ ok: false, erro: "Informe nome, versao e protocolo do serviço na URL." }, 400);
  }

  try {
    const setor = await setorDaRequisicao(request);
    if (!setor) return json({ ok: false, erro: SEM_CHAVE }, 401);
    if (!(await removerServico(setor, alvo))) {
      return json({ ok: false, erro: "Serviço não encontrado entre os publicados por este setor." }, 404);
    }
    return json({ ok: true });
  } catch (erro) {
    console.error(erro);
    return json({ ok: false, erro: ERRO_BANCO }, 503);
  }
}

export const OPTIONS = opcoes;
