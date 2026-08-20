// Parser manual do CSV de Saida -- mesma abordagem do parser de Entrada
// (split simples por virgula, sem lib de CSV). Ver README para o formato.

export interface SaidaCabecalho {
  nomeEmpresa: string;
  cnpj: string;
  tipoDocumento: string;
  dataArquivo: string;
  usuario: string;
}

export interface SaidaDespesa {
  fornecedor: string;
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
}

export function parseSaidaCsv(conteudo: string): SaidaParseResult {
  const linhas = conteudo.split(/\r?\n/).filter((linha) => linha.trim() !== "");

  let cabecalho: SaidaCabecalho | null = null;
  let totalizador: SaidaTotalizador | null = null;
  const despesas: SaidaDespesa[] = [];
  let ignorados = 0;

  for (const linha of linhas) {
    const campos = linha.split(",");

    switch (campos[0]) {
      case "0":
        cabecalho = {
          nomeEmpresa: campos[1] ?? "",
          cnpj: campos[2] ?? "",
          tipoDocumento: campos[5] ?? "",
          dataArquivo: campos[6] ?? "",
          usuario: campos[7] ?? "",
        };
        break;

      case "1": {
        const status = (campos[6] ?? "").trim();
        if (status.toUpperCase() === "CANCELADO") {
          ignorados++;
          break;
        }
        despesas.push({
          fornecedor: campos[1] ?? "",
          categoria: campos[2] ?? "",
          valor: Number(campos[3]),
          formaPagamento: campos[4] ?? "",
          dataPagamento: campos[5] ?? "",
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

  return { cabecalho, despesas, totalizador, ignorados };
}
