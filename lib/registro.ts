// Registry da turma, no modelo publish-find-bind:
//   publish  cada setor publica os servicos que oferece (POST /api/registro),
//            com a chave que um admin do Finanweb gerou para ele;
//   find     qualquer um busca (GET /api/registro), por setor, nome,
//            protocolo, consumidor ou situacao;
//   bind     com o endpoint e o contrato do resultado, o consumidor chama o
//            servico direto, sem passar pelo registry.
//
// Os servicos do proprio Financeiro nao ficam no banco: saem do catalogo de
// contratos (lib/xml/contratos.ts), entao sao publicados a cada deploy e nao
// tem como ficar diferentes do que o Finanweb realmente atende.

import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SOCKET_HOST, SOCKET_NOME, SOCKET_PORTA } from "@/lib/socket/config";
import { CONTRATOS } from "@/lib/xml/contratos";

export const PROTOCOLOS = ["SOCKET", "REST", "SOAP"] as const;
export const SITUACOES = ["ATIVO", "DEPRECIADO", "DESATIVADO"] as const;
export type Protocolo = (typeof PROTOCOLOS)[number];
export type Situacao = (typeof SITUACOES)[number];

// Setor do Finanweb no registry. Nenhum outro setor pode publicar com ele.
export const SETOR_FINANCEIRO = "financeiro";

// Mesmo padrao da origem nos XSDs: o nome do setor no servidor da turma.
export const REGEX_SETOR = /^[a-z][a-z0-9-]{1,29}$/;
const REGEX_VERSAO = /^\d{1,3}(\.\d{1,3}){0,2}$/;
const MAX_TEXTO = 300;

export interface Servico {
  setor: string;
  nome: string;
  versao: string;
  protocolo: Protocolo;
  endpoint: string;
  operacao: string | null;
  contrato: string | null;
  consumidor: string | null;
  descricao: string;
  situacao: Situacao;
  publicadoEm: string | null; // null nos do Financeiro: vem do deploy
  atualizadoEm: string | null;
}

// ===================== Chaves =====================

function hash(chave: string): string {
  return createHash("sha256").update(chave).digest("hex");
}

/** Gera (ou troca) a chave do setor. Devolve a chave, que so aparece agora. */
export async function gerarChave(setor: string): Promise<string> {
  const chave = randomBytes(24).toString("base64url");
  await prisma.chaveRegistro.upsert({
    where: { setor },
    create: { setor, chaveHash: hash(chave) },
    update: { chaveHash: hash(chave) },
  });
  return chave;
}

export function setorReservado(setor: string): boolean {
  return setor === SETOR_FINANCEIRO || setor === SOCKET_NOME.toLowerCase();
}

/** "Authorization: Bearer <chave>" -> setor dono da chave, ou null. */
export async function setorDaRequisicao(request: Request): Promise<string | null> {
  const chave = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!chave) return null;
  const registro = await prisma.chaveRegistro.findUnique({ where: { chaveHash: hash(chave) } });
  return registro?.setor ?? null;
}

// ===================== Servicos do Financeiro =====================

/** Versao do contrato pelo namespace: urn:finanweb:entrada:2.0 -> 2.0. */
function versaoDoNamespace(namespace: string): string {
  return namespace.slice(namespace.lastIndexOf(":") + 1);
}

/**
 * O catalogo de contratos como servicos do registry: cada mensagem nos tres
 * protocolos. O aviso de pagamento aparece uma vez por setor que recebe no
 * catalogo, e aqui vira um servico so, com os dois consumidores.
 */
export function servicosDoFinanceiro(base: string): Servico[] {
  const porMensagem = new Map<string, (typeof CONTRATOS)[number] & { consumidores: string[] }>();
  for (const c of CONTRATOS) {
    const existente = porMensagem.get(c.namespace);
    if (existente) existente.consumidores.push(c.setor);
    else porMensagem.set(c.namespace, { ...c, consumidores: [c.setor] });
  }

  return [...porMensagem.values()].flatMap((c) => {
    const [metodo, caminho] = c.rest.split(" ");
    const comum = {
      setor: SETOR_FINANCEIRO,
      nome: c.mensagem,
      versao: versaoDoNamespace(c.namespace),
      consumidor: c.consumidores.map((s) => s.toLowerCase()).join(", "),
      descricao: c.descricao,
      situacao: "ATIVO" as const,
      publicadoEm: null,
      atualizadoEm: null,
    };
    return [
      {
        ...comum,
        protocolo: "SOCKET" as const,
        endpoint: `#${SOCKET_NOME} @ ${SOCKET_HOST}:${SOCKET_PORTA}`,
        operacao: c.namespace,
        contrato: `${base}/api/contratos/${c.schema}`,
      },
      {
        ...comum,
        protocolo: "REST" as const,
        endpoint: `${base}${caminho.split("?")[0]}`,
        operacao: metodo,
        contrato: `${base}/contratos`,
      },
      {
        ...comum,
        protocolo: "SOAP" as const,
        endpoint: `${base}/api/soap`,
        operacao: c.soap,
        contrato: `${base}/api/soap?wsdl`,
      },
    ];
  });
}

// ===================== Find =====================

export interface Filtros {
  setor?: string;
  nome?: string;
  protocolo?: string;
  consumidor?: string;
  situacao?: string;
}

const contem = (valor: string | null, busca: string | undefined) =>
  !busca || (valor ?? "").toLowerCase().includes(busca.toLowerCase());

/**
 * Busca no registry. Sem filtro de situacao, os DESATIVADOS ficam de fora:
 * continuam no banco para o setor reativar, mas ninguem deve fazer o bind.
 */
