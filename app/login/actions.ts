"use server";

import { redirect } from "next/navigation";
import { login, criarSessao } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  const resultado = await login(username, senha);
  if (!resultado.ok) {
    redirect(`/login?erro=${resultado.motivo}`);
  }

  await criarSessao(resultado.usuario.id);
  redirect("/");
}
