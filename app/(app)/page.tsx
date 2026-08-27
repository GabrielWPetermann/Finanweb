import { prisma } from "@/lib/db";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function DashboardPage() {
  const [totalEntradas, totalSaidas, porClienteAgrupado, porFornecedorAgrupado] = await Promise.all([
    prisma.pedidoAgrupado.aggregate({ _sum: { valorTotal: true } }),
    prisma.despesaAgrupada.aggregate({ _sum: { valor: true } }),
    prisma.pedidoAgrupado.groupBy({
      by: ["clienteId"],
      _sum: { valorTotal: true },
      orderBy: { _sum: { valorTotal: "desc" } },
      take: 10,
    }),
    prisma.despesaAgrupada.groupBy({
      by: ["fornecedorId"],
      _sum: { valor: true },
      orderBy: { _sum: { valor: "desc" } },
      take: 10,
    }),
  ]);

  const [clientesEnvolvidos, fornecedoresEnvolvidos] = await Promise.all([
    prisma.parceiro.findMany({ where: { id: { in: porClienteAgrupado.map((l) => l.clienteId) } } }),
    prisma.parceiro.findMany({ where: { id: { in: porFornecedorAgrupado.map((l) => l.fornecedorId) } } }),
  ]);

  const mapaClientes = new Map(clientesEnvolvidos.map((c) => [c.id, c.nome]));
  const mapaFornecedores = new Map(fornecedoresEnvolvidos.map((f) => [f.id, f.nome]));

  const porCliente = porClienteAgrupado.map((linha) => ({
    id: linha.clienteId,
    nome: mapaClientes.get(linha.clienteId) ?? "—",
    total: Number(linha._sum.valorTotal ?? 0),
  }));

  const porFornecedor = porFornecedorAgrupado.map((linha) => ({
    id: linha.fornecedorId,
    nome: mapaFornecedores.get(linha.fornecedorId) ?? "—",
    total: Number(linha._sum.valor ?? 0),
  }));

  const entradas = Number(totalEntradas._sum.valorTotal ?? 0);
  const saidas = Number(totalSaidas._sum.valor ?? 0);
  const saldo = entradas - saidas;

  return (
    <div>
      <h1>Dashboard</h1>

      <div className="cards">
        <div className="card">
          <span className="card-label">Saldo geral</span>
          <span className={`card-valor ${saldo >= 0 ? "positivo" : "negativo"}`}>{formatarMoeda(saldo)}</span>
        </div>
        <div className="card">
          <span className="card-label">Total de entradas</span>
          <span className="card-valor">{formatarMoeda(entradas)}</span>
        </div>
        <div className="card">
          <span className="card-label">Total de saídas</span>
          <span className="card-valor">{formatarMoeda(saidas)}</span>
        </div>
      </div>

      <div className="grid-2">
        <section>
          <h2>Top clientes</h2>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {porCliente.map((linha) => (
                <tr key={linha.id}>
                  <td>{linha.nome}</td>
                  <td>{formatarMoeda(linha.total)}</td>
                </tr>
              ))}
              {porCliente.length === 0 && (
                <tr>
                  <td colSpan={2}>Nenhum dado ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Top fornecedores</h2>
          <table>
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {porFornecedor.map((linha) => (
                <tr key={linha.id}>
                  <td>{linha.nome}</td>
                  <td>{formatarMoeda(linha.total)}</td>
                </tr>
              ))}
              {porFornecedor.length === 0 && (
                <tr>
                  <td colSpan={2}>Nenhum dado ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
