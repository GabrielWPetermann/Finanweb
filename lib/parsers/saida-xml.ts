// Parser do XML de Saida. Mesma abordagem do entrada-xml.ts: devolve o mesmo
// SaidaParseResult do parseSaidaCsv, para o resto do sistema nao precisar
// saber de que formato o arquivo veio.

import { XMLParser } from "fast-xml-parser";
import { dataIsoParaTexto } from "@/lib/xml/escape";
import type {
  SaidaCabecalho,
  SaidaDespesa,
  SaidaParseResult,
  SaidaTotalizador,
} from "@/lib/parsers/saida";

const PREFIXO_ATRIBUTO = "@";

// Ver entrada-xml.ts: parseTagValue false preserva zeros a esquerda no
// documento, isArray garante array mesmo com uma despesa so.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: PREFIXO_ATRIBUTO,
  parseTagValue: false,
  parseAttributeValue: false,
  ignoreDeclaration: true,
  isArray: (nome) => nome === "despesa",
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

export function parseSaidaXml(conteudo: string): SaidaParseResult {
  let cabecalho: SaidaCabecalho | null = null;
  let totalizador: SaidaTotalizador | null = null;
  const despesas: SaidaDespesa[] = [];
  const erros: string[] = [];
  let ignorados = 0;

  let documento: No;
  try {
    documento = parser.parse(conteudo) as No;
  } catch {
    return { cabecalho, despesas, totalizador, ignorados, erros: ["Arquivo XML mal formado."] };
  }

  const movimento = documento.movimento as No | undefined;
  if (!movimento) {
    erros.push("Elemento raiz <movimento> não encontrado.");
    return { cabecalho, despesas, totalizador, ignorados, erros };
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

  const lista = ((movimento.despesas as No | undefined)?.despesa ?? []) as No[];
  lista.forEach((despesa, indice) => {
    const numero = indice + 1;

    const status = atributo(despesa, "status").trim();
    if (status.toUpperCase() === "CANCELADO") {
      ignorados++;
      return;
    }

    const documentoFornecedor = atributo(despesa.fornecedor, "documento").trim();
    if (!documentoFornecedor) {
      erros.push(`Despesa ${numero}: atributo documento (CNPJ/CPF do fornecedor) é obrigatório.`);
      return;
    }

    const valor = Number(texto(despesa.valor));
    if (Number.isNaN(valor)) {
      erros.push(`Despesa ${numero}: valor inválido.`);
      return;
    }

    const dataPagamento = texto(despesa.dataPagamento);
    if (!REGEX_DATA_ISO.test(dataPagamento)) {
      erros.push(`Despesa ${numero}: dataPagamento inválida, esperado AAAA-MM-DD (ex: 2026-08-13).`);
      return;
    }

    despesas.push({
      fornecedor: texto(despesa.fornecedor),
      documento: documentoFornecedor,
      categoria: texto(despesa.categoria),
      valor,
      formaPagamento: texto(despesa.formaPagamento),
      dataPagamento: dataIsoParaTexto(dataPagamento),
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

  return { cabecalho, despesas, totalizador, ignorados, erros };
}
