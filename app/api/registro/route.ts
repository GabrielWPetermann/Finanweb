// Registry da turma (lib/registro.ts):
//   GET     find: ?setor= &nome= &protocolo= &consumidor= &situacao=
//   POST    publish: corpo JSON do servico, com "Authorization: Bearer <chave>"
//   DELETE  remove: ?nome= &versao= &protocolo=, com a chave
// Fora do login, como o resto de /api; publicar e remover exigem a chave do
// setor, gerada por um admin em /admin/registro.

import { autorizarSetor, limitarPorIp } from "@/lib/integracao/acesso";
import { json, opcoes } from "@/lib/integracao/rest";
import { buscarServicos, publicarServico, removerServico } from "@/lib/registro";

const ERRO_BANCO = "Não foi possível acessar o registry agora. Tente de novo em alguns minutos.";

// A busca e publica (descoberta nao pede chave), com limite por IP.
export async function GET(request: Request): Promise<Response> {
  const limite = await limitarPorIp(request);
  if (!limite.ok) return json({ ok: false, erro: limite.erro }, 429, limite.cabecalhos);

  const url = new URL(request.url);
  const filtros = Object.fromEntries(url.searchParams);
  try {
    const servicos = await buscarServicos(filtros, url.origin);
    return json({ total: servicos.length, servicos }, 200, limite.cabecalhos);
  } catch (erro) {
    console.error(erro);
    return json({ ok: false, erro: ERRO_BANCO }, 503, limite.cabecalhos);
  }
}

export async function POST(request: Request): Promise<Response> {
  const acesso = await autorizarSetor(request);
  if (!acesso.ok) return json({ ok: false, erro: acesso.erro }, acesso.status, acesso.cabecalhos);
  const { setor, cabecalhos } = acesso;

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return json({ ok: false, erro: "O corpo da requisição não é um JSON válido." }, 400, cabecalhos);
  }

  try {
    const resultado = await publicarServico(setor, corpo);
    if (!resultado.ok) return json({ ok: false, erros: resultado.erros }, 422, cabecalhos);
    return json({ ok: true, servico: resultado.servico }, resultado.criado ? 201 : 200, cabecalhos);
  } catch (erro) {
    console.error(erro);
    return json({ ok: false, erro: ERRO_BANCO }, 503, cabecalhos);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const p = new URL(request.url).searchParams;
  const alvo = { nome: p.get("nome") ?? "", versao: p.get("versao") ?? "", protocolo: p.get("protocolo") ?? "" };
  const acesso = await autorizarSetor(request);
  if (!acesso.ok) return json({ ok: false, erro: acesso.erro }, acesso.status, acesso.cabecalhos);
  const { setor, cabecalhos } = acesso;
  if (!alvo.nome || !alvo.versao || !alvo.protocolo) {
    return json({ ok: false, erro: "Informe nome, versao e protocolo do serviço na URL." }, 400, cabecalhos);
  }

  try {
    if (!(await removerServico(setor, alvo))) {
      return json({ ok: false, erro: "Serviço não encontrado entre os publicados por este setor." }, 404, cabecalhos);
    }
    return json({ ok: true }, 200, cabecalhos);
  } catch (erro) {
    console.error(erro);
    return json({ ok: false, erro: ERRO_BANCO }, 503, cabecalhos);
  }
}

export const OPTIONS = opcoes;
