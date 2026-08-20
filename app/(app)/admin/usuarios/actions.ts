"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function criarUsuarioAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const nomeEquipe = String(formData.get("nomeEquipe") ?? "").trim();
  const role = String(formData.get("role") ?? "USER") as "ADMIN" | "USER";

  if (!username || !senha || !nomeEquipe) return;

  await prisma.usuario.create({ data: { username, senha, nomeEquipe, role } });
  revalidatePath("/admin/usuarios");
}

export async function alternarAtivoAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) return;

  await prisma.usuario.update({ where: { id }, data: { ativo: !usuario.ativo } });
  revalidatePath("/admin/usuarios");
}
