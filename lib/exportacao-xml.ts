// Monta o XML de Entradas ou Saidas de um periodo, a partir do banco.
//
// Usado pela exportacao em /relatorios e pelo envio via socket em /socket:
// os dois entregam o mesmo arquivo, validado contra o mesmo XSD da importacao.

import { prisma } from "@/lib/db";
import { formatarDataAAAAMMDD } from "@/lib/csv-writer";
import { gerarXmlEntrada, gerarXmlSaida } from "@/lib/xml-writer";
import { SCHEMA_POR_TIPO, validarContraXsd } from "@/lib/xml/validador";
import type { EntradaPedido } from "@/lib/parsers/entrada";
import type { SaidaDespesa } from "@/lib/parsers/saida";

// Identificacao de quem emitiu o arquivo. O sistema nao guarda os dados da
// propria empresa, entao o cabecalho e sintetico -- o XSD exige um CNPJ de 14
// digitos, e este e o mesmo placeholder dos arquivos-modelo.
const CNPJ_EMISSOR = "00000000000000";
const EMPRESA_EMISSORA = "Finanweb";

export type ResultadoExportacaoXml =
  | { ok: true; xml: string; nomeArquivo: string }
  | { ok: false; erro: string; status: number };

// O XML exportado e o movimento completo (com documento, subtotal, desconto
// e frete), e nao o relatorio achatado do CSV: assim ele valida contra o
// mesmo XSD da importacao e pode ser reimportado sem conversao no meio.
export async function gerarMovimentoXml(
  tipo: "ENTRADAS" | "SAIDAS",
  dataInicio: Date | undefined,
  dataFim: Date | undefined,
  usuario: string
): Promise<ResultadoExportacaoXml> {
  const cabecalho = {
    nomeEmpresa: EMPRESA_EMISSORA,
    cnpj: CNPJ_EMISSOR,
    tipoDocumento: tipo === "ENTRADAS" ? "ENTRADA" : "SAIDA",
    dataArquivo: formatarDataAAAAMMDD(new Date()),
    usuario,
  };

  if (tipo === "ENTRADAS") {
    const registros = await prisma.pedidoAgrupado.findMany({
      where: { dataPedido: { gte: dataInicio, lte: dataFim } },
      include: { categoria: true, cliente: true },
      orderBy: { dataPedido: "asc" },
    });

    if (registros.length === 0) {
      return { ok: false, erro: "Nenhuma entrada no período selecionado.", status: 404 };
    }

    // O XSD exige o documento do cliente; parceiros cadastrados a mao podem
    // nao ter um. Falhar aqui, dizendo quantos faltam, e melhor do que
    // omitir registros em silencio de um arquivo de intercambio.
    const semDocumento = registros.filter((r) => !r.cliente.documento).length;
    if (semDocumento > 0) {
      return {
        ok: false,
        erro: `${semDocumento} registro(s) têm cliente sem CNPJ/CPF cadastrado, e o XML exige o documento. Complete o cadastro em Admin > Cadastros ou exporte em CSV.`,
        status: 422,
      };
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
      return {
        ok: false,
        erro: `Os dados do período não formam um XML válido: ${errosXsd.slice(0, 3).join(" ")}`,
        status: 422,
      };
    }

    return { ok: true, xml, nomeArquivo: "entradas.xml" };
  }

  const registros = await prisma.despesaAgrupada.findMany({
    where: { dataPagamento: { gte: dataInicio, lte: dataFim } },
    include: { categoria: true, fornecedor: true },
    orderBy: { dataPagamento: "asc" },
  });

  if (registros.length === 0) {
    return { ok: false, erro: "Nenhuma saída no período selecionado.", status: 404 };
  }

  const semDocumento = registros.filter((r) => !r.fornecedor.documento).length;
  if (semDocumento > 0) {
    return {
      ok: false,
      erro: `${semDocumento} registro(s) têm fornecedor sem CNPJ/CPF cadastrado, e o XML exige o documento. Complete o cadastro em Admin > Cadastros ou exporte em CSV.`,
      status: 422,
    };
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
    return {
      ok: false,
      erro: `Os dados do período não formam um XML válido: ${errosXsd.slice(0, 3).join(" ")}`,
      status: 422,
    };
  }

  return { ok: true, xml, nomeArquivo: "saidas.xml" };
}
