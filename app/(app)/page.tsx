import { prisma } from "@/lib/db";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function DashboardPage() {
  const [totalEntradas, totalSaidas, porCliente, porFornecedor] = await Promise.all([
    prisma.pedidoAgrupado.aggregate({ _sum: { valorTotal: true } }),
    prisma.despesaAgrupada.aggregate({ _sum: { valor: true } }),
    prisma.pedidoAgrupado.groupBy({
      by: ["cliente"],
      _sum: { valorTotal: true },
      orderBy: { _sum: { valorTotal: "desc" } },
      take: 10,
    }),
    prisma.despesaAgrupada.groupBy({
      by: ["fornecedor"],
      _sum: { valor: true },
      orderBy: { _sum: { valor: "desc" } },
      take: 10,
    }),
  ]);

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
                <tr key={linha.cliente}>
                  <td>{linha.cliente}</td>
                  <td>{formatarMoeda(Number(linha._sum.valorTotal ?? 0))}</td>
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
                <tr key={linha.fornecedor}>
                  <td>{linha.fornecedor}</td>
                  <td>{formatarMoeda(Number(linha._sum.valor ?? 0))}</td>
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