export async function buscarServicos(filtros: Filtros, base: string): Promise<Servico[]> {
  const where: Prisma.ServicoRegistradoWhereInput = {
    ...(filtros.setor ? { setor: filtros.setor.toLowerCase() } : {}),
    ...(filtros.protocolo ? { protocolo: filtros.protocolo.toUpperCase() } : {}),
    ...(filtros.situacao ? { situacao: filtros.situacao.toUpperCase() } : { situacao: { not: "DESATIVADO" } }),
  };
  const doBanco = await prisma.servicoRegistrado.findMany({ where });

  const todos: Servico[] = [
    ...servicosDoFinanceiro(base),
    ...doBanco.map((s) => ({
      setor: s.setor,
      nome: s.nome,
      versao: s.versao,
      protocolo: s.protocolo as Protocolo,
      endpoint: s.endpoint,
      operacao: s.operacao,
      contrato: s.contrato,
      consumidor: s.consumidor,
      descricao: s.descricao,
      situacao: s.situacao as Situacao,
      publicadoEm: s.publicadoEm.toISOString(),
      atualizadoEm: s.atualizadoEm.toISOString(),
    })),
  ];

  return todos
    .filter(
      (s) =>
        (!filtros.setor || s.setor === filtros.setor.toLowerCase()) &&
        (!filtros.protocolo || s.protocolo === filtros.protocolo.toUpperCase()) &&
        (filtros.situacao ? s.situacao === filtros.situacao.toUpperCase() : s.situacao !== "DESATIVADO") &&
        contem(s.nome, filtros.nome) &&
        contem(s.consumidor, filtros.consumidor)
    )
    .sort(
      (a, b) =>
        a.setor.localeCompare(b.setor) ||
        a.nome.localeCompare(b.nome, "pt-BR") ||
        a.versao.localeCompare(b.versao) ||
        a.protocolo.localeCompare(b.protocolo)
    );
}

// ===================== Publish =====================

export type ResultadoPublicacao = { ok: true; servico: Servico; criado: boolean } | { ok: false; erros: string[] };

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Publica ou atualiza um servico do setor. A chave do servico e setor + nome
 * + versao + protocolo: publicar de novo atualiza; versao nova e outro
 * servico, e a anterior continua no registry ate o setor depreciar ou
 * desativar.
 */
export async function publicarServico(setor: string, corpo: unknown): Promise<ResultadoPublicacao> {
  const c = (corpo !== null && typeof corpo === "object" && !Array.isArray(corpo) ? corpo : {}) as Record<string, unknown>;
  const dados = {
    nome: texto(c.nome),
    versao: texto(c.versao),
    protocolo: texto(c.protocolo).toUpperCase(),
    endpoint: texto(c.endpoint),
    operacao: texto(c.operacao) || null,
    contrato: texto(c.contrato) || null,
    consumidor: texto(c.consumidor).toLowerCase() || null,
    descricao: texto(c.descricao),
    situacao: (texto(c.situacao) || "ATIVO").toUpperCase(),
  };

  const erros: string[] = [];
  if (!dados.nome || dados.nome.length > 120) erros.push("nome: obrigatório, até 120 caracteres.");
  if (!REGEX_VERSAO.test(dados.versao)) erros.push('versao: obrigatória, no formato "1", "1.0" ou "1.0.2".');
  if (!PROTOCOLOS.includes(dados.protocolo as Protocolo)) erros.push("protocolo: SOCKET, REST ou SOAP.");
  if (!SITUACOES.includes(dados.situacao as Situacao)) erros.push("situacao: ATIVO, DEPRECIADO ou DESATIVADO.");
  if (!dados.endpoint || dados.endpoint.length > MAX_TEXTO) erros.push("endpoint: obrigatório, até 300 caracteres.");
  else if (dados.protocolo !== "SOCKET" && !/^https?:\/\/\S+$/.test(dados.endpoint)) {
    erros.push("endpoint: em REST e SOAP, uma URL http(s).");
  }
  if (dados.contrato && (dados.contrato.length > MAX_TEXTO || !/^https?:\/\/\S+$/.test(dados.contrato))) {
    erros.push("contrato: uma URL http(s) do XSD, WSDL ou documentação, até 300 caracteres.");
  }
  if (dados.operacao && dados.operacao.length > 120) erros.push("operacao: até 120 caracteres.");
  if (dados.consumidor && dados.consumidor.length > 120) erros.push("consumidor: até 120 caracteres.");
  if (dados.descricao.length > 1000) erros.push("descricao: até 1000 caracteres.");
  if (erros.length > 0) return { ok: false, erros };

  const chave = { setor, nome: dados.nome, versao: dados.versao, protocolo: dados.protocolo };
  const existente = await prisma.servicoRegistrado.findUnique({ where: { setor_nome_versao_protocolo: chave } });
  const salvo = await prisma.servicoRegistrado.upsert({
    where: { setor_nome_versao_protocolo: chave },
    create: { ...dados, setor },
    update: dados,
  });

  return {
    ok: true,
    criado: !existente,
    servico: {
      ...dados,
      setor,
      protocolo: salvo.protocolo as Protocolo,
      situacao: salvo.situacao as Situacao,
      publicadoEm: salvo.publicadoEm.toISOString(),
      atualizadoEm: salvo.atualizadoEm.toISOString(),
    },
  };
}

/** Remove um servico do setor. false se nao existia. */
export async function removerServico(
  setor: string,
  { nome, versao, protocolo }: { nome: string; versao: string; protocolo: string }
): Promise<boolean> {
  const { count } = await prisma.servicoRegistrado.deleteMany({
    where: { setor, nome, versao, protocolo: protocolo.toUpperCase() },
  });
  return count > 0;
}
