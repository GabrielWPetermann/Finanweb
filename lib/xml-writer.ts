// Escrita de XML na mao (sem lib de serializacao), do mesmo jeito que o
// lib/csv-writer.ts monta o layout texto.
//
// As funcoes recebem exatamente as mesmas estruturas que os parsers devolvem
// (EntradaParseResult / SaidaParseResult), entao escrever e ler sao inversos:
// parse -> gera -> parse devolve o mesmo objeto. E o que permite exportar em
// XML e reimportar o arquivo sem conversao no meio.

import type { EntradaCabecalho, EntradaPedido, EntradaTotalizador } from "@/lib/parsers/entrada";
import type { SaidaCabecalho, SaidaDespesa, SaidaTotalizador } from "@/lib/parsers/saida";
import { dataTextoParaIso, escaparXml } from "@/lib/xml/escape";

export const NAMESPACE_ENTRADA = "urn:finanweb:entrada:1.0";
export const NAMESPACE_SAIDA = "urn:finanweb:saida:1.0";

// O XSD declara valorMonetario com fractionDigits=2; sem o toFixed um valor
// inteiro sairia como "1000" e um float como "1000.005".
function valor(numero: number): string {
  return numero.toFixed(2);
}

function cabecalhoXml(cabecalho: EntradaCabecalho | SaidaCabecalho): string {
  return `  <cabecalho>
    <empresa>${escaparXml(cabecalho.nomeEmpresa)}</empresa>
    <cnpj>${escaparXml(cabecalho.cnpj)}</cnpj>
    <tipoDocumento>${escaparXml(cabecalho.tipoDocumento)}</tipoDocumento>
    <dataArquivo>${dataTextoParaIso(cabecalho.dataArquivo)}</dataArquivo>
    <usuario>${escaparXml(cabecalho.usuario)}</usuario>
  </cabecalho>`;
}

function totalizadorXml(totalizador: EntradaTotalizador | SaidaTotalizador): string {
  return `  <totalizador>
    <qtdRegistros>${totalizador.qtdRegistros}</qtdRegistros>
    <valorTotalGeral>${valor(totalizador.valorTotalGeral)}</valorTotalGeral>
  </totalizador>`;
}

export function gerarXmlEntrada(
  cabecalho: EntradaCabecalho,
  pedidos: EntradaPedido[],
  totalizador: EntradaTotalizador
): string {
  const linhas: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<movimento xmlns="${NAMESPACE_ENTRADA}" versao="1.0" tipo="ENTRADA">`,
    cabecalhoXml(cabecalho),
    `  <pedidos>`,
  ];

  for (const pedido of pedidos) {
    linhas.push(`    <pedido status="${escaparXml(pedido.status)}">
      <cliente documento="${escaparXml(pedido.documento)}">${escaparXml(pedido.cliente)}</cliente>
      <categoria>${escaparXml(pedido.categoria)}</categoria>
      <subtotal>${valor(pedido.subtotal)}</subtotal>
      <desconto percentual="${valor(pedido.descontoPercentual)}">${valor(pedido.descontoValor)}</desconto>
      <frete>${valor(pedido.frete)}</frete>
      <valorTotal>${valor(pedido.valorTotal)}</valorTotal>
      <formaPagamento>${escaparXml(pedido.formaPagamento)}</formaPagamento>
      <dataPedido>${dataTextoParaIso(pedido.dataPedido)}</dataPedido>
    </pedido>`);
  }

  linhas.push(`  </pedidos>`, totalizadorXml(totalizador), `</movimento>`);
  return linhas.join("\n") + "\n";
}

export function gerarXmlSaida(
  cabecalho: SaidaCabecalho,
  despesas: SaidaDespesa[],
  totalizador: SaidaTotalizador
): string {
  const linhas: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<movimento xmlns="${NAMESPACE_SAIDA}" versao="1.0" tipo="SAIDA">`,
    cabecalhoXml(cabecalho),
    `  <despesas>`,
  ];

  for (const despesa of despesas) {
    linhas.push(`    <despesa status="${escaparXml(despesa.status)}">
      <fornecedor documento="${escaparXml(despesa.documento)}">${escaparXml(despesa.fornecedor)}</fornecedor>
      <categoria>${escaparXml(despesa.categoria)}</categoria>
      <valor>${valor(despesa.valor)}</valor>
      <formaPagamento>${escaparXml(despesa.formaPagamento)}</formaPagamento>
      <dataPagamento>${dataTextoParaIso(despesa.dataPagamento)}</dataPagamento>
    </despesa>`);
  }

  linhas.push(`  </despesas>`, totalizadorXml(totalizador), `</movimento>`);
  return linhas.join("\n") + "\n";
}
