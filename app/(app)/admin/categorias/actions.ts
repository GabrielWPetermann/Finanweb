"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { TipoImportacao } from "@prisma/client";

export async function criarCategoriaAction(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "") as TipoImportacao;
  if (!nome || (tipo !== "ENTRADA" && tipo !== "SAIDA")) return;

  await prisma.categoria.upsert({
    where: { nome_tipo: { nome, tipo } },
    create: { nome, tipo },
    update: {},
  });
  revalidatePath("/admin/categorias");
}

export async function renomearCategoriaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!id || !nome) return;

  await prisma.categoria.update({ where: { id }, data: { nome } });
  revalidatePath("/admin/categorias");
}
