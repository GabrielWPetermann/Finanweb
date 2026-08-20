import { prisma } from "@/lib/db";
import { criarCategoriaAction } from "./actions";
import { ListaCategorias } from "./lista-categorias";

export default async function CategoriasPage() {
  const [entrada, saida] = await Promise.all([
    prisma.categoria.findMany({ where: { tipo: "ENTRADA" }, orderBy: { nome: "asc" } }),
    prisma.categoria.findMany({ where: { tipo: "SAIDA" }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div>
      <h1>Categorias</h1>

      <div className="grid-2">
        <section>
          <h2>Entrada</h2>
          <ListaCategorias categorias={entrada} />
          <form action={criarCategoriaAction} className="linha-form">
            <input type="hidden" name="tipo" value="ENTRADA" />
            <input type="text" name="nome" placeholder="Nova categoria de entrada" required />
            <button type="submit">Adicionar</button>
          </form>
        </section>

        <section>
          <h2>Saída</h2>
          <ListaCategorias categorias={saida} />
          <form action={criarCategoriaAction} className="linha-form">
            <input type="hidden" name="tipo" value="SAIDA" />
            <input type="text" name="nome" placeholder="Nova categoria de saída" required />
            <button type="submit">Adicionar</button>
          </form>
        </section>
      </div>
    </div>
  );
}
