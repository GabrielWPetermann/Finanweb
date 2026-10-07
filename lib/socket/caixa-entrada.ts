// Caixa de entrada dos XMLs recebidos via socket, aguardando aprovacao.
//
// Fica no Vercel Blob, e nao numa tabela, pelo mesmo motivo do formato do
// arquivo nao ter coluna propria: nao exigir migration no banco. Os dados de
// cada arquivo (remetente, nome, tipo) vao codificados no proprio pathname,
// entao uma listagem do prefixo ja traz tudo o que a tela precisa.

import { del, get, list, put } from "@vercel/blob";

const PREFIXO = "socket-recebidos/";

export type TipoMovimento = "ENTRADA" | "SAIDA";

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

// O tipo vem do namespace do elemento raiz, que o XSD de cada movimento exige.
const NAMESPACES: Record<string, TipoMovimento> = {
  "urn:finanweb:entrada:1.0": "ENTRADA",
  "urn:finanweb:saida:1.0": "SAIDA",
};

export function detectarTipoMovimento(conteudo: string): TipoMovimento | null {
  const raiz = /<movimento\b[^>]*\bxmlns="([^"]+)"/.exec(conteudo);
  return raiz ? (NAMESPACES[raiz[1]] ?? null) : null;
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
