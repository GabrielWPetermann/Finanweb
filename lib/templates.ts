// Gera os arquivos-modelo (CSV e XML) disponibilizados na tela de integracao,
// para quem for preencher o arquivo na mao ter um ponto de partida ja no
// formato certo.

import { linhaCsv, montarCsv } from "@/lib/csv-writer";
import { gerarXmlEntrada, gerarXmlSaida } from "@/lib/xml-writer";

export function gerarModeloEntradaCsv(): string {
  const linhas = [
    linhaCsv(["0", "Nome da Empresa LTDA", "00000000000000", "", "", "", "", "ENTRADA", "20260101", "usuario"]),
    linhaCsv([
      "1",
      "Nome do Cliente",
      "00011122233",
      "Categoria Exemplo",
      "1000.00",
      "0",
      "0.00",
      "0.00",
      "1000.00",
      "Boleto",
      "20260101",
      "CONFIRMADO",
    ]),
    linhaCsv(["9", "1", "1000.00"]),
  ];

  return montarCsv(linhas);
}

export function gerarModeloClientesCsv(): string {
  const linhas = [
    linhaCsv(["nome", "documento", "email", "telefone"]),
    linhaCsv(["Cliente Exemplo LTDA", "00011122233", "contato@exemplo.com", "11999998888"]),
  ];

  return montarCsv(linhas);
}

export function gerarModeloFornecedoresCsv(): string {
  const linhas = [
    linhaCsv(["nome", "documento", "email", "telefone"]),
    linhaCsv(["Fornecedor Exemplo LTDA", "00099988877000100", "contato@fornecedor.com", "11988887777"]),
  ];

  return montarCsv(linhas);
}

export function gerarModeloSaidaCsv(): string {
  const linhas = [
    linhaCsv(["0", "Nome da Empresa LTDA", "00000000000000", "", "", "SAIDA", "20260101", "usuario"]),
    linhaCsv([
      "1",
      "Nome do Fornecedor",
      "00099988877000100",
      "Categoria Exemplo",
      "500.00",
      "Boleto",
      "20260101",
      "CONFIRMADO",
    ]),
    linhaCsv(["9", "1", "500.00"]),
  ];

  return montarCsv(linhas);
}

// --------------------------------------------------------------------- XML
//
// Os modelos XML saem do mesmo escritor usado na exportacao, entao o que o
// usuario baixa aqui e exatamente o que o sistema produz -- e valida contra
// lib/xml/schemas/*.xsd sem nenhum ajuste.
//
// O documento do fornecedor usa 14 digitos (CNPJ), e nao o valor de 17 do
// modelo CSV acima: o layout texto nao confere tamanho, mas o XSD so aceita
// 11 (CPF) ou 14 (CNPJ).

const CABECALHO_MODELO = {
  nomeEmpresa: "Nome da Empresa LTDA",
  cnpj: "00000000000000",
  dataArquivo: "20260101",
  usuario: "usuario",
};

export function gerarModeloEntradaXml(): string {
  return gerarXmlEntrada(
    { ...CABECALHO_MODELO, tipoDocumento: "ENTRADA" },
    [
      {
        cliente: "Nome do Cliente",
        documento: "00011122233",
        categoria: "Categoria Exemplo",
        subtotal: 1000,
        descontoPercentual: 0,
        descontoValor: 0,
        frete: 0,
        valorTotal: 1000,
        formaPagamento: "Boleto",
        dataPedido: "20260101",
        status: "CONFIRMADO",
      },
    ],
    { qtdRegistros: 1, valorTotalGeral: 1000 }
  );
}

export function gerarModeloSaidaXml(): string {
  return gerarXmlSaida(
    { ...CABECALHO_MODELO, tipoDocumento: "SAIDA" },
    [
      {
        fornecedor: "Nome do Fornecedor",
        documento: "00099988877000",
        categoria: "Categoria Exemplo",
        valor: 500,
        formaPagamento: "Boleto",
        dataPagamento: "20260101",
        status: "CONFIRMADO",
      },
    ],
    { qtdRegistros: 1, valorTotalGeral: 500 }
  );
}
