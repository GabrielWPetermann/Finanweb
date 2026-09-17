// Parser do XML de Entrada. Devolve o mesmo EntradaParseResult do
// parseEntradaCsv, com as mesmas regras de negocio (CANCELADO e descartado e
// contabilizado, documento obrigatorio, erros acumulados), para que o resto do
// sistema nao precise saber de que formato o arquivo veio.
//
// A validacao estrutural e de tipos fica no XSD (lib/xml/schemas), conferida
// antes deste parse. Aqui sobram as checagens que o XSD 1.0 nao expressa.

import { XMLParser } from "fast-xml-parser";
import { dataIsoParaTexto } from "@/lib/xml/escape";
import type {
  EntradaCabecalho,
  EntradaParseResult,
  EntradaPedido,
  EntradaTotalizador,
} from "@/lib/parsers/entrada";

const PREFIXO_ATRIBUTO = "@";

// Duas opcoes aqui nao sao preferencia, sao obrigatorias:
// - parseTagValue/parseAttributeValue false: sem isso o CPF "00011122233" vira
//   numero e perde os zeros a esquerda, o que quebra a busca do parceiro;
// - isArray para "pedido": sem isso um arquivo de um pedido so devolve objeto
//   em vez de array, e o for deixa de funcionar.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: PREFIXO_ATRIBUTO,
  parseTagValue: false,
  parseAttributeValue: false,
  ignoreDeclaration: true,
  isArray: (nome) => nome === "pedido",
});

type No = Record<string, unknown>;

const REGEX_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function texto(no: unknown): string {
  if (no === undefined || no === null) return "";
  if (typeof no === "object") return String((no as No)["#text"] ?? "");
  return String(no);
}

function atributo(no: unknown, nome: string): string {
  if (no === null || typeof no !== "object") return "";
  return String((no as No)[PREFIXO_ATRIBUTO + nome] ?? "");
}

export function parseEntradaXml(conteudo: string): EntradaParseResult {
  let cabecalho: EntradaCabecalho | null = null;
  let totalizador: EntradaTotalizador | null = null;
  const pedidos: EntradaPedido[] = [];
  const erros: string[] = [];
  let ignorados = 0;

  let documento: No;
  try {
    documento = parser.parse(conteudo) as No;
  } catch {
    return { cabecalho, pedidos, totalizador, ignorados, erros: ["Arquivo XML mal formado."] };
  }

  const movimento = documento.movimento as No | undefined;
  if (!movimento) {
    erros.push("Elemento raiz <movimento> não encontrado.");
    return { cabecalho, pedidos, totalizador, ignorados, erros };
  }

  const cab = movimento.cabecalho as No | undefined;
  if (!cab) {
    erros.push("Cabeçalho (<cabecalho>) ausente.");
  } else {
    const dataArquivo = texto(cab.dataArquivo);
    if (!REGEX_DATA_ISO.test(dataArquivo)) {
      erros.push("Cabeçalho: dataArquivo inválida, esperado AAAA-MM-DD (ex: 2026-08-13).");
    } else {
      cabecalho = {
        nomeEmpresa: texto(cab.empresa),
        cnpj: texto(cab.cnpj),
        tipoDocumento: texto(cab.tipoDocumento),
        dataArquivo: dataIsoParaTexto(dataArquivo),
        usuario: texto(cab.usuario),
      };
    }
  }

  const lista = ((movimento.pedidos as No | undefined)?.pedido ?? []) as No[];
  lista.forEach((pedido, indice) => {
    const numero = indice + 1;

    const status = atributo(pedido, "status").trim();
    if (status.toUpperCase() === "CANCELADO") {
      ignorados++;
      return;
    }

    const documentoCliente = atributo(pedido.cliente, "documento").trim();
    if (!documentoCliente) {
      erros.push(`Pedido ${numero}: atributo documento (CNPJ/CPF do cliente) é obrigatório.`);
      return;
    }

    const subtotal = Number(texto(pedido.subtotal));
    const descontoPercentual = Number(atributo(pedido.desconto, "percentual"));
    const descontoValor = Number(texto(pedido.desconto));
    const frete = Number(texto(pedido.frete));
    const valorTotal = Number(texto(pedido.valorTotal));

    if ([subtotal, descontoPercentual, descontoValor, frete, valorTotal].some(Number.isNaN)) {
      erros.push(`Pedido ${numero}: valores numéricos inválidos (subtotal/desconto/frete/valorTotal).`);
      return;
    }

    const dataPedido = texto(pedido.dataPedido);
    if (!REGEX_DATA_ISO.test(dataPedido)) {
      erros.push(`Pedido ${numero}: dataPedido inválida, esperado AAAA-MM-DD (ex: 2026-08-13).`);
      return;
    }

    pedidos.push({
      cliente: texto(pedido.cliente),
      documento: documentoCliente,
      categoria: texto(pedido.categoria),
      subtotal,
      descontoPercentual,
      descontoValor,
      frete,
      valorTotal,
      formaPagamento: texto(pedido.formaPagamento),
      dataPedido: dataIsoParaTexto(dataPedido),
      status,
    });
  });

  const tot = movimento.totalizador as No | undefined;
  if (!tot) {
    erros.push("Totalizador (<totalizador>) ausente.");
  } else {
    const qtdRegistros = Number(texto(tot.qtdRegistros));
    const valorTotalGeral = Number(texto(tot.valorTotalGeral));
    if (Number.isNaN(qtdRegistros) || Number.isNaN(valorTotalGeral)) {
      erros.push("Totalizador com valores numéricos inválidos.");
    } else {
      totalizador = { qtdRegistros, valorTotalGeral };
    }
  }

  return { cabecalho, pedidos, totalizador, ignorados, erros };
}
