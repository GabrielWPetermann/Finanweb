// Integracao com a API do RH (RH Conecta), que nao publicou no registry mas
// documentou os servicos para o Financeiro na OpenAPI deles
// (/api/v1/openapi.json), com a chave em Authorization: Bearer:
//
//   GET  /api/v1/integracoes/financeiro/folha/{competencia}  -> folha-v1 em XML
//   POST /api/v1/integracoes/financeiro/folha/processada     <- a folha de volta,
//        com origem financeiro e os funcionarios ja pagos (JSON FolhaProcessadaJson)
//
// A chave fica em CHAVE_SETOR_RH, como a dos outros setores; o endereco pode
// ser trocado por RH_API_URL. Nada aqui lanca: a baixa e a busca ja gravaram
// o que importa, e a resposta do RH e so informada.

import { get } from "@vercel/blob";
import { XMLParser } from "fast-xml-parser";
import { prisma } from "@/lib/db";
import { variavelDaChave } from "@/lib/integracao/entrega";
import { guardarRecebido } from "@/lib/socket/caixa-entrada";
import { validarContraXsd } from "@/lib/xml/validador";

const SETOR_RH = "rh";
const TEMPO_MAXIMO_MS = 10000;
const REGEX_COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

function baseRh(): string {
  return (process.env.RH_API_URL ?? "https://entrega6interoperabilidade.vercel.app").replace(/\/+$/, "");
}

function chaveRh(): string | null {
  return process.env[variavelDaChave(SETOR_RH)] || null;
}

export type ResultadoRh = { ok: true; mensagem: string } | { ok: false; erro: string };

/**
 * Busca no RH a folha publicada de uma competencia (AAAA-MM) e poe na caixa
 * de entrada do /socket, para aprovar como as que chegam pelo socket.
 */
export async function buscarFolhaDoRh(competencia: string): Promise<ResultadoRh> {
  if (!REGEX_COMPETENCIA.test(competencia)) return { ok: false, erro: "Competência no formato AAAA-MM, ex.: 2026-11." };
  const chave = chaveRh();
  if (!chave) return { ok: false, erro: `Falta a chave do RH (${variavelDaChave(SETOR_RH)}) nas variáveis de ambiente.` };

  const url = `${baseRh()}/api/v1/integracoes/financeiro/folha/${competencia}`;
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      headers: { Authorization: `Bearer ${chave}`, Accept: "application/xml" },
      signal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
    });
  } catch (erro) {
    console.error(erro);
    return { ok: false, erro: "A API do RH não respondeu. Tente de novo em alguns minutos." };
  }

  const corpo = await resposta.text();
  if (resposta.status === 404) return { ok: false, erro: `O RH ainda não publicou a folha de ${competencia}.` };
  if (!resposta.ok) return { ok: false, erro: `A API do RH respondeu ${resposta.status}: ${corpo.slice(0, 200)}` };

  const erros = await validarContraXsd(corpo, "folha-v1.xsd");
  if (erros.length > 0) {
    return { ok: false, erro: `A folha do RH não passou no folha-v1.xsd: ${erros.slice(0, 3).join(" ")}` };
  }

  await guardarRecebido({ remetente: "rh (API)", nomeArquivo: `folha-rh-${competencia}.xml`, tipo: "FOLHA" }, corpo);
  return { ok: true, mensagem: `Folha de ${competencia} buscada no RH. Ela está em Recebidos, aguardando aprovação.` };
}

// ---------------------------------------------------------------------------
// Folha processada

interface FuncionarioFolha {
  cpf: string;
  matricula: string;
  nome: string;
  salarioBruto: string;
  descontos: string;
  salarioLiquido: string;
}

interface FolhaLida {
  referencia: string;
  empresa: string;
  cnpj: string;
  competencia: string;
  funcionarios: FuncionarioFolha[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (nome) => nome === "funcionario",
});

const texto = (valor: unknown) => String(valor ?? "").trim();

function lerFolha(xml: string): FolhaLida | null {
  const folha = parser.parse(xml)?.folha;
  if (!folha) return null;
  return {
    referencia: texto(folha["@referencia"]),
    empresa: texto(folha.cabecalho?.empresa),
    cnpj: texto(folha.cabecalho?.cnpj),
    competencia: texto(folha.competencia),
    funcionarios: (folha.funcionarios?.funcionario ?? []).map((f: Record<string, unknown>) => ({
      cpf: texto(f["@cpf"]),
      matricula: texto(f["@matricula"]),
      nome: texto(f.nome),
      salarioBruto: texto(f.salarioBruto),
      descontos: texto(f.descontos),
      salarioLiquido: texto(f.salarioLiquido),
    })),
  };
}

