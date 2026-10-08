"use server";

import { getUsuarioAtual } from "@/lib/auth";
import { enfileirarMensagem } from "@/lib/socket/chat";
import { normalizarDestino } from "@/lib/socket/protocolo";

export interface ResultadoMensagem {
  ok: boolean;
  erro?: string;
}

const MAX_CARACTERES = 1000;

export async function enviarMensagemAction(texto: string, destino: string): Promise<ResultadoMensagem> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const mensagem = texto.trim();
  if (!mensagem) return { ok: false, erro: "Escreva uma mensagem." };
  if (mensagem.length > MAX_CARACTERES) {
    return { ok: false, erro: `Mensagem longa demais (máximo ${MAX_CARACTERES} caracteres).` };
  }

  // "#ana", "ana", "3" e "ana#3" valem; vazio manda para todos os conectados.
  const alvo = normalizarDestino(destino);
  if (alvo && /\s/.test(alvo)) {
    return { ok: false, erro: "O destino é um nome ou id do servidor, sem espaços." };
  }

  await enfileirarMensagem(usuario.username, mensagem, alvo);
  return { ok: true };
}
