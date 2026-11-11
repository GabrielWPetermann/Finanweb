// GET [?origem=][&desde=] -- avisos de pagamento (aviso-pagamento-v1.xsd) ja
// gerados para um setor, em JSON. Pelo socket o aviso chega sozinho; pela API
// quem nao fica conectado busca aqui, passando em `desde` o geradoEm do
// ultimo que ja leu. Exige a chave, e cada setor so ve os proprios avisos.

import { autorizarSetor, origemDeOutroSetor } from "@/lib/integracao/acesso";
import { avisoPagamentoJson } from "@/lib/integracao/json";
import { json, opcoes } from "@/lib/integracao/rest";
import { listarAvisosPagamento } from "@/lib/socket/avisos";

export async function GET(request: Request): Promise<Response> {
  const acesso = await autorizarSetor(request);
  if (!acesso.ok) return json({ ok: false, erro: acesso.erro }, acesso.status, acesso.cabecalhos);
  const { setor, cabecalhos } = acesso;

  const parametros = new URL(request.url).searchParams;
  const outroSetor = origemDeOutroSetor(parametros.get("origem") ?? "", setor);
  if (outroSetor) return json({ ok: false, erro: outroSetor }, 403, cabecalhos);

  const desdeTexto = parametros.get("desde");
  const desde = desdeTexto ? new Date(desdeTexto) : undefined;
  if (desde && Number.isNaN(desde.getTime())) {
    return json({ ok: false, erro: "desde tem que ser uma data e hora ISO (ex.: 2026-11-01T00:00:00Z)." }, 400, cabecalhos);
  }

  try {
    const avisos = await listarAvisosPagamento(setor, desde);
    return json(
      {
        origem: setor,
        avisos: avisos.map((a) => ({ ...avisoPagamentoJson(a.xml), geradoEm: a.geradoEm.toISOString() })),
      },
      200,
      cabecalhos
    );
  } catch (erro) {
    console.error(erro);
    return json({ ok: false, erro: "Não foi possível consultar o Financeiro agora. Tente de novo em alguns minutos." }, 503, cabecalhos);
  }
}

export const OPTIONS = opcoes;
