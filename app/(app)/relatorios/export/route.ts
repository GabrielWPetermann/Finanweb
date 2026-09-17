import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";
import { linhaCsv, montarCsv, formatarDataAAAAMMDD } from "@/lib/csv-writer";
import { gerarXmlEntrada, gerarXmlSaida } from "@/lib/xml-writer";
import { SCHEMA_POR_TIPO, validarContraXsd } from "@/lib/xml/validador";
import type { EntradaPedido } from "@/lib/parsers/entrada";
import type { SaidaDespesa } from "@/lib/parsers/saida";

// Identificacao de quem emitiu o arquivo. O sistema nao guarda os dados da
// propria empresa, entao o cabecalho e sintetico -- o XSD exige um CNPJ de 14
// digitos, e este e o mesmo placeholder dos arquivos-modelo.
const CNPJ_EMISSOR = "00000000000000";
const EMPRESA_EMISSORA = "Finanweb";

function erro(mensagem: string, status: number) {
  return new Response(JSON.stringify({ error: mensagem }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo") ?? "BALANCO";
  const inicio = searchParams.get("inicio");
  const fim = searchParams.get("fim");
  // Sem o parametro, continua exportando CSV como sempre fez.
  const formato = (searchParams.get("formato") ?? "csv").toLowerCase();

  if (formato !== "csv" && formato !== "xml") {
    return erro("Parâmetro formato inválido (use csv ou xml).", 400);
  }

  const dataInicio = inicio ? new Date(inicio) : undefined;
  const dataFim = fim ? new Date(`${fim}T23:59:59.999Z`) : undefined;

  // -------------------------------------------------------------------- XML
  //
  // O XML exportado e o movimento completo (com documento, subtotal, desconto
  // e frete), e nao o relatorio achatado do CSV: assim ele valida contra o
  // mesmo XSD da importacao e pode ser reimportado sem conversao no meio.
  if (formato === "xml") {
    if (tipo !== "ENTRADAS" && tipo !== "SAIDAS") {
      return erro(
        "Balanço não tem formato XML: é um agregado de 3 linhas, sem contrato de intercâmbio. Exporte Entradas ou Saídas, ou use CSV.",
        400
      );
    }

    const usuario = await getUsuarioAtual();
    const cabecalho = {
      nomeEmpresa: EMPRESA_EMISSORA,
      cnpj: CNPJ_EMISSOR,
      tipoDocumento: tipo === "ENTRADAS" ? "ENTRADA" : "SAIDA",
      dataArquivo: formatarDataAAAAMMDD(new Date()),
      usuario: usuario?.username ?? "sistema",
    };

    if (tipo === "ENTRADAS") {
      const registros = await prisma.pedidoAgrupado.findMany({
        where: { dataPedido: { gte: dataInicio, lte: dataFim } },
        include: { categoria: true, cliente: true },
        orderBy: { dataPedido: "asc" },
      });

      if (registros.length === 0) {
        return erro("Nenhuma entrada no período selecionado.", 404);
      }

      // O XSD exige o documento do cliente; parceiros cadastrados a mao podem
      // nao ter um. Falhar aqui, dizendo quantos faltam, e melhor do que
      // omitir registros em silencio de um arquivo de intercambio.
      const semDocumento = registros.filter((r) => !r.cliente.documento).length;
      if (semDocumento > 0) {
        return erro(
          `${semDocumento} registro(s) têm cliente sem CNPJ/CPF cadastrado, e o XML exige o documento. Complete o cadastro em Admin > Cadastros ou exporte em CSV.`,
          422
        );
      }

      const pedidos: EntradaPedido[] = registros.map((r) => ({
        cliente: r.cliente.nome,
        documento: r.cliente.documento ?? "",
        categoria: r.categoria.nome,
        subtotal: Number(r.subtotal),
        descontoPercentual: Number(r.descontoPercentual),
        descontoValor: Number(r.descontoValor),
        frete: Number(r.frete),
        valorTotal: Number(r.valorTotal),
        formaPagamento: r.formaPagamento,
        dataPedido: formatarDataAAAAMMDD(r.dataPedido),
        status: r.status,
      }));

      const xml = gerarXmlEntrada(cabecalho, pedidos, {
        qtdRegistros: pedidos.length,
        valorTotalGeral: pedidos.reduce((soma, p) => soma + p.valorTotal, 0),
      });

      // Conferir a propria saida contra o XSD: se algum dado gravado nao cabe
      // no contrato (um status fora da enumeracao, por exemplo), o usuario
      // descobre aqui em vez de na importacao do outro lado.
      const errosXsd = await validarContraXsd(xml, SCHEMA_POR_TIPO.ENTRADA);
      if (errosXsd.length > 0) {
        return erro(
          `Os dados do período não formam um XML válido: ${errosXsd.slice(0, 3).join(" ")}`,
          422
        );
      }

      return new Response(xml, {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="entradas.xml"`,
        },
      });
    }

    const registros = await prisma.despesaAgrupada.findMany({
      where: { dataPagamento: { gte: dataInicio, lte: dataFim } },
      include: { categoria: true, fornecedor: true },
      orderBy: { dataPagamento: "asc" },
    });

    if (registros.length === 0) {
      return erro("Nenhuma saída no período selecionado.", 404);
    }

    const semDocumento = registros.filter((r) => !r.fornecedor.documento).length;
    if (semDocumento > 0) {
      return erro(
        `${semDocumento} registro(s) têm fornecedor sem CNPJ/CPF cadastrado, e o XML exige o documento. Complete o cadastro em Admin > Cadastros ou exporte em CSV.`,
        422
      );
    }

    const despesas: SaidaDespesa[] = registros.map((r) => ({
      fornecedor: r.fornecedor.nome,
      documento: r.fornecedor.documento ?? "",
      categoria: r.categoria.nome,
      valor: Number(r.valor),
      formaPagamento: r.formaPagamento,
      dataPagamento: formatarDataAAAAMMDD(r.dataPagamento),
      status: r.status,
    }));

    const xml = gerarXmlSaida(cabecalho, despesas, {
      qtdRegistros: despesas.length,
      valorTotalGeral: despesas.reduce((soma, d) => soma + d.valor, 0),
    });

    const errosXsd = await validarContraXsd(xml, SCHEMA_POR_TIPO.SAIDA);
    if (errosXsd.length > 0) {
      return erro(`Os dados do período não formam um XML válido: ${errosXsd.slice(0, 3).join(" ")}`, 422);
    }

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="saidas.xml"`,
      },
    });
  }

  // -------------------------------------------------------------------- CSV
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
