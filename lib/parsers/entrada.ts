// Parser manual do CSV de Entrada -- sem lib de CSV, split simples por virgula.
// Funciona porque o formato assume que nomes de cliente/categoria nao tem
// virgula. Ver README para o contrato completo do formato e essa limitacao.

export interface EntradaCabecalho {
  nomeEmpresa: string;
  cnpj: string;
  tipoDocumento: string;
  dataArquivo: string;
  usuario: string;
}

export interface EntradaPedido {
  cliente: string;
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
}

export function parseEntradaCsv(conteudo: string): EntradaParseResult {
  const linhas = conteudo.split(/\r?\n/).filter((linha) => linha.trim() !== "");

  let cabecalho: EntradaCabecalho | null = null;
  let totalizador: EntradaTotalizador | null = null;
  const pedidos: EntradaPedido[] = [];
  let ignorados = 0;

  for (const linha of linhas) {
    const campos = linha.split(",");

    switch (campos[0]) {
      case "0":
        cabecalho = {
          nomeEmpresa: campos[1] ?? "",
          cnpj: campos[2] ?? "",
          tipoDocumento: campos[7] ?? "",
          dataArquivo: campos[8] ?? "",
          usuario: campos[9] ?? "",
        };
        break;

      case "1": {
        const status = (campos[10] ?? "").trim();
        if (status.toUpperCase() === "CANCELADO") {
          ignorados++;
          break;
        }
        pedidos.push({
          cliente: campos[1] ?? "",
          categoria: campos[2] ?? "",
          subtotal: Number(campos[3]),
          descontoPercentual: Number(campos[4]),
          descontoValor: Number(campos[5]),
          frete: Number(campos[6]),
          valorTotal: Number(campos[7]),
          formaPagamento: campos[8] ?? "",
          dataPedido: campos[9] ?? "",
          status,
        });
        break;
      }

      case "9":
        totalizador = {
          qtdRegistros: Number(campos[1]),
          valorTotalGeral: Number(campos[2]),
        };
        break;
    }
  }

  return { cabecalho, pedidos, totalizador, ignorados };
}
