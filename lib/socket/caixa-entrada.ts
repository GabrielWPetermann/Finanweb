// Caixa de entrada dos XMLs recebidos via socket, aguardando aprovacao.
//
// Fica no Vercel Blob, e nao numa tabela, pelo mesmo motivo do formato do
// arquivo nao ter coluna propria: nao exigir migration no banco. Os dados de
// cada arquivo (remetente, nome, tipo) vao codificados no proprio pathname,
// entao uma listagem do prefixo ja traz tudo o que a tela precisa.

import { del, get, list, put } from "@vercel/blob";
import type { SchemaXml } from "@/lib/xml/validador";

const PREFIXO = "socket-recebidos/";

// FOLHA vira Saida na importacao, mas tem tipo proprio: e pelo tipo gravado
// no pathname que a tela /socket mostra o que chegou.
export type TipoMovimento = "ENTRADA" | "SAIDA" | "FOLHA";

export interface ArquivoRecebido {
  pathname: string;
  remetente: string;
  nomeArquivo: string;
  tipo: TipoMovimento;
  tamanho: number;
  recebidoEm: Date;
}

interface Metadados {
  remetente: string;
  nomeArquivo: string;
  tipo: TipoMovimento;
}

export interface FormatoMovimento {
  tipo: TipoMovimento;
  schema: SchemaXml;
}

// O formato vem do namespace do elemento raiz, que o XSD de cada movimento
// exige. v1 e o formato interno (exportar e reimportar); v2 e folha sao os
// envios dos outros setores, com origem + referencia.
const FORMATOS: Record<string, FormatoMovimento> = {
  "urn:finanweb:entrada:1.0": { tipo: "ENTRADA", schema: "entrada-v1.xsd" },
  "urn:finanweb:saida:1.0": { tipo: "SAIDA", schema: "saida-v1.xsd" },
  "urn:finanweb:entrada:2.0": { tipo: "ENTRADA", schema: "entrada-v2.xsd" },
  "urn:finanweb:saida:2.0": { tipo: "SAIDA", schema: "saida-v2.xsd" },
  "urn:finanweb:folha:1.0": { tipo: "FOLHA", schema: "folha-v1.xsd" },
};

export function detectarMovimento(conteudo: string): FormatoMovimento | null {
  const namespace = lerNamespaceRaiz(conteudo);
  return namespace ? (FORMATOS[namespace] ?? null) : null;
}

/**
 * Namespace padrao (xmlns="...") do elemento raiz, seja qual for o nome dele,
 * ou null. E por ele que o ouvinte separa movimento, consulta e contrato que
 * ainda nao processa. Comentarios sao ignorados: um exemplo comentado antes da
 * raiz nao pode ser confundido com ela.
 */
export function lerNamespaceRaiz(conteudo: string): string | null {
  const semComentarios = conteudo.replace(/<!--[\s\S]*?-->/g, "");
  const raiz = /<[A-Za-z_][^\s/>]*([^>]*)>/.exec(semComentarios);
  if (!raiz) return null;
  return /\bxmlns="([^"]+)"/.exec(raiz[1])?.[1] ?? null;
}

// "<timestamp>.<metadados em base64url>.xml": base64url nao tem ponto nem
// barra, entao o pathname continua seguro e da para separar as partes.
function montarPathname(metadados: Metadados): string {
  const codificado = Buffer.from(JSON.stringify(metadados), "utf8").toString("base64url");
  return `${PREFIXO}${Date.now()}.${codificado}.xml`;
}

function lerPathname(pathname: string): (Metadados & { recebidoEm: Date }) | null {
  const [timestamp, codificado] = pathname.slice(PREFIXO.length).split(".");
  try {
    const metadados = JSON.parse(Buffer.from(codificado, "base64url").toString("utf8")) as Metadados;
    return { ...metadados, recebidoEm: new Date(Number(timestamp)) };
  } catch {
    return null; // arquivo que nao foi gravado por guardarRecebido
  }
}

export function ehPathnameDaCaixa(pathname: string): boolean {
  return pathname.startsWith(PREFIXO) && !pathname.slice(PREFIXO.length).includes("/");
}

export async function guardarRecebido(metadados: Metadados, conteudo: string): Promise<void> {
  await put(montarPathname(metadados), conteudo, {
    access: "private",
    contentType: "application/xml",
  });
}

export async function listarRecebidos(): Promise<ArquivoRecebido[]> {
  const { blobs } = await list({ prefix: PREFIXO });
  const arquivos: ArquivoRecebido[] = [];
  for (const blob of blobs) {
    const metadados = lerPathname(blob.pathname);
    if (metadados) arquivos.push({ ...metadados, pathname: blob.pathname, tamanho: blob.size });
  }
  return arquivos.sort((a, b) => b.recebidoEm.getTime() - a.recebidoEm.getTime());
}

export async function lerRecebido(
  pathname: string
): Promise<{ arquivo: Metadados; conteudo: string } | null> {
  const arquivo = lerPathname(pathname);
  if (!arquivo || !ehPathnameDaCaixa(pathname)) return null;

  const resultado = await get(pathname, { access: "private" });
  if (!resultado || resultado.stream === null) return null;

  const conteudo = await new Response(resultado.stream).text();
  return { arquivo, conteudo };
}

export async function descartarRecebido(pathname: string): Promise<void> {
  if (!ehPathnameDaCaixa(pathname)) return;
  await del(pathname);
}
