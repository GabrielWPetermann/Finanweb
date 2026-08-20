import Link from "next/link";
import { prisma } from "@/lib/db";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

interface Props {
  searchParams: Promise<{ categoriaId?: string; cliente?: string; inicio?: string; fim?: string }>;
}

export default async function RecebimentosPage({ searchParams }: Props) {
  const { categoriaId, cliente, inicio, fim } = await searchParams;

  const categorias = await prisma.categoria.findMany({
    where: { tipo: "ENTRADA", ativo: true },
    orderBy: { nome: "asc" },
  });

  const pedidos = await prisma.pedidoAgrupado.findMany({
    where: {
      categoriaId: categoriaId || undefined,
      cliente: cliente ? { contains: cliente, mode: "insensitive" } : undefined,
      dataPedido: {
        gte: inicio ? new Date(inicio) : undefined,
        lte: fim ? new Date(`${fim}T23:59:59.999Z`) : undefined,
      },
    },
    include: { categoria: true },
    orderBy: { dataPedido: "desc" },
    take: 200,
  });

  return (
    <div>
      <h1>Recebimentos</h1>

      <form method="get" className="filtros">
        <label>
          Categoria
          <select name="categoriaId" defaultValue={categoriaId ?? ""}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cliente
          <input type="text" name="cliente" defaultValue={cliente ?? ""} placeholder="Buscar cliente..." />
        </label>
        <label>
          De
          <input type="date" name="inicio" defaultValue={inicio ?? ""} />
        </label>
        <label>
          Até
          <input type="date" name="fim" defaultValue={fim ?? ""} />
        </label>
        <button type="submit">Filtrar</button>
        <Link href="/recebimentos" className="link-button">
          Limpar
        </Link>
      </form>

      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Categoria</th>
            <th>Data</th>
            <th>Forma de pagamento</th>
            <th>Valor total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => (
            <tr key={p.id}>
              <td>{p.cliente}</td>
              <td>{p.categoria.nome}</td>
              <td>{formatarData(p.dataPedido)}</td>
              <td>{p.formaPagamento}</td>
              <td>{formatarMoeda(Number(p.valorTotal))}</td>
              <td>{p.status}</td>
            </tr>
          ))}
          {pedidos.length === 0 && (
            <tr>
              <td colSpan={6}>Nenhum registro encontrado.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
