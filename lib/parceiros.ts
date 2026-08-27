// Resolucao do cadastro de Cliente/Fornecedor (modelo Parceiro).
//
// Duas formas de resolver, dependendo de onde o dado vem:
// - CSV: casa pelo campo "documento" (CNPJ/CPF), cria se nao existir.
// - Formularios (Recebimentos/Pagamentos): usuario escolhe um id existente
//   no seletor, ou digita um nome novo pra criacao rapida (sem documento).

import type { Prisma, TipoParceiro } from "@prisma/client";
import type { CadastroRegistro } from "@/lib/parsers/cadastro";

type Cliente = Prisma.TransactionClient;

export type ResultadoImportacaoParceiro = "criado" | "atualizado";

export async function resolverParceiroPorDocumento(
  db: Cliente,
  nome: string,
  documento: string,
  tipo: TipoParceiro
) {
  const existente = await db.parceiro.findFirst({ where: { documento, tipo } });
  if (existente) return existente;
  return db.parceiro.create({ data: { nome, documento, tipo } });
}

// Usado pela importacao de CSV de Cadastro (Clientes/Fornecedores): ao
// contrario de resolverParceiroPorDocumento (que so cria se nao existir),
// aqui a intencao e carregar/atualizar dados de contato -- se o documento ja
// existir, atualiza nome/email/telefone; senao, cria um novo cadastro.
export async function importarParceiroCadastro(
  db: Cliente,
  registro: CadastroRegistro,
  tipo: TipoParceiro
): Promise<ResultadoImportacaoParceiro> {
  if (registro.documento) {
    const existente = await db.parceiro.findFirst({ where: { documento: registro.documento, tipo } });
    if (existente) {
      await db.parceiro.update({
        where: { id: existente.id },
        data: {
          nome: registro.nome,
          email: registro.email || existente.email,
          telefone: registro.telefone || existente.telefone,
        },
      });
      return "atualizado";
    }
  }

  await db.parceiro.create({
    data: {
      nome: registro.nome,
      documento: registro.documento || null,
      email: registro.email || null,
      telefone: registro.telefone || null,
      tipo,
    },
  });
  return "criado";
}

export async function resolverParceiroFormulario(
  db: Cliente,
  formData: FormData,
  campoId: string,
  campoNomeNovo: string,
  tipo: TipoParceiro
): Promise<string | null> {
  const nomeNovo = String(formData.get(campoNomeNovo) ?? "").trim();
  if (nomeNovo) {
    const criado = await db.parceiro.create({ data: { nome: nomeNovo, tipo } });
    return criado.id;
  }
  const id = String(formData.get(campoId) ?? "").trim();
  return id || null;
}
