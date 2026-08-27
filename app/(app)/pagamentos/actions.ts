"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";
import { paraNumero, paraDataInput } from "@/lib/forms";
import { resolverParceiroFormulario } from "@/lib/parceiros";

async function resolverCategoriaSaida(nome: string) {
  return prisma.categoria.upsert({
    where: { nome_tipo: { nome, tipo: "SAIDA" } },
    create: { nome, tipo: "SAIDA" },
    update: {},
  });
}

export async function criarPagamentoAction(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return;

  const categoriaNome = String(formData.get("categoria") ?? "").trim();
  const formaPagamento = String(formData.get("formaPagamento") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() || "CONFIRMADO";
  const dataPagamento = formData.get("dataPagamento");

  if (!categoriaNome || !formaPagamento || !dataPagamento) return;

  const valor = paraNumero(formData.get("valor"));

  await prisma.$transaction(async (tx) => {
    const fornecedorId = await resolverParceiroFormulario(
      tx,
      formData,
      "fornecedorId",
      "fornecedorNovoNome",
      "FORNECEDOR"
    );
    if (!fornecedorId) return;

    const categoria = await resolverCategoriaSaida(categoriaNome);

    await tx.despesaAgrupada.create({
      data: {
        importacaoId: null,
        fornecedorId,
        categoriaId: categoria.id,
        valor,
        formaPagamento,
        dataPagamento: paraDataInput(dataPagamento),
        status,
      },
    });
  });

  revalidatePath("/pagamentos");
  revalidatePath("/");
}

export async function editarPagamentoAction(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return;

  const id = String(formData.get("id") ?? "");
  const categoriaNome = String(formData.get("categoria") ?? "").trim();
  const formaPagamento = String(formData.get("formaPagamento") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const dataPagamento = formData.get("dataPagamento");

  if (!id || !categoriaNome || !formaPagamento || !status || !dataPagamento) return;

  const valor = paraNumero(formData.get("valor"));

  await prisma.$transaction(async (tx) => {
    const fornecedorId = await resolverParceiroFormulario(
      tx,
      formData,
      "fornecedorId",
      "fornecedorNovoNome",
      "FORNECEDOR"
    );
    if (!fornecedorId) return;

    const categoria = await resolverCategoriaSaida(categoriaNome);

    await tx.despesaAgrupada.update({
      where: { id },
      data: {
        fornecedorId,
        categoriaId: categoria.id,
        valor,
        formaPagamento,
        dataPagamento: paraDataInput(dataPagamento),
        status,
      },
    });
  });

  revalidatePath("/pagamentos");
  revalidatePath("/");
}

export async function excluirPagamentoAction(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.role !== "ADMIN") return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.despesaAgrupada.delete({ where: { id } });

  revalidatePath("/pagamentos");
  revalidatePath("/");
}
