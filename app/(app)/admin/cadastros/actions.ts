"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { TipoParceiro } from "@prisma/client";

function campoOpcional(formData: FormData, nome: string): string | null {
  const valor = String(formData.get(nome) ?? "").trim();
  return valor || null;
}

export async function criarParceiroAction(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "") as TipoParceiro;
  if (!nome || (tipo !== "CLIENTE" && tipo !== "FORNECEDOR")) return;

  await prisma.parceiro.create({
    data: {
      nome,
      tipo,
      documento: campoOpcional(formData, "documento"),
      email: campoOpcional(formData, "email"),
      telefone: campoOpcional(formData, "telefone"),
    },
  });

  revalidatePath("/admin/cadastros");
}

export async function editarParceiroAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!id || !nome) return;

  await prisma.parceiro.update({
    where: { id },
    data: {
      nome,
      documento: campoOpcional(formData, "documento"),
      email: campoOpcional(formData, "email"),
      telefone: campoOpcional(formData, "telefone"),
    },
  });

  revalidatePath("/admin/cadastros");
}

export async function alternarAtivoParceiroAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const parceiro = await prisma.parceiro.findUnique({ where: { id } });
  if (!parceiro) return;

  await prisma.parceiro.update({ where: { id }, data: { ativo: !parceiro.ativo } });
  revalidatePath("/admin/cadastros");
}
