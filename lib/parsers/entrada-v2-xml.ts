// Parser da venda que o setor de Vendas envia (entrada-v2.xsd). Cada pedido
// vira uma conta a receber, identificada por origem + referencia.
//
// O XSD e conferido antes. Aqui sobram as regras entre campos: valorTotal =
// subtotal - desconto + frete, e vencimento a partir da data do pedido.

import { atributo, centavos, criarParser, lerCabecalho, texto, type EnvioCabecalho, type No } from "@/lib/parsers/envio-xml";

export interface VendaPedido {
  referencia: string;
  status: "PENDENTE" | "CONFIRMADO";
  cliente: string;
  documento: string;
  categoria: string;
  subtotal: number;
  descontoPercentual: number;
  descontoValor: number;
  frete: number;
  valorTotal: number;
  formaPagamento: string;
  dataPedido: string; // AAAA-MM-DD
  vencimento: string; // AAAA-MM-DD
}

export interface VendaParseResult {
  cabecalho: EnvioCabecalho | null;
  pedidos: VendaPedido[];
  // Referencias com status CANCELADO: nao viram lancamento, mas cancelam um
  // que ja tinha sido lancado em aberto (ver importarEnvioSetor).
  cancelados: string[];
  erros: string[];
}

const parser = criarParser("pedido");

export function parseEntradaV2Xml(conteudo: string): VendaParseResult {
  const pedidos: VendaPedido[] = [];
  const erros: string[] = [];
  const cancelados: string[] = [];

  let documento: No;
  try {
    documento = parser.parse(conteudo) as No;
  } catch {
    return { cabecalho: null, pedidos, cancelados, erros: ["Arquivo XML mal formado."] };
  }

  const movimento = documento.movimento as No | undefined;
  const cabecalho = lerCabecalho(movimento?.cabecalho);
  if (!movimento || !cabecalho) {
    return { cabecalho, pedidos, cancelados, erros: ["Elementos <movimento> e <cabecalho> são obrigatórios."] };
  }

  const lista = ((movimento.pedidos as No | undefined)?.pedido ?? []) as No[];
  for (const pedido of lista) {
    const referencia = atributo(pedido, "referencia");
    const status = atributo(pedido, "status");
    if (status === "CANCELADO") {
      cancelados.push(referencia);
      continue;
    }

    const subtotal = texto(pedido.subtotal);
    const descontoValor = texto(pedido.desconto);
    const frete = texto(pedido.frete);
    const valorTotal = texto(pedido.valorTotal);
    if (centavos(subtotal) - centavos(descontoValor) + centavos(frete) !== centavos(valorTotal)) {
      erros.push(`Pedido ${referencia}: valorTotal ${valorTotal} diferente de subtotal - desconto + frete.`);
      continue;
    }

    const dataPedido = texto(pedido.dataPedido);
    const vencimento = texto(pedido.vencimento);
    // Datas AAAA-MM-DD comparam certo como texto.
    if (vencimento < dataPedido) {
      erros.push(`Pedido ${referencia}: vencimento ${vencimento} anterior à data do pedido ${dataPedido}.`);
      continue;
    }

    pedidos.push({
      referencia,
      status: status as VendaPedido["status"],
      cliente: texto(pedido.cliente),
      documento: atributo(pedido.cliente, "documento"),
      categoria: texto(pedido.categoria),
      subtotal: Number(subtotal),
      descontoPercentual: Number(atributo(pedido.desconto, "percentual")),
      descontoValor: Number(descontoValor),
      frete: Number(frete),
      valorTotal: Number(valorTotal),
      formaPagamento: texto(pedido.formaPagamento),
      dataPedido,
      vencimento,
    });
  }

  return { cabecalho, pedidos, cancelados, erros };
}
