// Partes comuns aos parsers dos envios dos outros setores (entrada-v2,
// saida-v2 e folha-v1): o mesmo cabecalho com a origem e as mesmas opcoes de
// parse.
//
// Como nos parsers da v1, estrutura e tipos ja foram conferidos no XSD antes
// do parse. Aqui ficam as regras entre campos, que o XSD 1.0 nao expressa.

import { XMLParser } from "fast-xml-parser";

export const PREFIXO_ATRIBUTO = "@";

export type No = Record<string, unknown>;

export interface EnvioCabecalho {
  nomeEmpresa: string;
  cnpj: string;
  // Nome do setor no servidor da turma ("vendas"). Com a referencia de cada
  // registro, identifica o lancamento.
  origem: string;
  dataArquivo: string; // AAAA-MM-DD
  usuario: string;
}

// Ver entrada-xml.ts: parseTagValue false preserva os zeros a esquerda do
// documento, e isArray garante array mesmo com um registro so.
export function criarParser(elementoRepetido: string): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: PREFIXO_ATRIBUTO,
    parseTagValue: false,
    parseAttributeValue: false,
    ignoreDeclaration: true,
    isArray: (nome) => nome === elementoRepetido,
  });
}

export function texto(no: unknown): string {
  if (no === undefined || no === null) return "";
  if (typeof no === "object") return String((no as No)["#text"] ?? "").trim();
  return String(no).trim();
}

export function atributo(no: unknown, nome: string): string {
  if (no === null || typeof no !== "object") return "";
  return String((no as No)[PREFIXO_ATRIBUTO + nome] ?? "").trim();
}

/** Valor monetario em centavos inteiros: somar decimais em ponto flutuante erra no centavo. */
export function centavos(valor: string): number {
  return Math.round(Number(valor) * 100);
}

export function lerCabecalho(cab: unknown): EnvioCabecalho | null {
  if (!cab || typeof cab !== "object") return null;
  const no = cab as No;
  return {
    nomeEmpresa: texto(no.empresa),
    cnpj: texto(no.cnpj),
    origem: texto(no.origem),
    dataArquivo: texto(no.dataArquivo),
    usuario: texto(no.usuario),
  };
}
