"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";
import { lerStatus, paraNumero, paraDataInput } from "@/lib/forms";
import { resolverParceiroFormulario } from "@/lib/parceiros";
import { avisarPagamento } from "@/lib/socket/avisos";

// Recebe a transacao: chamada pelo prisma de fora, ela pediria outra conexao
// enquanto a transacao segura a dela, e com o pool cheio as duas se esperam.
async function resolverCategoriaSaida(db: Prisma.TransactionClient, nome: string) {
  return db.categoria.upsert({
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
  const status = lerStatus(formData.get("status"));
  const dataPagamento = formData.get("dataPagamento");

  if (!categoriaNome || !formaPagamento || !status || !dataPagamento) return;

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

    const categoria = await resolverCategoriaSaida(tx, categoriaNome);

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
  const dataPagamento = formData.get("dataPagamento");

  // O status de antes decide se a edicao baixou uma despesa vinda de outro
  // setor, que entao recebe o aviso de pagamento.
  const anterior = await prisma.despesaAgrupada.findUnique({ where: { id }, select: { status: true } });
  const status = lerStatus(formData.get("status"), anterior?.status);

  if (!id || !anterior || !categoriaNome || !formaPagamento || !status || !dataPagamento) return;

  const valor = paraNumero(formData.get("valor"));

  const atualizada = await prisma.$transaction(async (tx) => {
    const fornecedorId = await resolverParceiroFormulario(
      tx,
      formData,
      "fornecedorId",
      "fornecedorNovoNome",
      "FORNECEDOR"
    );
    if (!fornecedorId) return null;

    const categoria = await resolverCategoriaSaida(tx, categoriaNome);

    return tx.despesaAgrupada.update({
      where: { id },
      data: {
        fornecedorId,
        categoriaId: categoria.id,
        valor,
        formaPagamento,
        dataPagamento: paraDataInput(dataPagamento),
        status,
      },
      include: { fornecedor: { select: { nome: true, documento: true } } },
    });
  });

  if (anterior && atualizada) await avisarPagamento(anterior.status, atualizada, usuario.username);

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
