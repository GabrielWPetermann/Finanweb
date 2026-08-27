import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { linhaCsv, montarCsv, formatarDataAAAAMMDD } from "@/lib/csv-writer";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo") ?? "BALANCO";
  const inicio = searchParams.get("inicio");
  const fim = searchParams.get("fim");

  const dataInicio = inicio ? new Date(inicio) : undefined;
  const dataFim = fim ? new Date(`${fim}T23:59:59.999Z`) : undefined;

  const linhas: string[] = [];
  let nomeArquivo = "relatorio.csv";

  if (tipo === "ENTRADAS") {
    const pedidos = await prisma.pedidoAgrupado.findMany({
      where: { dataPedido: { gte: dataInicio, lte: dataFim } },
      include: { categoria: true, cliente: true },
      orderBy: { dataPedido: "asc" },
    });

    linhas.push(linhaCsv(["cliente", "categoria", "valor_total", "forma_pagamento", "data_pedido", "status"]));
    for (const p of pedidos) {
      linhas.push(
        linhaCsv([
          p.cliente.nome,
          p.categoria.nome,
          p.valorTotal.toString(),
          p.formaPagamento,
          formatarDataAAAAMMDD(p.dataPedido),
          p.status,
        ])
      );
    }
    nomeArquivo = "entradas.csv";
  } else if (tipo === "SAIDAS") {
    const despesas = await prisma.despesaAgrupada.findMany({
      where: { dataPagamento: { gte: dataInicio, lte: dataFim } },
      include: { categoria: true, fornecedor: true },
      orderBy: { dataPagamento: "asc" },
    });

    linhas.push(linhaCsv(["fornecedor", "categoria", "valor", "forma_pagamento", "data_pagamento", "status"]));
    for (const d of despesas) {
      linhas.push(
        linhaCsv([
          d.fornecedor.nome,
          d.categoria.nome,
          d.valor.toString(),
          d.formaPagamento,
          formatarDataAAAAMMDD(d.dataPagamento),
          d.status,
        ])
      );
    }
    nomeArquivo = "saidas.csv";
  } else {
    const [entradasAgg, saidasAgg] = await Promise.all([
      prisma.pedidoAgrupado.aggregate({
        where: { dataPedido: { gte: dataInicio, lte: dataFim } },
        _sum: { valorTotal: true },
      }),
      prisma.despesaAgrupada.aggregate({
        where: { dataPagamento: { gte: dataInicio, lte: dataFim } },
        _sum: { valor: true },
      }),
    ]);

    const totalEntradas = Number(entradasAgg._sum.valorTotal ?? 0);
    const totalSaidas = Number(saidasAgg._sum.valor ?? 0);

    linhas.push(linhaCsv(["tipo", "valor"]));
    linhas.push(linhaCsv(["Entradas", totalEntradas.toFixed(2)]));
    linhas.push(linhaCsv(["Saidas", totalSaidas.toFixed(2)]));
    linhas.push(linhaCsv(["Saldo", (totalEntradas - totalSaidas).toFixed(2)]));
    nomeArquivo = "balanco.csv";
  }

  const csv = montarCsv(linhas);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
