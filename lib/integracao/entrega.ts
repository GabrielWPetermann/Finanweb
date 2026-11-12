// Entrega de uma mensagem do Financeiro a outro setor pela API dele, no
// modelo publish-find-bind: o setor publicou no registry o servico que recebe
// a mensagem (find), e o Finanweb chama o endpoint publicado (bind) com a
// chave que aquele setor emitiu para o Financeiro.
//
// Setor que nao publicou no registry mas informou onde recebe fica em
// ENDPOINTS_CONHECIDOS, com o formato que ele aceita.
//
// A chave fica so em variavel de ambiente, CHAVE_SETOR_<SETOR> (por exemplo
// CHAVE_SETOR_COMPRAS), nunca no codigo nem no banco. Sem chave ou sem
// endereco, nao ha entrega por HTTP; o socket e a busca do proprio setor
// (GET /api/v1/avisos-pagamento ou /avisos-recebimento) continuam valendo.

import { xmlParaDocumento } from "@/lib/integracao/documento";
import { buscarServicos } from "@/lib/registro";

interface Destino {
  endpoint: string;
  // xml: o XML do contrato, chave em Authorization (servico do registry).
  // documento: o envelope da API de interoperabilidade de Vendas
  // (lib/integracao/documento.ts), chave em X-API-Key.
  formato: "xml" | "documento";
}

// A API de interoperabilidade de Vendas recebe tudo o que vem do Financeiro
// num endpoint so, informado por eles na mensagem de integracao.
const ENDPOINTS_CONHECIDOS: Record<string, Destino> = {
  vendas: {
    endpoint: "https://api-interoperabilidade-production.up.railway.app/api/v1/integracoes/financeiro",
    formato: "documento",
  },
};

const TEMPO_MAXIMO_MS = 5000;

export type ResultadoEntrega =
  | { entregue: true; endpoint: string; status: number }
  | { entregue: false; motivo: string };

/** Nome da variavel com a chave do setor: compras -> CHAVE_SETOR_COMPRAS. */
export function variavelDaChave(setor: string): string {
  return `CHAVE_SETOR_${setor.toUpperCase().replace(/-/g, "_")}`;
}

/** Onde entregar: o servico publicado no registry, ou o endereco conhecido. */
async function acharDestino(setor: string, servico: string): Promise<Destino | null> {
  const [publicado] = (await buscarServicos({ setor, nome: servico, protocolo: "REST", situacao: "ATIVO" }, "")).filter(
    (s) => s.operacao?.toUpperCase() === "POST"
  );
  if (publicado) return { endpoint: publicado.endpoint, formato: "xml" };
  return ENDPOINTS_CONHECIDOS[setor] ?? null;
}

/**
 * Manda o XML para o servico REST do setor cujo nome contem `servico`
 * (procurado no registry) ou para o endereco conhecido dele. Nunca lanca:
 * quem chama ja gravou o que importa, e a entrega e um aviso a mais.
 */
export async function entregarAoSetor(setor: string, servico: string, xml: string): Promise<ResultadoEntrega> {
  const chave = process.env[variavelDaChave(setor)];
  if (!chave) return { entregue: false, motivo: `sem ${variavelDaChave(setor)}` };

  try {
    const destino = await acharDestino(setor, servico);
    if (!destino) {
      return { entregue: false, motivo: `${setor} não publicou "${servico}" (REST, POST) no registry nem tem endereço conhecido` };
    }

    const resposta = await fetch(
      destino.endpoint,
      destino.formato === "documento"
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-Key": chave },
            body: JSON.stringify({ documento: xmlParaDocumento(xml) }),
            signal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
          }
        : {
            method: "POST",
            headers: { "Content-Type": "application/xml; charset=utf-8", Authorization: `Bearer ${chave}` },
            body: xml,
            signal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
          }
    );
    const corpo = (await resposta.text()).slice(0, 300);

    // 200 = o setor ja tinha recebido (idempotente), 202 = recebido agora. No
    // envelope documento, o setor tambem diz "sucesso": false no corpo.
    const recusado = destino.formato === "documento" && /"sucesso"\s*:\s*false/.test(corpo);
    if (resposta.ok && !recusado) return { entregue: true, endpoint: destino.endpoint, status: resposta.status };
    return { entregue: false, motivo: `${destino.endpoint} respondeu ${resposta.status}: ${corpo}` };
  } catch (erro) {
    return { entregue: false, motivo: `falha ao chamar ${setor}: ${String(erro)}` };
  }
}
