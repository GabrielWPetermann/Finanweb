// Avisos que o Financeiro manda por conta propria ao setor de origem de um
// lancamento quando ele e baixado aqui:
//   aviso de pagamento (aviso-pagamento-v1.xsd)     compra ou salario pago ou
//                                                    cancelado (Compras, RH)
//   aviso de recebimento (aviso-recebimento-v1.xsd) venda recebida ou
//                                                    cancelada (Vendas)
//
// A tela de Pagamentos roda na Vercel, que nao fica conectada ao servidor da
// turma: o aviso entra na fila de arquivos do chat (MensagemChat) e o ouvinte
// manda para o setor, pelo nome dele no servidor, que e a origem gravada na
// despesa. Pelo socket, setor desconectado perde o aviso; quem integra por
// REST ou SOAP busca os avisos gerados (listarAvisos). Quando o Finanweb
// sabe onde o setor recebe, entrega tambem pela API dele (lib/integracao/entrega.ts).

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { entregarAoSetor } from "@/lib/integracao/entrega";
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
import { validarContraXsd, type SchemaXml } from "@/lib/xml/validador";

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

export interface PedidoAviso {
  id: string;
  origem: string | null;
  referencia: string | null;
  status: string;
  valorTotal: Prisma.Decimal | number;
  cliente: { nome: string; documento: string | null };
}

/**
 * XML do aviso de recebimento, ou null quando a mudanca nao e aviso (mesmas
 * regras do aviso de pagamento). A data do recebimento e o dia da baixa: o
 * pedido nao tem campo proprio para ela.
 */
export function montarAvisoRecebimento(
  statusAnterior: string,
  pedido: PedidoAviso,
  hoje = new Date()
): { nomeArquivo: string; xml: string } | null {
  if (!pedido.origem || !pedido.referencia) return null;
  const situacao = situacaoPagamento(pedido.status);
  if (situacao === "PENDENTE" || situacao === situacaoPagamento(statusAnterior)) return null;

  const id = `${pedido.id}-${Date.now().toString(36)}`;
  const data = dataLocalIso(hoje);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<avisoRecebimento xmlns="urn:finanweb:aviso-recebimento:1.0" versao="1.0" id="${id}">
  <dataAviso>${data}</dataAviso>
  <origem>${escaparXml(pedido.origem)}</origem>
  <referencia>${escaparXml(pedido.referencia)}</referencia>
  <situacao>${situacao === "PAGO" ? "RECEBIDO" : "CANCELADO"}</situacao>
  <cliente${atributoDocumento(pedido.cliente.documento)}>${escaparXml(textoContrato(pedido.cliente.nome, "(sem nome)"))}</cliente>
  <valor>${valor(pedido.valorTotal)}</valor>${situacao === "PAGO" ? `\n  <dataRecebimento>${data}</dataRecebimento>` : ""}
</avisoRecebimento>
`;
  return { nomeArquivo: `aviso-recebimento-${id}.xml`, xml };
}

/**
 * Poe o aviso na fila do ouvinte e, se o Finanweb sabe onde o setor recebe
 * (registry ou endereco conhecido) e tem a chave dele, entrega tambem por
 * HTTP. O setor recebe pelos caminhos com o mesmo id e trata o repetido.
 * Nunca lanca: o lancamento ja foi gravado, e um aviso que nao sai nao pode
 * desfazer isso.
 */
async function enviarAviso(
  aviso: { nomeArquivo: string; xml: string } | null,
  { origem, autor, schema, servico }: { origem: string | null; autor: string; schema: SchemaXml; servico: string }
): Promise<void> {
  try {
    if (!aviso || !origem || origem.toLowerCase() === SOCKET_NOME.toLowerCase()) return;

    // Origem ou referencia gravadas fora do contrato: melhor nao mandar do que
    // mandar um arquivo que o setor recusaria.
    const erros = await validarContraXsd(aviso.xml, schema);
    if (erros.length > 0) {
      console.error(`aviso fora do XSD (${aviso.nomeArquivo}): ${erros.join(" ")}`);
      return;
    }
    await enfileirarArquivo(autor, aviso.nomeArquivo, Buffer.from(aviso.xml, "utf8"), origem);

    const entrega = await entregarAoSetor(origem, servico, aviso.xml);
    console.log(
      entrega.entregue
        ? `aviso ${aviso.nomeArquivo} entregue a ${origem} por HTTP (${entrega.status})`
        : `aviso ${aviso.nomeArquivo} sem entrega por HTTP: ${entrega.motivo}`
    );
  } catch (erro) {
    console.error(erro);
  }
}

export function avisarPagamento(statusAnterior: string, despesa: DespesaAviso, autor: string): Promise<void> {
  return enviarAviso(montarAvisoPagamento(statusAnterior, despesa), {
    origem: despesa.origem,
    autor,
    schema: "aviso-pagamento-v1.xsd",
    servico: "aviso de pagamento",
  });
}

export function avisarRecebimento(statusAnterior: string, pedido: PedidoAviso, autor: string): Promise<void> {
  return enviarAviso(montarAvisoRecebimento(statusAnterior, pedido), {
    origem: pedido.origem,
    autor,
    schema: "aviso-recebimento-v1.xsd",
    servico: "aviso de recebimento",
  });
}

// Uma consulta nao pode trazer o historico inteiro de uma vez.
const MAX_AVISOS = 200;

/**
 * Avisos ja gerados para um setor, do mais antigo para o mais novo, depois de
 * `desde` (exclusivo). Sao os arquivos que ficaram na fila do chat, tenham
 * chegado pelo socket ou nao. geradoEm do ultimo serve de `desde` na proxima.
 */
export async function listarAvisos(
  tipo: "pagamento" | "recebimento",
  origem: string,
  desde?: Date
): Promise<{ xml: string; geradoEm: Date }[]> {
  const mensagens = await prisma.mensagemChat.findMany({
    where: {
      direcao: "ENVIADA",
      destino: origem,
      arquivoNome: { startsWith: `aviso-${tipo}-` },
      ...(desde ? { criadoEm: { gt: desde } } : {}),
    },
    orderBy: { criadoEm: "asc" },
    take: MAX_AVISOS,
    select: { arquivo: true, criadoEm: true },
  });
  return mensagens.flatMap((m) =>
    m.arquivo ? [{ xml: Buffer.from(m.arquivo).toString("utf8"), geradoEm: m.criadoEm }] : []
  );
}
