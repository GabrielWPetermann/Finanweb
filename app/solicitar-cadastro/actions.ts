"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export async function solicitarCadastroAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();

  if (!email || !senha || !whatsapp) {
    redirect(`/solicitar-cadastro?erro=${encodeURIComponent("Preencha e-mail, senha e WhatsApp.")}`);
  }

  const existente = await prisma.usuario.findUnique({ where: { username: email } });
  if (existente) {
    redirect(`/solicitar-cadastro?erro=${encodeURIComponent("Já existe um cadastro com esse e-mail.")}`);
  }

  await prisma.usuario.create({
    data: {
      username: email,
      senha,
      whatsapp,
      role: "USER",
      ativo: true,
      aprovado: false,
    },
  });

  redirect("/login?solicitado=1");
}
