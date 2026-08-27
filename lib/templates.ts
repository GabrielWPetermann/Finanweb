// Gera os arquivos-modelo de CSV (Entrada e Saida) disponibilizados na tela
// de integracao, para quem for preencher o arquivo na mao ter um ponto de
// partida ja no formato certo.

import { linhaCsv, montarCsv } from "@/lib/csv-writer";

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
