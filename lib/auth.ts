import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "sf_sessao";

// Autenticacao deliberadamente simples: sem hash, sem JWT, sem expiracao de
// sessao. Decisao explicita do projeto -- nao usar em producao real.
export async function login(username: string, senha: string) {
  const usuario = await prisma.usuario.findUnique({ where: { username } });
  if (!usuario || !usuario.ativo || usuario.senha !== senha) {
    return null;
  }
  return usuario;
}

export async function criarSessao(usuarioId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, usuarioId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function encerrarSessao() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getUsuarioAtual() {
  const store = await cookies();
  const id = store.get(COOKIE_NAME)?.value;
  if (!id) return null;

  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario || !usuario.ativo) return null;

  return usuario;
}
