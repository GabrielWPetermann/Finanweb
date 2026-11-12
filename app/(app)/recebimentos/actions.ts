"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";
import { lerStatus, paraNumero, paraDataInput } from "@/lib/forms";
import { resolverParceiroFormulario } from "@/lib/parceiros";
import { avisarRecebimento } from "@/lib/socket/avisos";

// Recebe a transacao: chamada pelo prisma de fora, ela pediria outra conexao
// enquanto a transacao segura a dela, e com o pool cheio as duas se esperam.
async function resolverCategoriaEntrada(db: Prisma.TransactionClient, nome: string) {
  return db.categoria.upsert({
    where: { nome_tipo: { nome, tipo: "ENTRADA" } },
    create: { nome, tipo: "ENTRADA" },
    update: {},
  });
}

export async function criarRecebimentoAction(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return;

  const categoriaNome = String(formData.get("categoria") ?? "").trim();
  const formaPagamento = String(formData.get("formaPagamento") ?? "").trim();
  const status = lerStatus(formData.get("status"));
  const dataPedido = formData.get("dataPedido");

  if (!categoriaNome || !formaPagamento || !status || !dataPedido) return;

  const valorTotal = paraNumero(formData.get("valorTotal"));
  const subtotal = paraNumero(formData.get("subtotal"), valorTotal);
  const descontoPercentual = paraNumero(formData.get("descontoPercentual"));
  const descontoValor = paraNumero(formData.get("descontoValor"));
  const frete = paraNumero(formData.get("frete"));

  await prisma.$transaction(async (tx) => {
    const clienteId = await resolverParceiroFormulario(tx, formData, "clienteId", "clienteNovoNome", "CLIENTE");
    if (!clienteId) return;

    const categoria = await resolverCategoriaEntrada(tx, categoriaNome);

    await tx.pedidoAgrupado.create({
      data: {
        importacaoId: null,
        clienteId,
        categoriaId: categoria.id,
        subtotal,
        descontoPercentual,
        descontoValor,
        frete,
        valorTotal,
        formaPagamento,
        dataPedido: paraDataInput(dataPedido),
        status,
      },
    });
  });

  revalidatePath("/recebimentos");
  revalidatePath("/");
}

export async function editarRecebimentoAction(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return;

  const id = String(formData.get("id") ?? "");
  const categoriaNome = String(formData.get("categoria") ?? "").trim();
  const formaPagamento = String(formData.get("formaPagamento") ?? "").trim();
  const dataPedido = formData.get("dataPedido");
  const atual = await prisma.pedidoAgrupado.findUnique({ where: { id }, select: { status: true } });
  const status = lerStatus(formData.get("status"), atual?.status);

  if (!id || !atual || !categoriaNome || !formaPagamento || !status || !dataPedido) return;

  const valorTotal = paraNumero(formData.get("valorTotal"));
  const subtotal = paraNumero(formData.get("subtotal"), valorTotal);
  const descontoPercentual = paraNumero(formData.get("descontoPercentual"));
  const descontoValor = paraNumero(formData.get("descontoValor"));
  const frete = paraNumero(formData.get("frete"));

  const atualizado = await prisma.$transaction(async (tx) => {
    const clienteId = await resolverParceiroFormulario(tx, formData, "clienteId", "clienteNovoNome", "CLIENTE");
    if (!clienteId) return null;

    const categoria = await resolverCategoriaEntrada(tx, categoriaNome);

    return tx.pedidoAgrupado.update({
      where: { id },
      data: {
        clienteId,
        categoriaId: categoria.id,
        subtotal,
        descontoPercentual,
        descontoValor,
        frete,
        valorTotal,
        formaPagamento,
        dataPedido: paraDataInput(dataPedido),
        status,
      },
      include: { cliente: { select: { nome: true, documento: true } } },
    });
  });

  // Venda vinda de outro setor que foi recebida ou cancelada aqui: o setor
  // recebe o aviso de recebimento.
  if (atualizado) await avisarRecebimento(atual.status, atualizado, usuario.username);

  revalidatePath("/recebimentos");
  revalidatePath("/");
}

export async function excluirRecebimentoAction(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.role !== "ADMIN") return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.pedidoAgrupado.delete({ where: { id } });

  revalidatePath("/recebimentos");
  revalidatePath("/");
}
