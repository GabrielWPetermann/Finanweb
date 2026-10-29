// Parser da compra que o setor de Compras envia (saida-v2.xsd). Cada despesa
// vira uma conta a pagar, identificada por origem + referencia.
//
// O XSD e conferido antes. Aqui sobra a regra entre campos: vencimento a
// partir da data de emissao.

import { atributo, criarParser, lerCabecalho, texto, type EnvioCabecalho, type No } from "@/lib/parsers/envio-xml";

export interface CompraDespesa {
  referencia: string;
  status: "PENDENTE" | "CONFIRMADO";
  fornecedor: string;
  documento: string;
  categoria: string;
  valor: number;
  formaPagamento: string;
  dataEmissao: string; // AAAA-MM-DD
  vencimento: string; // AAAA-MM-DD
}

export interface CompraParseResult {
  cabecalho: EnvioCabecalho | null;
  despesas: CompraDespesa[];
  // Referencias com status CANCELADO: nao viram lancamento, mas cancelam um
  // que ja tinha sido lancado em aberto (ver importarEnvioSetor).
  cancelados: string[];
  erros: string[];
}

const parser = criarParser("despesa");

export function parseSaidaV2Xml(conteudo: string): CompraParseResult {
  const despesas: CompraDespesa[] = [];
  const erros: string[] = [];
  const cancelados: string[] = [];

  let documento: No;
  try {
    documento = parser.parse(conteudo) as No;
  } catch {
    return { cabecalho: null, despesas, cancelados, erros: ["Arquivo XML mal formado."] };
  }

  const movimento = documento.movimento as No | undefined;
  const cabecalho = lerCabecalho(movimento?.cabecalho);
  if (!movimento || !cabecalho) {
    return { cabecalho, despesas, cancelados, erros: ["Elementos <movimento> e <cabecalho> são obrigatórios."] };
  }

  const lista = ((movimento.despesas as No | undefined)?.despesa ?? []) as No[];
  for (const despesa of lista) {
    const referencia = atributo(despesa, "referencia");
    const status = atributo(despesa, "status");
    if (status === "CANCELADO") {
      cancelados.push(referencia);
      continue;
    }

    const dataEmissao = texto(despesa.dataEmissao);
    const vencimento = texto(despesa.vencimento);
    if (vencimento < dataEmissao) {
      erros.push(`Despesa ${referencia}: vencimento ${vencimento} anterior à emissão ${dataEmissao}.`);
      continue;
    }

    despesas.push({
      referencia,
      status: status as CompraDespesa["status"],
      fornecedor: texto(despesa.fornecedor),
      documento: atributo(despesa.fornecedor, "documento"),
      categoria: texto(despesa.categoria),
      valor: Number(texto(despesa.valor)),
      formaPagamento: texto(despesa.formaPagamento),
      dataEmissao,
      vencimento,
    });
  }

  return { cabecalho, despesas, cancelados, erros };
}
