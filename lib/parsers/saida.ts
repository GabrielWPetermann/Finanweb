// Parser manual do CSV de Saida -- mesma abordagem do parser de Entrada
// (split simples por virgula, sem lib de CSV). Ver README para o formato.

const CAMPOS_CABECALHO = 8;
const CAMPOS_DETALHE = 8;
const CAMPOS_TOTALIZADOR = 3;

const REGEX_DATA = /^\d{8}$/;

export interface SaidaCabecalho {
  nomeEmpresa: string;
  cnpj: string;
  tipoDocumento: string;
  dataArquivo: string;
  usuario: string;
}

export interface SaidaDespesa {
  fornecedor: string;
  documento: string;
  categoria: string;
  valor: number;
  formaPagamento: string;
  dataPagamento: string;
  status: string;
}

export interface SaidaTotalizador {
  qtdRegistros: number;
  valorTotalGeral: number;
}

export interface SaidaParseResult {
  cabecalho: SaidaCabecalho | null;
  despesas: SaidaDespesa[];
  totalizador: SaidaTotalizador | null;
  ignorados: number;
  erros: string[];
}

export function parseSaidaCsv(conteudo: string): SaidaParseResult {
  const linhas = conteudo.split(/\r?\n/).filter((linha) => linha.trim() !== "");

  let cabecalho: SaidaCabecalho | null = null;
  let totalizador: SaidaTotalizador | null = null;
  const despesas: SaidaDespesa[] = [];
  const erros: string[] = [];
  let ignorados = 0;

  linhas.forEach((linha, indice) => {
    const numeroLinha = indice + 1;
    const campos = linha.split(",");

    switch (campos[0]) {
      case "0": {
        if (campos.length !== CAMPOS_CABECALHO) {
          erros.push(
            `Linha ${numeroLinha}: cabeçalho (tipo 0) deveria ter ${CAMPOS_CABECALHO} campos, tem ${campos.length}.`
          );
          return;
        }
        cabecalho = {
          nomeEmpresa: campos[1],
          cnpj: campos[2],
          tipoDocumento: campos[5],
          dataArquivo: campos[6],
          usuario: campos[7],
        };
        break;
      }

      case "1": {
        if (campos.length !== CAMPOS_DETALHE) {
          erros.push(
            `Linha ${numeroLinha}: registro de fornecedor (tipo 1) deveria ter ${CAMPOS_DETALHE} campos, tem ${campos.length}. Confira se o arquivo não é do formato de Entrada.`
          );
          return;
        }

        const status = campos[7].trim();
        if (status.toUpperCase() === "CANCELADO") {
          ignorados++;
          return;
        }

        const documento = campos[2].trim();
        if (!documento) {
          erros.push(`Linha ${numeroLinha}: campo documento (CNPJ/CPF do fornecedor) é obrigatório.`);
          return;
        }

        const valor = Number(campos[4]);
        if (Number.isNaN(valor)) {
          erros.push(`Linha ${numeroLinha}: valor inválido.`);
          return;
        }
        if (!REGEX_DATA.test(campos[6])) {
          erros.push(`Linha ${numeroLinha}: data_pagamento inválida, esperado AAAAMMDD (ex: 20260813).`);
          return;
        }

        despesas.push({
          fornecedor: campos[1],
          documento,
          categoria: campos[3],
          valor,
          formaPagamento: campos[5],
          dataPagamento: campos[6],
          status,
        });
        break;
      }

      case "9": {
        if (campos.length !== CAMPOS_TOTALIZADOR) {
          erros.push(
            `Linha ${numeroLinha}: totalizador (tipo 9) deveria ter ${CAMPOS_TOTALIZADOR} campos, tem ${campos.length}.`
          );
          return;
        }
        const qtdRegistros = Number(campos[1]);
        const valorTotalGeral = Number(campos[2]);
        if (Number.isNaN(qtdRegistros) || Number.isNaN(valorTotalGeral)) {
          erros.push(`Linha ${numeroLinha}: totalizador com valores numéricos inválidos.`);
          return;
        }
        totalizador = { qtdRegistros, valorTotalGeral };
        break;
      }
    }
  });

  return { cabecalho, despesas, totalizador, ignorados, erros };
}
