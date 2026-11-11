// Quem esta chamando a API: a chave do setor (Authorization: Bearer <chave>,
// gerada por um admin em /admin/registro) diz o setor, e o rate limit conta
// por ele. E a mesma chave do registry.
//
// Vale para REST e SOAP. O socket fica de fora: o protocolo do servidor da
// turma nao tem como levar uma chave, e quem esta conectado ja e identificado
// pelo nome no servidor.

import { cabecalhosLimite, consumirLimite, ipDaRequisicao, limitePorMinuto } from "@/lib/integracao/limite";
import { setorDaRequisicao } from "@/lib/registro";

export type Acesso =
  | { ok: true; setor: string; cabecalhos: Record<string, string> }
  | { ok: false; status: 401 | 429 | 503; erro: string; cabecalhos: Record<string, string> };

export const SEM_CHAVE =
  'Envie a chave do setor no cabeçalho "Authorization: Bearer <chave>". Peça a chave ao Financeiro (mensagem privada para #finanweb).';

function excedeu(limite: number, reiniciaEm: Date): string {
  const segundos = Math.max(1, Math.ceil((reiniciaEm.getTime() - Date.now()) / 1000));
  return `Limite de ${limite} requisições por minuto atingido. Tente de novo em ${segundos}s.`;
}

/**
 * Identifica o setor pela chave e conta a requisicao no limite dele. Sem
 * chave valida, conta pelo IP, num limite menor, para tentativa de chave nao
 * virar enxurrada.
 */
export async function autorizarSetor(request: Request): Promise<Acesso> {
  let setor: string | null;
  try {
    setor = await setorDaRequisicao(request);
  } catch (erro) {
    console.error(erro);
    return { ok: false, status: 503, erro: "Não foi possível conferir a chave agora. Tente de novo em alguns minutos.", cabecalhos: {} };
  }

  if (!setor) {
    const limite = await consumirLimite(`semchave:${ipDaRequisicao(request)}`, limitePorMinuto("semChave"));
    return limite.permitido
      ? { ok: false, status: 401, erro: SEM_CHAVE, cabecalhos: cabecalhosLimite(limite) }
      : { ok: false, status: 429, erro: excedeu(limite.limite, limite.reiniciaEm), cabecalhos: cabecalhosLimite(limite) };
  }

  const limite = await consumirLimite(`setor:${setor}`, limitePorMinuto("setor"));
  if (!limite.permitido) {
    return { ok: false, status: 429, erro: excedeu(limite.limite, limite.reiniciaEm), cabecalhos: cabecalhosLimite(limite) };
  }
  return { ok: true, setor, cabecalhos: cabecalhosLimite(limite) };
}

/** Limite por IP, para o que e publico (busca no registry). */
export async function limitarPorIp(
  request: Request
): Promise<{ ok: true; cabecalhos: Record<string, string> } | { ok: false; erro: string; cabecalhos: Record<string, string> }> {
  const limite = await consumirLimite(`ip:${ipDaRequisicao(request)}`, limitePorMinuto("ip"));
  return limite.permitido
    ? { ok: true, cabecalhos: cabecalhosLimite(limite) }
    : { ok: false, erro: excedeu(limite.limite, limite.reiniciaEm), cabecalhos: cabecalhosLimite(limite) };
}

/**
 * Um setor so envia e consulta em nome dele: a origem da mensagem tem que
 * ser o setor da chave. Devolve a mensagem de erro, ou null se bate.
 */
export function origemDeOutroSetor(origem: string, setor: string): string | null {
  return origem && origem !== setor
    ? `A origem "${origem}" não é o setor da chave ("${setor}"). Cada setor envia e consulta só em nome dele.`
    : null;
}
