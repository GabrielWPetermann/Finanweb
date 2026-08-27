import { prisma } from "@/lib/db";
import { criarParceiroAction } from "./actions";
import { ListaParceiros, type ParceiroLinha } from "./lista-parceiros";

function paraLinhas(parceiros: { id: string; nome: string; documento: string | null; email: string | null; telefone: string | null; ativo: boolean }[]): ParceiroLinha[] {
  return parceiros.map((p) => ({
    id: p.id,
    nome: p.nome,
    documento: p.documento ?? "",
    email: p.email ?? "",
    telefone: p.telefone ?? "",
    ativo: p.ativo,
  }));
}

export default async function CadastrosPage() {
  const [clientes, fornecedores] = await Promise.all([
    prisma.parceiro.findMany({ where: { tipo: "CLIENTE" }, orderBy: { nome: "asc" } }),
    prisma.parceiro.findMany({ where: { tipo: "FORNECEDOR" }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div>
      <h1>Cadastros</h1>
      <p className="subtitulo">Clientes e fornecedores usados em Recebimentos, Pagamentos e nas importações de CSV.</p>

      <div className="grid-2">
        <section>
          <h2>Clientes</h2>
          <ListaParceiros parceiros={paraLinhas(clientes)} />
          <form action={criarParceiroAction} className="card">
            <input type="hidden" name="tipo" value="CLIENTE" />
            <label>
              Nome
              <input type="text" name="nome" required />
            </label>
            <label>
              Documento (CNPJ/CPF)
              <input type="text" name="documento" />
            </label>
            <label>
              E-mail
              <input type="text" name="email" />
            </label>
            <label>
              Telefone
              <input type="text" name="telefone" />
            </label>
            <button type="submit">Adicionar cliente</button>
          </form>
        </section>

        <section>
          <h2>Fornecedores</h2>
          <ListaParceiros parceiros={paraLinhas(fornecedores)} />
          <form action={criarParceiroAction} className="card">
            <input type="hidden" name="tipo" value="FORNECEDOR" />
            <label>
              Nome
              <input type="text" name="nome" required />
            </label>
            <label>
              Documento (CNPJ/CPF)
              <input type="text" name="documento" />
            </label>
            <label>
              E-mail
              <input type="text" name="email" />
            </label>
            <label>
              Telefone
              <input type="text" name="telefone" />
            </label>
            <button type="submit">Adicionar fornecedor</button>
          </form>
        </section>
      </div>
    </div>
  );
}
