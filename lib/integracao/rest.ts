// Partes comuns das rotas da API REST (app/api/v1). Cada rota so diz qual
// contrato usa; o envio e a consulta passam pelo mesmo codigo do socket
// (receberMovimento, responderConsulta), com o JSON traduzido para o XML do
// contrato em lib/integracao/json.ts.
//
// Fica fora do login (o matcher do middleware nao pega /api): os outros setores
// nao tem conta no Finanweb. Quem chama se identifica pela chave do setor
// (lib/integracao/acesso.ts), que tambem conta o rate limit.

import { autorizarSetor, origemDeOutroSetor } from "@/lib/integracao/acesso";
import { carimbo, receberMovimento } from "@/lib/integracao/envios";
import { erroParaJson, type Parametros, type RespostaJson } from "@/lib/integracao/json";
import { responderConsulta } from "@/lib/socket/consultas";

// Os sistemas dos outros grupos podem rodar no navegador (o de Compras roda):
// sem CORS, o navegador bloqueia a chamada. SOAPAction e o cabecalho que os
// clientes SOAP mandam; Authorization (ou X-API-Key) leva a chave do setor.
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, SOAPAction, Authorization, X-API-Key",
};

export function json(corpo: unknown, status = 200, cabecalhos: Record<string, string> = {}): Response {
  return Response.json(corpo, { status, headers: { ...CORS, ...cabecalhos } });
}

export function opcoes(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * POST de um envio (venda, compra, folha): JSON -> XML do contrato -> mesma
 * caixa de entrada do socket. 202 porque o lancamento so acontece quando
 * alguem do Financeiro aprova.
 */
export async function receberEnvioJson(
  request: Request,
  nome: "venda" | "compra" | "folha",
  paraXml: (corpo: unknown) => string
): Promise<Response> {
  const acesso = await autorizarSetor(request);
  if (!acesso.ok) return json({ ok: false, erro: acesso.erro }, acesso.status, acesso.cabecalhos);
  const { setor, cabecalhos } = acesso;

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return json({ ok: false, erro: "O corpo da requisição não é um JSON válido." }, 400, cabecalhos);
  }
  if (corpo === null || typeof corpo !== "object" || Array.isArray(corpo)) {
    return json({ ok: false, erro: "O corpo da requisição tem que ser um objeto JSON." }, 400, cabecalhos);
  }

  // Origem ausente fica para o XSD apontar; origem de outro setor, nao.
  const cabecalho = (corpo as { cabecalho?: { origem?: unknown } }).cabecalho;
  const origem = typeof cabecalho?.origem === "string" ? cabecalho.origem : "";
  const outroSetor = origemDeOutroSetor(origem, setor);
  if (outroSetor) return json({ ok: false, erro: outroSetor }, 403, cabecalhos);

  const recebido = await receberMovimento(paraXml(corpo), {
    remetente: `${setor} (REST)`,
    nomeArquivo: `${nome}-${setor}-${carimbo()}.xml`,
  });
  if (!recebido.ok) {
    return json({ ok: false, erro: erroParaJson(recebido.erro) }, recebido.motivo === "FALHA" ? 503 : 422, cabecalhos);
  }
  return json(
    {
      ok: true,
      situacao: "AGUARDANDO_APROVACAO",
      tipo: recebido.tipo,
      mensagem: "Recebido. O lançamento acontece quando o Financeiro aprovar a importação.",
    },
    202,
    cabecalhos
  );
}

/**
 * GET de uma consulta: parametros da URL -> XML da consulta -> mesma resposta
 * do socket, devolvida em JSON. Sem `id` na URL, um e gerado; sem `origem`,
 * vale o setor da chave.
 */
export async function consultarJson(
  request: Request,
  montarXml: (p: Parametros, id: string) => string,
  paraJson: (xml: string) => RespostaJson
): Promise<Response> {
  const acesso = await autorizarSetor(request);
  if (!acesso.ok) return json({ ok: false, erro: acesso.erro }, acesso.status, acesso.cabecalhos);
  const { setor, cabecalhos } = acesso;

  const parametros = Object.fromEntries(new URL(request.url).searchParams) as Parametros;
  const outroSetor = origemDeOutroSetor(parametros.origem ?? "", setor);
  if (outroSetor) return json({ ok: false, erro: outroSetor }, 403, cabecalhos);
  parametros.origem = setor;
  const id = parametros.id || `rest-${Date.now().toString(36)}`;

  const resposta = await responderConsulta(montarXml(parametros, id));
  if (!resposta.ok) return json({ ok: false, erro: erroParaJson(resposta.erro) }, 400, cabecalhos);

  // <erro> na resposta (banco fora do ar, dado fora do contrato) segue o
  // contrato, mas nao e um resultado: 503 para quem olha so o status.
  const corpo = paraJson(resposta.xml);
  return json(corpo, corpo.erro === undefined ? 200 : 503, cabecalhos);
}
