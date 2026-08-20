import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";
import { criarPagamentoAction } from "./actions";
import { TabelaPagamentos, type PagamentoLinha } from "./tabela-pagamentos";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function paraInputDate(data: Date) {
  return data.toISOString().slice(0, 10);
}

interface Props {
  searchParams: Promise<{ categoriaId?: string; fornecedor?: string; inicio?: string; fim?: string }>;
}

export default async function PagamentosPage({ searchParams }: Props) {
  const { categoriaId, fornecedor, inicio, fim } = await searchParams;

  const usuario = await getUsuarioAtual();
  const isAdmin = usuario?.role === "ADMIN";

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

  const linhas: PagamentoLinha[] = despesas.map((d) => ({
    id: d.id,
    fornecedor: d.fornecedor,
    categoriaNome: d.categoria.nome,
    valor: d.valor.toString(),
    formaPagamento: d.formaPagamento,
    dataPagamento: paraInputDate(d.dataPagamento),
    status: d.status,
    valorFormatado: formatarMoeda(Number(d.valor)),
    dataFormatada: formatarData(d.dataPagamento),
  }));

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

      <TabelaPagamentos despesas={linhas} categoriasNomes={categorias.map((c) => c.nome)} isAdmin={isAdmin} />

      <h2>Novo pagamento</h2>
      <p className="subtitulo">Lança um pagamento direto, sem precisar importar um CSV.</p>
      <form action={criarPagamentoAction} className="card card-formulario">
        <div className="grid-2">
          <label>
            Fornecedor
            <input type="text" name="fornecedor" required />
          </label>
          <label>
            Categoria
            <input type="text" name="categoria" list="categorias-saida-novo" required />
          </label>
          <label>
            Valor
            <input type="text" name="valor" placeholder="500.00" required />
          </label>
          <label>
            Forma de pagamento
            <input type="text" name="formaPagamento" placeholder="Pix, Boleto..." required />
          </label>
          <label>
            Data
            <input type="date" name="dataPagamento" required />
          </label>
          <label>
            Status
            <input type="text" name="status" placeholder="CONFIRMADO" />
          </label>
        </div>
        <datalist id="categorias-saida-novo">
          {categorias.map((c) => (
            <option key={c.id} value={c.nome} />
          ))}
        </datalist>
        <button type="submit">Lançar</button>
      </form>
    </div>
  );
}
