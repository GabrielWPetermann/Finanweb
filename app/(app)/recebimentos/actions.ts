"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";
import { paraNumero, paraDataInput } from "@/lib/forms";
import { resolverParceiroFormulario } from "@/lib/parceiros";

async function resolverCategoriaEntrada(nome: string) {
  return prisma.categoria.upsert({
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
  const status = String(formData.get("status") ?? "").trim() || "CONFIRMADO";
  const dataPedido = formData.get("dataPedido");

  if (!categoriaNome || !formaPagamento || !dataPedido) return;

  const valorTotal = paraNumero(formData.get("valorTotal"));
  const subtotal = paraNumero(formData.get("subtotal"), valorTotal);
  const descontoPercentual = paraNumero(formData.get("descontoPercentual"));
  const descontoValor = paraNumero(formData.get("descontoValor"));
  const frete = paraNumero(formData.get("frete"));

  await prisma.$transaction(async (tx) => {
    const clienteId = await resolverParceiroFormulario(tx, formData, "clienteId", "clienteNovoNome", "CLIENTE");
    if (!clienteId) return;

    const categoria = await resolverCategoriaEntrada(categoriaNome);

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
  const status = String(formData.get("status") ?? "").trim();
  const dataPedido = formData.get("dataPedido");

  if (!id || !categoriaNome || !formaPagamento || !status || !dataPedido) return;

  const valorTotal = paraNumero(formData.get("valorTotal"));
  const subtotal = paraNumero(formData.get("subtotal"), valorTotal);
  const descontoPercentual = paraNumero(formData.get("descontoPercentual"));
  const descontoValor = paraNumero(formData.get("descontoValor"));
  const frete = paraNumero(formData.get("frete"));

  await prisma.$transaction(async (tx) => {
    const clienteId = await resolverParceiroFormulario(tx, formData, "clienteId", "clienteNovoNome", "CLIENTE");
    if (!clienteId) return;

    const categoria = await resolverCategoriaEntrada(categoriaNome);

    await tx.pedidoAgrupado.update({
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
    });
  });

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
