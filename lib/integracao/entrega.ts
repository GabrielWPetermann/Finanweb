// Entrega de uma mensagem do Financeiro a outro setor pela API dele, no
// modelo publish-find-bind: o setor publicou no registry o servico que recebe
// a mensagem (find), e o Finanweb chama o endpoint publicado (bind) com a
// chave que aquele setor emitiu para o Financeiro.
//
// A chave fica so em variavel de ambiente, CHAVE_SETOR_<SETOR> (por exemplo
// CHAVE_SETOR_COMPRAS), nunca no codigo nem no banco. Sem chave ou sem servico
// no registry, nao ha entrega por HTTP; o socket e a busca do proprio setor
// (GET /api/v1/avisos-pagamento) continuam valendo.

import { buscarServicos } from "@/lib/registro";

const TEMPO_MAXIMO_MS = 5000;

export type ResultadoEntrega =
  | { entregue: true; endpoint: string; status: number }
  | { entregue: false; motivo: string };

/** Nome da variavel com a chave do setor: compras -> CHAVE_SETOR_COMPRAS. */
export function variavelDaChave(setor: string): string {
  return `CHAVE_SETOR_${setor.toUpperCase().replace(/-/g, "_")}`;
}

/**
 * Manda o XML para o servico REST do setor cujo nome contem `servico`
 * (procurado no registry). Nunca lanca: quem chama ja gravou o que importa, e
 * a entrega e um aviso a mais.
 */
export async function entregarAoSetor(setor: string, servico: string, xml: string): Promise<ResultadoEntrega> {
  const chave = process.env[variavelDaChave(setor)];
  if (!chave) return { entregue: false, motivo: `sem ${variavelDaChave(setor)}` };

  try {
    const [destino] = (await buscarServicos({ setor, nome: servico, protocolo: "REST", situacao: "ATIVO" }, "")).filter(
      (s) => s.operacao?.toUpperCase() === "POST"
    );
    if (!destino) return { entregue: false, motivo: `${setor} não publicou "${servico}" (REST, POST) no registry` };

    const resposta = await fetch(destino.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/xml; charset=utf-8", Authorization: `Bearer ${chave}` },
      body: xml,
      signal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
    });
    // 200 = o setor ja tinha recebido (idempotente), 202 = recebido agora.
    if (resposta.ok) return { entregue: true, endpoint: destino.endpoint, status: resposta.status };

    const corpo = (await resposta.text()).slice(0, 300);
    return { entregue: false, motivo: `${destino.endpoint} respondeu ${resposta.status}: ${corpo}` };
  } catch (erro) {
    return { entregue: false, motivo: `falha ao chamar ${setor}: ${String(erro)}` };
  }
}
