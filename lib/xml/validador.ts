// Validacao de XML contra os XSD do projeto, com xmllint-wasm (libxml2
// compilado para WebAssembly -- sem dependencia nativa, roda igual no Windows,
// no Linux e na funcao serverless).
//
// Os .xsd sao lidos do disco em runtime; o next.config inclui lib/xml/schemas
// no outputFileTracing para eles chegarem ao bundle de deploy.

import fs from "node:fs";
import path from "node:path";
import { memoryPages, validateXML } from "xmllint-wasm";

export type SchemaXml = "entrada-v1.xsd" | "saida-v1.xsd";

export const SCHEMA_POR_TIPO: Record<"ENTRADA" | "SAIDA", SchemaXml> = {
  ENTRADA: "entrada-v1.xsd",
  SAIDA: "saida-v1.xsd",
};

const DIRETORIO_SCHEMAS = path.join(process.cwd(), "lib", "xml", "schemas");

// Os schemas nao mudam em runtime; ler uma vez por processo evita ida ao disco
// a cada importacao.
const cache = new Map<SchemaXml, string>();

export function lerSchema(nome: SchemaXml): string {
  const emCache = cache.get(nome);
  if (emCache) return emCache;

  const conteudo = fs.readFileSync(path.join(DIRETORIO_SCHEMAS, nome), "utf8");
  cache.set(nome, conteudo);
  return conteudo;
}

// XML de muitos registros passa facil de 5 MB; o limite padrao (32 MiB) fica
// apertado para a arvore em memoria do libxml2.
const MAX_MEMORIA = 512 * memoryPages.MiB;

/**
 * Devolve a lista de problemas encontrados. Lista vazia = documento valido.
 * As mensagens ja vem prontas para exibir, com o numero da linha, e sao
 * consumidas pelo mesmo formatarErrosParser usado pelos parsers do layout.
 */
export async function validarContraXsd(conteudo: string, schema: SchemaXml): Promise<string[]> {
  try {
    const resultado = await validateXML({
      xml: { fileName: "movimento.xml", contents: conteudo },
      schema: { fileName: schema, contents: lerSchema(schema) },
      maxMemoryPages: MAX_MEMORIA,
    });

    if (resultado.valid) return [];

    return resultado.errors.map((erro) => {
      const linha = erro.loc?.lineNumber;
      const mensagem = erro.message.replace(/^.*?Schemas validity error : /, "");
      return linha ? `Linha ${linha}: ${mensagem}` : mensagem;
    });
  } catch (erro) {
    // XML mal formado (tag nao fechada, caractere invalido) faz o libxml2
    // lancar antes de chegar a validar contra o schema.
    console.error(erro);
    return [`Arquivo XML mal formado e nao pode ser lido: ${String(erro).slice(0, 200)}`];
  }
}
