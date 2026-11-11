// GET ?origem=[&desde=] -- avisos de pagamento (aviso-pagamento-v1.xsd) ja
// gerados para um setor, em JSON. Pelo socket o aviso chega sozinho; pela API
// quem nao fica conectado busca aqui, passando em `desde` o geradoEm do
// ultimo que ja leu.

import { avisoPagamentoJson } from "@/lib/integracao/json";
import { json, opcoes } from "@/lib/integracao/rest";
import { listarAvisosPagamento } from "@/lib/socket/avisos";

// Mesmo padrao da origem nos XSDs: nome do setor no servidor da turma.
const REGEX_ORIGEM = /^[a-z][a-z0-9-]{1,29}$/;

export async function GET(request: Request): Promise<Response> {
  const parametros = new URL(request.url).searchParams;
  const origem = parametros.get("origem") ?? "";
  const desdeTexto = parametros.get("desde");

  if (!REGEX_ORIGEM.test(origem)) {
    return json({ ok: false, erro: "Informe a origem: o nome do setor no servidor da turma (ex.: compras, rh)." }, 400);
  }
  const desde = desdeTexto ? new Date(desdeTexto) : undefined;
  if (desde && Number.isNaN(desde.getTime())) {
    return json({ ok: false, erro: "desde tem que ser uma data e hora ISO (ex.: 2026-11-01T00:00:00Z)." }, 400);
  }

  try {
    const avisos = await listarAvisosPagamento(origem, desde);
    return json({
      origem,
      avisos: avisos.map((a) => ({ ...avisoPagamentoJson(a.xml), geradoEm: a.geradoEm.toISOString() })),
    });
  } catch (erro) {
    console.error(erro);
    return json({ ok: false, erro: "Não foi possível consultar o Financeiro agora. Tente de novo em alguns minutos." }, 503);
  }
}

export const OPTIONS = opcoes;
