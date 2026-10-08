// Quem esta conectado ao servidor de chat, segundo o ouvinte.
//
// As telas leem daqui em vez de abrir uma conexao so para perguntar /lista:
// cada conexao nova o servidor anuncia para a turma inteira ("entrou",
// "agora e", "saiu"), entao consultar virava ruido no chat de todo mundo.

import { prisma } from "@/lib/db";

const ID = "ouvinte";

// O ouvinte atualiza no minimo a cada batimento (1 min). Bem mais que isso
// sem atualizar e ele nao esta rodando.
const OUVINTE_FORA_DO_AR_MS = 150_000;

export interface EstadoConectados {
  conectados: string[];
  ouvinteOnline: boolean;
  atualizadoEm: string | null; // ISO
}

/**
 * Quem vai receber: o destino (nome ou id) ou, sem destino, todos menos o
 * proprio ouvinte. Lista vazia = ninguem para receber.
 */
export function resolverDestinatarios(conectados: string[], destino: string | null, nomeOuvinte: string): string[] {
  return conectados.filter((rotulo) => {
    const separador = rotulo.lastIndexOf("#");
    const nome = rotulo.slice(0, separador).toLowerCase();
    const id = rotulo.slice(separador + 1);
    if (destino) return id === destino || nome === destino.toLowerCase();
    return nome !== nomeOuvinte.toLowerCase();
  });
}

export async function gravarConectados(conectados: string[]): Promise<void> {
  await prisma.estadoOuvinte.upsert({
    where: { id: ID },
    create: { id: ID, conectados },
    update: { conectados },
  });
}

export async function lerConectados(): Promise<EstadoConectados> {
  const estado = await prisma.estadoOuvinte.findUnique({ where: { id: ID } });
  if (!estado) return { conectados: [], ouvinteOnline: false, atualizadoEm: null };

  const ouvinteOnline = Date.now() - estado.atualizadoEm.getTime() < OUVINTE_FORA_DO_AR_MS;
  return {
    // Fora do ar, a lista e de quando ele caiu: melhor nao mostrar como atual.
    conectados: ouvinteOnline ? estado.conectados : [],
    ouvinteOnline,
    atualizadoEm: estado.atualizadoEm.toISOString(),
  };
}
