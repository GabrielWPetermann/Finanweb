// Chat do servidor de socket, visto pelo Finanweb (tela /chat).
//
// O banco e a ponte entre as duas metades: o ouvinte (npm run socket), que
// fica conectado, grava o que chega e manda o que esta na fila; a tela, que
// roda em funcao serverless, so le e enfileira.

import { prisma } from "@/lib/db";
import { linhaDeTexto } from "@/lib/socket/protocolo";

export interface LinhaInterpretada {
  autor: string;
  texto: string;
  privada: boolean;
  aviso: boolean;
}

/**
 * Formatos que o servidor manda:
 *   "nome#id: texto"            publica
 *   "(privado) nome#id: texto"  privada para o Finanweb
 *   "servidor: texto"           digitada no terminal do servidor
 *   "[servidor] texto"          aviso (entrou, saiu, destino nao encontrado...)
 */
export function interpretarLinha(linha: string): LinhaInterpretada {
  if (linha.startsWith("[servidor] ")) {
    return { autor: "servidor", texto: linha.slice("[servidor] ".length), privada: false, aviso: true };
  }

  const privada = linha.startsWith("(privado) ");
  const resto = privada ? linha.slice("(privado) ".length) : linha;
  const separador = resto.indexOf(": ");
  if (separador > 0) {
    return { autor: resto.slice(0, separador), texto: resto.slice(separador + 2), privada, aviso: false };
  }

  // Formato desconhecido (outro servidor, linha cortada): mostra como veio.
  return { autor: "servidor", texto: linha, privada: false, aviso: true };
}

export async function registrarRecebida(linha: string): Promise<void> {
  const { autor, texto, privada, aviso } = interpretarLinha(linha);
  await prisma.mensagemChat.create({
    data: { direcao: "RECEBIDA", autor, texto, privada, aviso },
  });
}

/** Mensagem que o proprio ouvinte mandou (resposta sobre arquivo recebido). */
export async function registrarEnviadaPeloOuvinte(destino: string, texto: string): Promise<void> {
  await prisma.mensagemChat.create({
    data: { direcao: "ENVIADA", autor: "ouvinte", destino, privada: true, texto, enviadaEm: new Date() },
  });
}

/** Enfileira uma mensagem escrita na tela; o ouvinte manda pelo socket. */
export async function enfileirarMensagem(autor: string, texto: string, destino: string | null): Promise<void> {
  await prisma.mensagemChat.create({
    data: { direcao: "ENVIADA", autor, texto: linhaDeTexto(texto), destino, privada: destino !== null },
  });
}

export async function pegarFila(limite = 20) {
  return prisma.mensagemChat.findMany({
    where: { direcao: "ENVIADA", enviadaEm: null },
    orderBy: { criadoEm: "asc" },
    take: limite,
  });
}

export async function marcarEnviada(id: string): Promise<void> {
  await prisma.mensagemChat.update({ where: { id }, data: { enviadaEm: new Date() } });
}

/**
 * Linha que vai para o socket. O nome de quem escreveu vai na frente porque,
 * para o resto da turma, toda mensagem do Finanweb sai como "finanweb#id".
 * Isso tambem impede que um texto comecando com "/" vire comando no servidor.
 */
export function linhaParaEnviar(mensagem: { autor: string; texto: string; destino: string | null }): string {
  const prefixo = mensagem.destino ? `#${mensagem.destino} ` : "";
  return `${prefixo}[${mensagem.autor}] ${linhaDeTexto(mensagem.texto)}\n`;
}

export interface MensagemTela {
  id: string;
  direcao: "RECEBIDA" | "ENVIADA";
  autor: string;
  destino: string | null;
  privada: boolean;
  aviso: boolean;
  texto: string;
  criadoEm: string; // ISO
  enviada: boolean;
}

/** As ultimas mensagens, da mais antiga para a mais nova. */
export async function ultimasMensagens(limite = 150): Promise<MensagemTela[]> {
  const mensagens = await prisma.mensagemChat.findMany({ orderBy: { criadoEm: "desc" }, take: limite });
  return mensagens.reverse().map((m) => ({
    id: m.id,
    direcao: m.direcao,
    autor: m.autor,
    destino: m.destino,
    privada: m.privada,
    aviso: m.aviso,
    texto: m.texto,
    criadoEm: m.criadoEm.toISOString(),
    // RECEBIDA ja chegou; ENVIADA so depois que o ouvinte mandou.
    enviada: m.direcao === "RECEBIDA" || m.enviadaEm !== null,
  }));
}
