// Resolucao do cadastro de Cliente/Fornecedor (modelo Parceiro).
//
// Duas formas de resolver, dependendo de onde o dado vem:
// - CSV: casa pelo campo "documento" (CNPJ/CPF), cria se nao existir.
// - Formularios (Recebimentos/Pagamentos): usuario escolhe um id existente
//   no seletor, ou digita um nome novo pra criacao rapida (sem documento).

import type { Prisma, TipoParceiro } from "@prisma/client";

type Cliente = Prisma.TransactionClient;

export async function resolverParceiroPorDocumento(
  db: Cliente,
  nome: string,
  documento: string,
  tipo: TipoParceiro
) {
  const existente = await db.parceiro.findFirst({ where: { documento, tipo } });
  if (existente) return existente;
  return db.parceiro.create({ data: { nome, documento, tipo } });
}

export async function resolverParceiroFormulario(
  db: Cliente,
  formData: FormData,
  campoId: string,
  campoNomeNovo: string,
  tipo: TipoParceiro
): Promise<string | null> {
  const nomeNovo = String(formData.get(campoNomeNovo) ?? "").trim();
  if (nomeNovo) {
    const criado = await db.parceiro.create({ data: { nome: nomeNovo, tipo } });
    return criado.id;
  }
  const id = String(formData.get(campoId) ?? "").trim();
  return id || null;
}
