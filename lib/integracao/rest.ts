// Partes comuns das rotas da API REST (app/api/v1). Cada rota so diz qual
// contrato usa; o envio e a consulta passam pelo mesmo codigo do socket
// (receberMovimento, responderConsulta), com o JSON traduzido para o XML do
// contrato em lib/integracao/json.ts.
//
// Fica fora do login (o matcher do middleware nao pega /api), como /contratos:
// os outros setores nao tem conta no Finanweb.

import { carimbo, receberMovimento } from "@/lib/integracao/envios";
import { erroParaJson, type Parametros, type RespostaJson } from "@/lib/integracao/json";
import { responderConsulta } from "@/lib/socket/consultas";

// Os sistemas dos outros grupos podem rodar no navegador (o de Compras roda):
// sem CORS, o navegador bloqueia a chamada. SOAPAction e o cabecalho que os
// clientes SOAP mandam.
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, SOAPAction",
};

export function json(corpo: unknown, status = 200): Response {
  return Response.json(corpo, { status, headers: CORS });
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
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return json({ ok: false, erro: "O corpo da requisição não é um JSON válido." }, 400);
  }
  if (corpo === null || typeof corpo !== "object" || Array.isArray(corpo)) {
    return json({ ok: false, erro: "O corpo da requisição tem que ser um objeto JSON." }, 400);
  }

  const cabecalho = (corpo as { cabecalho?: { origem?: unknown } }).cabecalho;
  const origem = typeof cabecalho?.origem === "string" && cabecalho.origem ? cabecalho.origem : "?";
  const recebido = await receberMovimento(paraXml(corpo), {
    remetente: `${origem} (REST)`,
    nomeArquivo: `${nome}-${origem}-${carimbo()}.xml`,
  });
  if (!recebido.ok) {
    return json({ ok: false, erro: erroParaJson(recebido.erro) }, recebido.motivo === "FALHA" ? 503 : 422);
  }
  return json(
    {
      ok: true,
      situacao: "AGUARDANDO_APROVACAO",
      tipo: recebido.tipo,
      mensagem: "Recebido. O lançamento acontece quando o Financeiro aprovar a importação.",
    },
    202
  );
}

/**
 * GET de uma consulta: parametros da URL -> XML da consulta -> mesma resposta
 * do socket, devolvida em JSON. Sem `id` na URL, um e gerado.
 */
export async function consultarJson(
  request: Request,
  montarXml: (p: Parametros, id: string) => string,
  paraJson: (xml: string) => RespostaJson
): Promise<Response> {
  const parametros = Object.fromEntries(new URL(request.url).searchParams) as Parametros;
  const id = parametros.id || `rest-${Date.now().toString(36)}`;

  const resposta = await responderConsulta(montarXml(parametros, id));
  if (!resposta.ok) return json({ ok: false, erro: erroParaJson(resposta.erro) }, 400);

  // <erro> na resposta (banco fora do ar, dado fora do contrato) segue o
  // contrato, mas nao e um resultado: 503 para quem olha so o status.
  const corpo = paraJson(resposta.xml);
  return json(corpo, corpo.erro === undefined ? 200 : 503);
}
