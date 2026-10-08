import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";
import { criarRecebimentoAction } from "./actions";
import { TabelaRecebimentos, type RecebimentoLinha } from "./tabela-recebimentos";
import { SeletorParceiro } from "../_components/seletor-parceiro";

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
  searchParams: Promise<{ categoriaId?: string; cliente?: string; inicio?: string; fim?: string }>;
}

export default async function RecebimentosPage({ searchParams }: Props) {
  const { categoriaId, cliente, inicio, fim } = await searchParams;

  const usuario = await getUsuarioAtual();
  const isAdmin = usuario?.role === "ADMIN";

  const [categorias, clientes] = await Promise.all([
    prisma.categoria.findMany({ where: { tipo: "ENTRADA", ativo: true }, orderBy: { nome: "asc" } }),
    prisma.parceiro.findMany({ where: { tipo: "CLIENTE", ativo: true }, orderBy: { nome: "asc" } }),
  ]);

  const pedidos = await prisma.pedidoAgrupado.findMany({
    where: {
      categoriaId: categoriaId || undefined,
      cliente: cliente ? { nome: { contains: cliente, mode: "insensitive" } } : undefined,
      dataPedido: {
        gte: inicio ? new Date(inicio) : undefined,
        lte: fim ? new Date(`${fim}T23:59:59.999Z`) : undefined,
      },
    },
    include: { categoria: true, cliente: true },
    orderBy: { dataPedido: "desc" },
    take: 200,
  });

  const linhas: RecebimentoLinha[] = pedidos.map((p) => ({
    id: p.id,
    clienteId: p.clienteId,
    clienteNome: p.cliente.nome,
    categoriaNome: p.categoria.nome,
    subtotal: p.subtotal.toString(),
    descontoPercentual: p.descontoPercentual.toString(),
    descontoValor: p.descontoValor.toString(),
    frete: p.frete.toString(),
    valorTotal: p.valorTotal.toString(),
    formaPagamento: p.formaPagamento,
    dataPedido: paraInputDate(p.dataPedido),
    status: p.status,
    valorFormatado: formatarMoeda(Number(p.valorTotal)),
    dataFormatada: formatarData(p.dataPedido),
  }));

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

      <TabelaRecebimentos
        pedidos={linhas}
        categoriasNomes={categorias.map((c) => c.nome)}
        clientes={clientes.map((c) => ({ id: c.id, nome: c.nome }))}
        isAdmin={isAdmin}
      />

      <h2>Novo recebimento</h2>
      <p className="subtitulo">
        Lançamento manual. Para um cliente novo, use &quot;+ Criar novo...&quot; no seletor.
      </p>
      <form action={criarRecebimentoAction} className="card card-formulario">
        <div className="grid-2">
          <SeletorParceiro
            label="Cliente"
            campoId="clienteId"
            campoNomeNovo="clienteNovoNome"
            opcoes={clientes.map((c) => ({ id: c.id, nome: c.nome }))}
            placeholderNovo="Nome do novo cliente"
          />
          <label>
            Categoria
            <input type="text" name="categoria" list="categorias-entrada-novo" required />
          </label>
          <label>
            Valor total
            <input type="text" name="valorTotal" placeholder="1500.00" required />
          </label>
          <label>
            Subtotal (opcional, padrão = valor total)
            <input type="text" name="subtotal" placeholder="1500.00" />
          </label>
          <label>
            Desconto (%)
            <input type="text" name="descontoPercentual" placeholder="0" />
          </label>
          <label>
            Desconto (R$)
            <input type="text" name="descontoValor" placeholder="0.00" />
          </label>
          <label>
            Frete
            <input type="text" name="frete" placeholder="0.00" />
          </label>
          <label>
            Forma de pagamento
            <input type="text" name="formaPagamento" placeholder="Pix, Boleto..." required />
          </label>
          <label>
            Data
            <input type="date" name="dataPedido" required />
          </label>
          <label>
            Status
            <input type="text" name="status" placeholder="CONFIRMADO" />
          </label>
        </div>
        <datalist id="categorias-entrada-novo">
          {categorias.map((c) => (
            <option key={c.id} value={c.nome} />
          ))}
        </datalist>
        <button type="submit">Lançar</button>
      </form>
    </div>
  );
}
