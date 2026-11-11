"use server";

// Governanca do registry: chaves dos setores e situacao dos servicos
// publicados. So admin; a pagina ja e protegida pelo layout de /admin, mas a
// action pode ser chamada direto, entao confere de novo.

import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gerarChave, REGEX_SETOR, setorReservado, SITUACOES } from "@/lib/registro";

export interface ResultadoChave {
  setor?: string;
  chave?: string;
  erro?: string;
}

async function ehAdmin(): Promise<boolean> {
  const usuario = await getUsuarioAtual();
  return usuario?.role === "ADMIN";
}

export async function gerarChaveAction(_anterior: ResultadoChave, formData: FormData): Promise<ResultadoChave> {
  if (!(await ehAdmin())) return { erro: "Só administradores." };

  const setor = String(formData.get("setor") ?? "").trim().toLowerCase();
  if (!REGEX_SETOR.test(setor)) {
    return { erro: "Setor: o nome no servidor da turma, em minúsculas (ex.: vendas, compras, rh)." };
  }
  if (setorReservado(setor)) return { erro: `"${setor}" é o próprio Financeiro.` };

  const chave = await gerarChave(setor);
  revalidatePath("/admin/registro");
  return { setor, chave };
}

export async function removerSetorAction(formData: FormData) {
  if (!(await ehAdmin())) return;
  const setor = String(formData.get("setor") ?? "");
  // Cascade: os servicos publicados com a chave saem junto.
  await prisma.chaveRegistro.deleteMany({ where: { setor } });
  revalidatePath("/admin/registro");
}

export async function mudarSituacaoAction(formData: FormData) {
  if (!(await ehAdmin())) return;
  const id = String(formData.get("id") ?? "");
  const situacao = String(formData.get("situacao") ?? "");
  if (!id || !SITUACOES.includes(situacao as (typeof SITUACOES)[number])) return;
  await prisma.servicoRegistrado.update({ where: { id }, data: { situacao } });
  revalidatePath("/admin/registro");
}
