"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export async function solicitarCadastroAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();

  if (!username || !senha || !whatsapp) {
    redirect(`/solicitar-cadastro?erro=${encodeURIComponent("Preencha usuário, senha e WhatsApp.")}`);
  }

  const existente = await prisma.usuario.findUnique({ where: { username } });
  if (existente) {
    redirect(`/solicitar-cadastro?erro=${encodeURIComponent("Já existe um cadastro com esse usuário.")}`);
  }

  await prisma.usuario.create({
    data: {
      username,
      senha,
      whatsapp,
      role: "USER",
      ativo: true,
      aprovado: false,
    },
  });

  redirect("/login?solicitado=1");
}
