import Link from "next/link";
import { prisma } from "@/lib/db";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

interface Props {
  searchParams: Promise<{ categoriaId?: string; fornecedor?: string; inicio?: string; fim?: string }>;
}

export default async function PagamentosPage({ searchParams }: Props) {
  const { categoriaId, fornecedor, inicio, fim } = await searchParams;

  const categorias = await prisma.categoria.findMany({
    where: { tipo: "SAIDA", ativo: true },
    orderBy: { nome: "asc" },
  });

  const despesas = await prisma.despesaAgrupada.findMany({
    where: {
      categoriaId: categoriaId || undefined,
      fornecedor: fornecedor ? { contains: fornecedor, mode: "insensitive" } : undefined,
      dataPagamento: {
        gte: inicio ? new Date(inicio) : undefined,
        lte: fim ? new Date(`${fim}T23:59:59.999Z`) : undefined,
      },
    },
    include: { categoria: true },
    orderBy: { dataPagamento: "desc" },
    take: 200,
  });

  return (
    <div>
      <h1>Pagamentos</h1>

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
          Fornecedor
          <input type="text" name="fornecedor" defaultValue={fornecedor ?? ""} placeholder="Buscar fornecedor..." />
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
        <Link href="/pagamentos" className="link-button">
          Limpar
        </Link>
      </form>

      <table>
        <thead>
          <tr>
            <th>Fornecedor</th>
            <th>Categoria</th>
            <th>Data</th>
            <th>Forma de pagamento</th>
            <th>Valor</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {despesas.map((d) => (
            <tr key={d.id}>
              <td>{d.fornecedor}</td>
              <td>{d.categoria.nome}</td>
              <td>{formatarData(d.dataPagamento)}</td>
              <td>{d.formaPagamento}</td>
              <td>{formatarMoeda(Number(d.valor))}</td>
              <td>{d.status}</td>
            </tr>
          ))}
          {despesas.length === 0 && (
            <tr>
              <td colSpan={6}>Nenhum registro encontrado.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
