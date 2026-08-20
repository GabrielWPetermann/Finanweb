"use server";

import { redirect } from "next/navigation";
import { login, criarSessao } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  const usuario = await login(username, senha);
  if (!usuario) {
    redirect("/login?erro=1");
  }

  await criarSessao(usuario.id);
  redirect("/");
}
