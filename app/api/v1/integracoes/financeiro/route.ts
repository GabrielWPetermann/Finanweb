// Porta do Financeiro no formato da API de interoperabilidade de Vendas: o
// POST /api/v1/integracoes/enviar deles entrega aqui { "documento": {...} },
// com a chave em X-API-Key. O documento e o XML de um contrato do Financeiro
// escrito em JSON (lib/integracao/documento.ts): ele volta para XML e segue o
// mesmo caminho do socket, do REST e do SOAP. A resposta tambem vai no
// formato deles (sucesso, codigo, mensagem, dados, erro, requisicao_id,
// timestamp), com a resposta das consultas em dados.documento.

import { randomUUID } from "node:crypto";
import { autorizarSetor, origemDeOutroSetor } from "@/lib/integracao/acesso";
import { documentoParaXml, xmlParaDocumento } from "@/lib/integracao/documento";
import { carimbo, receberMovimento } from "@/lib/integracao/envios";
import { erroParaJson } from "@/lib/integracao/json";
import { json, opcoes } from "@/lib/integracao/rest";
import { ehConsulta, responderConsulta } from "@/lib/socket/consultas";

const CODIGO_DO_ACESSO: Record<number, string> = {
  401: "NAO_AUTENTICADO",
  429: "LIMITE_EXCEDIDO",
  503: "FINANCEIRO_INDISPONIVEL",
};

function resposta(
  status: number,
  codigo: string,
  mensagem: string,
  { dados = null, erro = null, cabecalhos = {} }: { dados?: unknown; erro?: string | null; cabecalhos?: Record<string, string> } = {}
): Response {
  return json(
    {
      sucesso: status < 400,
      codigo,
      mensagem,
      dados,
      erro,
      requisicao_id: randomUUID().replace(/-/g, ""),
      timestamp: new Date().toISOString(),
    },
    status,
    cabecalhos
  );
}

export async function POST(request: Request): Promise<Response> {
  const acesso = await autorizarSetor(request);
  if (!acesso.ok) {
    return resposta(acesso.status, CODIGO_DO_ACESSO[acesso.status] ?? "ERRO", "Requisição não autorizada.", {
      erro: acesso.erro,
      cabecalhos: acesso.cabecalhos,
    });
  }
  const { setor, cabecalhos } = acesso;
  const falha = (status: number, codigo: string, erro: string) =>
    resposta(status, codigo, "Documento não processado.", { erro, cabecalhos });

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return falha(400, "FORMATO_INVALIDO", "O corpo da requisição não é um JSON válido.");
  }
  const documento = (corpo as { documento?: unknown } | null)?.documento;
  if (documento === undefined) return falha(400, "FORMATO_INVALIDO", 'Envie o objeto JSON com o campo "documento".');

  let xml: string;
  try {
    xml = documentoParaXml(documento);
  } catch (erro) {
    return falha(400, "DOCUMENTO_INVALIDO", (erro as Error).message);
  }

  // Cada setor fala so em nome dele, como no resto da API.
  const origem = /<origem>\s*([^<\s]+)\s*<\/origem>/.exec(xml)?.[1] ?? "";
  const outroSetor = origemDeOutroSetor(origem, setor);
  if (outroSetor) return falha(403, "ORIGEM_NAO_PERMITIDA", outroSetor);

  if (ehConsulta(xml)) {
    const respostaConsulta = await responderConsulta(xml);
    if (!respostaConsulta.ok) return falha(422, "DOCUMENTO_FORA_DO_CONTRATO", erroParaJson(respostaConsulta.erro));

    // <erro> na resposta segue o contrato, mas nao e um resultado.
    const comErro = /<erro>/.test(respostaConsulta.xml);
    return resposta(
      comErro ? 503 : 200,
      comErro ? "FINANCEIRO_INDISPONIVEL" : "CONSULTA_RESPONDIDA",
      comErro ? "O Financeiro não conseguiu responder agora." : "Consulta respondida.",
      { dados: { documento: xmlParaDocumento(respostaConsulta.xml) }, cabecalhos }
    );
  }

  const recebido = await receberMovimento(xml, {
    remetente: `${setor} (integracoes)`,
    nomeArquivo: `documento-${setor}-${carimbo()}.xml`,
  });
  if (!recebido.ok) {
    return recebido.motivo === "FALHA"
      ? falha(503, "FINANCEIRO_INDISPONIVEL", recebido.erro)
      : falha(422, recebido.motivo === "NAO_E_MOVIMENTO" ? "DOCUMENTO_NAO_SUPORTADO" : "DOCUMENTO_FORA_DO_CONTRATO", erroParaJson(recebido.erro));
  }
  return resposta(202, "DOCUMENTO_RECEBIDO", "Recebido. O lançamento acontece quando o Financeiro aprovar a importação.", {
    dados: { tipo: recebido.tipo, situacao: "AGUARDANDO_APROVACAO" },
    cabecalhos,
  });
}

export const OPTIONS = opcoes;
