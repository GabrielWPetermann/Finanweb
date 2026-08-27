// Parser manual do CSV de Entrada -- sem lib de CSV, split simples por virgula.
// Funciona porque o formato assume que nomes de cliente/categoria nao tem
// virgula. Ver README para o contrato completo do formato e essa limitacao.

const CAMPOS_CABECALHO = 10;
const CAMPOS_DETALHE = 12;
const CAMPOS_TOTALIZADOR = 3;

const REGEX_DATA = /^\d{8}$/;

export interface EntradaCabecalho {
  nomeEmpresa: string;
  cnpj: string;
  tipoDocumento: string;
  dataArquivo: string;
  usuario: string;
}

export interface EntradaPedido {
  cliente: string;
  documento: string;
  categoria: string;
  subtotal: number;
  descontoPercentual: number;
  descontoValor: number;
  frete: number;
  valorTotal: number;
  formaPagamento: string;
  dataPedido: string;
  status: string;
}

export interface EntradaTotalizador {
  qtdRegistros: number;
  valorTotalGeral: number;
}

export interface EntradaParseResult {
  cabecalho: EntradaCabecalho | null;
  pedidos: EntradaPedido[];
  totalizador: EntradaTotalizador | null;
  ignorados: number;
  erros: string[];
}

export function parseEntradaCsv(conteudo: string): EntradaParseResult {
  const linhas = conteudo.split(/\r?\n/).filter((linha) => linha.trim() !== "");

  let cabecalho: EntradaCabecalho | null = null;
  let totalizador: EntradaTotalizador | null = null;
  const pedidos: EntradaPedido[] = [];
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
          tipoDocumento: campos[7],
          dataArquivo: campos[8],
          usuario: campos[9],
        };
        break;
      }

      case "1": {
        if (campos.length !== CAMPOS_DETALHE) {
          erros.push(
            `Linha ${numeroLinha}: registro de cliente (tipo 1) deveria ter ${CAMPOS_DETALHE} campos, tem ${campos.length}. Confira se o arquivo não é do formato de Saída.`
          );
          return;
        }

        const status = campos[11].trim();
        if (status.toUpperCase() === "CANCELADO") {
          ignorados++;
          return;
        }

        const documento = campos[2].trim();
        if (!documento) {
          erros.push(`Linha ${numeroLinha}: campo documento (CNPJ/CPF do cliente) é obrigatório.`);
          return;
        }

        const subtotal = Number(campos[4]);
        const descontoPercentual = Number(campos[5]);
        const descontoValor = Number(campos[6]);
        const frete = Number(campos[7]);
        const valorTotal = Number(campos[8]);

        if ([subtotal, descontoPercentual, descontoValor, frete, valorTotal].some(Number.isNaN)) {
          erros.push(`Linha ${numeroLinha}: valores numéricos inválidos (subtotal/desconto/frete/valor_total).`);
          return;
        }
        if (!REGEX_DATA.test(campos[10])) {
          erros.push(`Linha ${numeroLinha}: data_pedido inválida, esperado AAAAMMDD (ex: 20260813).`);
          return;
        }

        pedidos.push({
          cliente: campos[1],
          documento,
          categoria: campos[3],
          subtotal,
          descontoPercentual,
          descontoValor,
          frete,
          valorTotal,
          formaPagamento: campos[9],
          dataPedido: campos[10],
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

  return { cabecalho, pedidos, totalizador, ignorados, erros };
}
