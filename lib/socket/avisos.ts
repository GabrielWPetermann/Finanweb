// Aviso de pagamento (aviso-pagamento-v1.xsd): o Financeiro avisa, por conta
// propria, o setor que mandou uma compra ou uma folha quando a despesa e
// paga ou cancelada aqui.
//
// A tela de Pagamentos roda na Vercel, que nao fica conectada ao servidor da
// turma: o aviso entra na fila de arquivos do chat (MensagemChat) e o ouvinte
// manda para o setor, pelo nome dele no servidor, que e a origem gravada na
// despesa. Setor desconectado perde o aviso; as consultas continuam valendo.

import type { Prisma } from "@prisma/client";
import { enfileirarArquivo } from "@/lib/socket/chat";
import { SOCKET_NOME } from "@/lib/socket/config";
import {
  REGEX_REFERENCIA_FOLHA,
  atributoDocumento,
  dataLocalIso,
  situacaoPagamento,
  textoContrato,
  valor,
} from "@/lib/socket/consultas";
import { escaparXml, formatarDataIso } from "@/lib/xml/escape";
import { validarContraXsd } from "@/lib/xml/validador";

export interface DespesaAviso {
  id: string;
  origem: string | null;
  referencia: string | null;
  status: string;
  valor: Prisma.Decimal | number;
  dataPagamento: Date;
  fornecedor: { nome: string; documento: string | null };
}

/**
 * XML do aviso, ou null quando a mudanca nao e aviso: despesa sem origem
 * (lancada aqui ou v1), status que nao baixou (continua ou voltou a
 * pendente) ou que nao mudou.
 */
export function montarAvisoPagamento(
  statusAnterior: string,
  despesa: DespesaAviso,
  hoje = new Date()
): { nomeArquivo: string; xml: string } | null {
  if (!despesa.origem || !despesa.referencia) return null;
  const situacao = situacaoPagamento(despesa.status);
  if (situacao === "PENDENTE" || situacao === situacaoPagamento(statusAnterior)) return null;

  // Salario da folha: a referencia gravada e "<folha>/<cpf>", e o RH conhece
  // a folha e o CPF separados.
  const folha = REGEX_REFERENCIA_FOLHA.exec(despesa.referencia);
  const referencia = folha ? folha[1] : despesa.referencia;
  const id = `${despesa.id}-${Date.now().toString(36)}`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<avisoPagamento xmlns="urn:finanweb:aviso-pagamento:1.0" versao="1.0" id="${id}">
  <dataAviso>${dataLocalIso(hoje)}</dataAviso>
  <origem>${escaparXml(despesa.origem)}</origem>
  <referencia>${escaparXml(referencia)}</referencia>${folha ? `\n  <cpf>${folha[2]}</cpf>` : ""}
  <situacao>${situacao}</situacao>
  <favorecido${atributoDocumento(despesa.fornecedor.documento)}>${escaparXml(textoContrato(despesa.fornecedor.nome, "(sem nome)"))}</favorecido>
  <valor>${valor(despesa.valor)}</valor>${situacao === "PAGO" ? `\n  <dataPagamento>${formatarDataIso(despesa.dataPagamento)}</dataPagamento>` : ""}
</avisoPagamento>
`;
  return { nomeArquivo: `aviso-pagamento-${id}.xml`, xml };
}

/**
 * Poe o aviso na fila do ouvinte, se a mudanca de status pedir um. Nunca
 * lanca: o pagamento ja foi gravado, e um aviso que nao sai nao pode desfazer
 * isso.
 */
export async function avisarPagamento(statusAnterior: string, despesa: DespesaAviso, autor: string): Promise<void> {
  try {
    const aviso = montarAvisoPagamento(statusAnterior, despesa);
    if (!aviso || despesa.origem?.toLowerCase() === SOCKET_NOME.toLowerCase()) return;

    // Origem ou referencia gravadas fora do contrato: melhor nao mandar do que
    // mandar um arquivo que o setor recusaria.
    const erros = await validarContraXsd(aviso.xml, "aviso-pagamento-v1.xsd");
    if (erros.length > 0) {
      console.error(`aviso fora do XSD (${aviso.nomeArquivo}): ${erros.join(" ")}`);
      return;
    }
    await enfileirarArquivo(autor, aviso.nomeArquivo, Buffer.from(aviso.xml, "utf8"), despesa.origem);
  } catch (erro) {
    console.error(erro);
  }
}
