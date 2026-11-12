import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";
import { criarPagamentoAction } from "./actions";
import { TabelaPagamentos, type LotePagamento, type PagamentoLinha } from "./tabela-pagamentos";
import { SeletorParceiro } from "../_components/seletor-parceiro";
import { SeletorStatus } from "../_components/seletor-status";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatarDataHora(data: Date) {
  return data.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

function paraInputDate(data: Date) {
  return data.toISOString().slice(0, 10);
}

// Baixar varios pagamentos de um lote manda um aviso por pagamento (ver actions.ts).
export const maxDuration = 60;

// Valor do filtro para os lancamentos feitos na tela (sem importacao).
const LOTE_MANUAL = "manual";

interface Props {
  searchParams: Promise<{ categoriaId?: string; fornecedor?: string; inicio?: string; fim?: string; lote?: string }>;
}

export default async function PagamentosPage({ searchParams }: Props) {
  const { categoriaId, fornecedor, inicio, fim, lote } = await searchParams;

  const usuario = await getUsuarioAtual();
  const isAdmin = usuario?.role === "ADMIN";

  const [categorias, fornecedores, importacoes] = await Promise.all([
    prisma.categoria.findMany({ where: { tipo: "SAIDA", ativo: true }, orderBy: { nome: "asc" } }),
    prisma.parceiro.findMany({ where: { tipo: "FORNECEDOR", ativo: true }, orderBy: { nome: "asc" } }),
    // Lotes que tem pagamento (compras, folhas, CSV de saida), do mais novo.
    prisma.importacao.findMany({
      where: { despesas: { some: {} } },
      select: { id: true, nomeArquivo: true, criadoEm: true },
      orderBy: { criadoEm: "desc" },
      take: 100,
    }),
  ]);

  const despesas = await prisma.despesaAgrupada.findMany({
    where: {
      categoriaId: categoriaId || undefined,
      fornecedor: fornecedor ? { nome: { contains: fornecedor, mode: "insensitive" } } : undefined,
      dataPagamento: {
        gte: inicio ? new Date(inicio) : undefined,
        lte: fim ? new Date(`${fim}T23:59:59.999Z`) : undefined,
      },
      importacaoId: lote === LOTE_MANUAL ? null : lote || undefined,
    },
    include: {
      categoria: true,
      fornecedor: true,
      importacao: { select: { nomeArquivo: true, criadoEm: true, usuario: { select: { username: true } } } },
    },
    // O que foi lancado por ultimo primeiro: uma importacao com datas antigas
    // (venda de agosto chegando em outubro) ficava no meio da lista. Nao ha
    // coluna de criacao, mas o id (cuid) comeca pelo timestamp e ordena por ele.
    orderBy: { id: "desc" },
    // Um lote escolhido vem inteiro.
    take: lote ? undefined : 200,
  });

  // Um grupo por lote de envio, na ordem do lancamento mais recente de cada um.
  const grupos = new Map<string, LotePagamento & { total: number; pendente: number }>();
  for (const d of despesas) {
    const chave = d.importacaoId ?? LOTE_MANUAL;
    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = {
        chave,
        titulo: d.importacao?.nomeArquivo ?? "Lançamentos manuais",
        detalhe: d.importacao
          ? [
              `importado em ${formatarDataHora(d.importacao.criadoEm)} por ${d.importacao.usuario.username}`,
              d.origem ? `origem ${d.origem}` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : "lançados na tela, sem arquivo",
        arquivo: d.importacaoId ? `/historico/download?id=${d.importacaoId}` : null,
        despesas: [],
        total: 0,
        pendente: 0,
        qtdPendentes: 0,
        totalFormatado: "",
        pendenteFormatado: "",
      };
      grupos.set(chave, grupo);
    }
    const valor = Number(d.valor);
    grupo.total += valor;
    if (d.status.trim().toUpperCase() === "PENDENTE") {
      grupo.pendente += valor;
      grupo.qtdPendentes++;
    }
    const linha: PagamentoLinha = {
      id: d.id,
      fornecedorId: d.fornecedorId,
      fornecedorNome: d.fornecedor.nome,
      categoriaNome: d.categoria.nome,
      valor: d.valor.toString(),
      formaPagamento: d.formaPagamento,
      dataPagamento: paraInputDate(d.dataPagamento),
      status: d.status,
      referencia: d.referencia,
      valorFormatado: formatarMoeda(valor),
      dataFormatada: formatarData(d.dataPagamento),
    };
    grupo.despesas.push(linha);
  }
  const lotes: LotePagamento[] = [...grupos.values()].map(({ total, pendente, ...grupo }) => ({
    ...grupo,
    totalFormatado: formatarMoeda(total),
    pendenteFormatado: formatarMoeda(pendente),
  }));

  return (
    <div>
      <h1>Pagamentos</h1>

      <form method="get" className="filtros">
        <label>
          Lote
          <select name="lote" defaultValue={lote ?? ""}>
            <option value="">Todos</option>
            <option value={LOTE_MANUAL}>Lançamentos manuais</option>
            {importacoes.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nomeArquivo} ({formatarDataHora(i.criadoEm)})
              </option>
            ))}
          </select>
        </label>
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

      <TabelaPagamentos
        lotes={lotes}
        loteEscolhido={Boolean(lote)}
        categoriasNomes={categorias.map((c) => c.nome)}
        fornecedores={fornecedores.map((f) => ({ id: f.id, nome: f.nome }))}
        isAdmin={isAdmin}
      />

      <h2>Novo pagamento</h2>
      <p className="subtitulo">
        Lançamento manual. Para um fornecedor novo, use &quot;+ Criar novo...&quot; no seletor.
      </p>
      <form action={criarPagamentoAction} className="card card-formulario">
        <div className="grid-2">
          <SeletorParceiro
            label="Fornecedor"
            campoId="fornecedorId"
            campoNomeNovo="fornecedorNovoNome"
            opcoes={fornecedores.map((f) => ({ id: f.id, nome: f.nome }))}
            placeholderNovo="Nome do novo fornecedor"
          />
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
          <SeletorStatus tipo="pagamento" />
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
