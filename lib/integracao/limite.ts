// Rate limit da API REST, do SOAP e do registry, em janelas fixas de um
// minuto. O contador fica no banco (LimiteRequisicao) porque as funcoes da
// Vercel nao dividem memoria; um INSERT ... ON CONFLICT soma de forma
// atomica, mesmo com chamadas simultaneas em instancias diferentes.
//
// Quem tem chave conta pelo setor; o resto (busca no registry, tentativa sem
// chave) conta pelo IP. Se o banco falhar, a requisicao passa: o limite nao
// pode derrubar o servico que ele protege.

import { prisma } from "@/lib/db";

const JANELA_MS = 60_000;
const UM_DIA_MS = 86_400_000;

export interface Limite {
  permitido: boolean;
  limite: number;
  restantes: number;
  reiniciaEm: Date;
}

/** Limites por minuto, ajustaveis por variavel de ambiente sem novo deploy de codigo. */
export function limitePorMinuto(tipo: "setor" | "ip" | "semChave"): number {
  const padrao = { setor: 60, ip: 120, semChave: 20 }[tipo];
  const variavel = {
    setor: "LIMITE_POR_SETOR_MINUTO",
    ip: "LIMITE_POR_IP_MINUTO",
    semChave: "LIMITE_SEM_CHAVE_MINUTO",
  }[tipo];
  const valor = Number(process.env[variavel]);
  return Number.isInteger(valor) && valor > 0 ? valor : padrao;
}

/** Conta uma requisicao da chave e diz se ela ainda cabe na janela. */
export async function consumirLimite(chave: string, limite: number): Promise<Limite> {
  const inicio = Math.floor(Date.now() / JANELA_MS) * JANELA_MS;
  const reiniciaEm = new Date(inicio + JANELA_MS);
  try {
    const [linha] = await prisma.$queryRaw<{ contagem: number }[]>`
      INSERT INTO "LimiteRequisicao" ("chave", "janela", "contagem")
      VALUES (${chave}, ${new Date(inicio)}, 1)
      ON CONFLICT ("chave", "janela") DO UPDATE SET "contagem" = "LimiteRequisicao"."contagem" + 1
      RETURNING "contagem"`;
    const contagem = Number(linha?.contagem ?? 1);

    // Janelas velhas so servem para ocupar espaco: uma requisicao em cem limpa.
    if (Math.random() < 0.01) {
      await prisma.limiteRequisicao.deleteMany({ where: { janela: { lt: new Date(Date.now() - UM_DIA_MS) } } });
    }
    return { permitido: contagem <= limite, limite, restantes: Math.max(0, limite - contagem), reiniciaEm };
  } catch (erro) {
    console.error(erro);
    return { permitido: true, limite, restantes: limite, reiniciaEm };
  }
}

/** Cabecalhos padrao de rate limit; Retry-After so quando estourou. */
export function cabecalhosLimite(l: Limite): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(l.limite),
    "X-RateLimit-Remaining": String(l.restantes),
    "X-RateLimit-Reset": String(Math.ceil(l.reiniciaEm.getTime() / 1000)),
    ...(l.permitido ? {} : { "Retry-After": String(Math.max(1, Math.ceil((l.reiniciaEm.getTime() - Date.now()) / 1000))) }),
  };
}

/** IP de quem chamou, pelo cabecalho que a Vercel preenche. */
export function ipDaRequisicao(request: Request): string {
  const encaminhado = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encaminhado || request.headers.get("x-real-ip") || "desconhecido";
}
