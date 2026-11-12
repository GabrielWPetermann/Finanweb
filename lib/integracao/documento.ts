// Formato "documento" da API de interoperabilidade usada pelo setor de Vendas
// (api-interoperabilidade-production.up.railway.app): o XML de um contrato
// escrito em JSON.
//
//   { "raiz": "consultaInadimplencia",
//     "namespace": "urn:finanweb:inadimplencia:1.0",
//     "atributos": { "versao": "1.0", "id": "vendas-001" },
//     "dados": { "origem": "vendas", "documento": "12345678909" } }
//
// Elemento com atributo vira { "@atributos": {...}, "#texto": "..." };
// elemento repetido vira array. Como o conteudo e o mesmo XML do contrato, a
// conversao e mecanica nos dois sentidos, e o XSD continua valendo.

import { XMLParser } from "fast-xml-parser";
import { escaparXml } from "@/lib/xml/escape";

type No = Record<string, unknown>;

export interface Documento {
  raiz: string;
  namespace: string | null;
  atributos: Record<string, string>;
  dados: No;
}

const ATRIBUTOS = "@atributos";
const TEXTO = "#texto";

// Nome de elemento ou atributo que vai direto para o XML: nada fora disso,
// para um JSON nao conseguir injetar marcacao.
const REGEX_NOME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

function objeto(valor: unknown): No | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor) ? (valor as No) : null;
}

function atributosXml(valor: unknown): string {
  const atributos = objeto(valor) ?? {};
  return Object.entries(atributos)
    .map(([nome, v]) => {
      if (!REGEX_NOME.test(nome)) throw new Error(`nome de atributo inválido: "${nome}"`);
      return ` ${nome}="${escaparXml(String(v ?? ""))}"`;
    })
    .join("");
}

function elementoXml(nome: string, valor: unknown): string {
  if (!REGEX_NOME.test(nome)) throw new Error(`nome de elemento inválido: "${nome}"`);
  if (Array.isArray(valor)) return valor.map((v) => elementoXml(nome, v)).join("");
  if (valor === null || valor === undefined || valor === "") return `<${nome}/>`;

  const o = objeto(valor);
  if (!o) return `<${nome}>${escaparXml(String(valor))}</${nome}>`;

  const texto = o[TEXTO] !== undefined ? escaparXml(String(o[TEXTO])) : "";
  const filhos = Object.entries(o)
    .filter(([k]) => k !== ATRIBUTOS && k !== TEXTO)
    .map(([k, v]) => elementoXml(k, v))
    .join("");
  return `<${nome}${atributosXml(o[ATRIBUTOS])}>${texto}${filhos}</${nome}>`;
}

/** documento -> XML do contrato. Lanca com a mensagem se a forma nao servir. */
export function documentoParaXml(valor: unknown): string {
  const doc = objeto(valor);
  if (!doc) throw new Error('"documento" tem que ser um objeto.');
  const raiz = typeof doc.raiz === "string" ? doc.raiz : "";
  if (!REGEX_NOME.test(raiz)) throw new Error('"documento.raiz" tem que ser o nome do elemento raiz.');
  const namespace = typeof doc.namespace === "string" && doc.namespace ? ` xmlns="${escaparXml(doc.namespace)}"` : "";
  const dados = Object.entries(objeto(doc.dados) ?? {})
    .map(([k, v]) => elementoXml(k, v))
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${raiz}${namespace}${atributosXml(doc.atributos)}>${dados}</${raiz}>\n`;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  attributesGroupName: ATRIBUTOS,
  textNodeName: TEXTO,
  parseTagValue: false,
  parseAttributeValue: false,
  ignoreDeclaration: true,
  // Os XMLs que o Finanweb gera usam namespace padrao, sem prefixo; tirar
  // prefixo descartaria tambem o xmlns, que vira o "namespace" do documento.
  removeNSPrefix: false,
});

/** XML de um contrato -> documento, para responder no formato deles. */
export function xmlParaDocumento(xml: string): Documento {
  const raizes = Object.entries(parser.parse(xml) as No).filter(([k]) => k !== "?xml");
  const [raiz, conteudo] = raizes[0] ?? ["", {}];
  const corpo = { ...(objeto(conteudo) ?? {}) };
  const atributos = { ...((objeto(corpo[ATRIBUTOS]) ?? {}) as Record<string, string>) };
  delete corpo[ATRIBUTOS];
  const namespace = atributos.xmlns ?? null;
  delete atributos.xmlns;
  return { raiz, namespace, atributos, dados: corpo };
}