const hojeIso = (hoje: Date) => hoje.toISOString().slice(0, 10);

/**
 * Corpo de folha/processada: a folha original com origem financeiro, a data
 * da baixa e so os funcionarios ja pagos. null se nenhum foi pago.
 */
export function montarFolhaProcessada(folha: FolhaLida, cpfsPagos: Set<string>, usuario: string, hoje = new Date()) {
  const funcionarios = folha.funcionarios.filter((f) => cpfsPagos.has(f.cpf));
  if (funcionarios.length === 0) return null;
  const centavos = funcionarios.reduce((soma, f) => soma + Math.round(Number(f.salarioLiquido) * 100), 0);
  return {
    versao: "1.0",
    referencia: folha.referencia,
    cabecalho: { empresa: folha.empresa, cnpj: folha.cnpj, origem: "financeiro", dataArquivo: hojeIso(hoje), usuario },
    competencia: folha.competencia,
    dataPagamento: hojeIso(hoje),
    funcionarios,
    totalizador: { qtdFuncionarios: funcionarios.length, valorLiquidoTotal: (centavos / 100).toFixed(2) },
  };
}

/** Le o XML original de uma importacao, guardado no Blob. */
async function lerArquivoDaImportacao(importacaoId: string): Promise<string | null> {
  const importacao = await prisma.importacao.findUnique({ where: { id: importacaoId }, select: { blobUrl: true } });
  if (!importacao) return null;
  const arquivo = await get(importacao.blobUrl, { access: "private" });
  if (!arquivo || arquivo.stream === null) return null;
  return new Response(arquivo.stream).text();
}

/**
 * Depois de uma baixa de salarios, devolve ao RH cada folha envolvida com
 * todos os funcionarios ja pagos dela (nao so os desta baixa). referencias:
 * as das despesas baixadas, "FOLHA-2026-11/<cpf>".
 */
export async function devolverFolhasProcessadas(referencias: (string | null)[], usuario: string): Promise<void> {
  try {
    const folhas = [...new Set(referencias.filter((r): r is string => !!r && r.includes("/")).map((r) => r.split("/")[0]))];
    if (folhas.length === 0) return;
    const chave = chaveRh();
    if (!chave) {
      console.log(`folha processada sem entrega: sem ${variavelDaChave(SETOR_RH)}`);
      return;
    }

    for (const referenciaFolha of folhas) {
      const salarios = await prisma.despesaAgrupada.findMany({
        where: { origem: SETOR_RH, referencia: { startsWith: `${referenciaFolha}/` } },
        select: { referencia: true, status: true, importacaoId: true },
        orderBy: { id: "asc" },
      });
      const pagos = new Set(
        salarios
          .filter((s) => ["CONFIRMADO", "PAGO"].includes(s.status.trim().toUpperCase()))
          .map((s) => s.referencia!.slice(referenciaFolha.length + 1))
      );
      const importacaoId = salarios.find((s) => s.importacaoId)?.importacaoId;
      const xml = importacaoId ? await lerArquivoDaImportacao(importacaoId) : null;
      const folha = xml ? lerFolha(xml) : null;
      if (!folha) {
        console.error(`folha processada ${referenciaFolha}: arquivo original da folha não encontrado`);
        continue;
      }
      const corpo = montarFolhaProcessada(folha, pagos, usuario);
      if (!corpo) continue;

      const url = `${baseRh()}/api/v1/integracoes/financeiro/folha/processada`;
      try {
        const resposta = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(corpo),
          signal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
        });
        const texto = (await resposta.text()).slice(0, 300);
        console.log(
          resposta.ok
            ? `folha processada ${referenciaFolha} (${corpo.funcionarios.length} pagos) entregue ao RH (${resposta.status})`
            : `folha processada ${referenciaFolha} recusada pelo RH: ${resposta.status} ${texto}`
        );
      } catch (erro) {
        console.error(`folha processada ${referenciaFolha}: falha ao chamar o RH: ${String(erro)}`);
      }
    }
  } catch (erro) {
    console.error(erro);
  }
}
