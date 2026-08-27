// Parser do CSV de Clientes/Fornecedores -- diferente do Entrada/Saida:
// aqui e dado mestre (cadastro), nao transacao, entao usa um CSV comum,
// com cabecalho de coluna nomeada, sem linha de totalizador.

const CABECALHO_ESPERADO = ["nome", "documento", "email", "telefone"];

export interface CadastroRegistro {
  nome: string;
  documento: string;
  email: string;
  telefone: string;
}

export interface CadastroParseResult {
  registros: CadastroRegistro[];
  erros: string[];
}

export function parseCadastroCsv(conteudo: string): CadastroParseResult {
  const linhas = conteudo.split(/\r?\n/).filter((linha) => linha.trim() !== "");
  const erros: string[] = [];
  const registros: CadastroRegistro[] = [];

  if (linhas.length === 0) {
    erros.push("Arquivo vazio.");
    return { registros, erros };
  }

  const cabecalho = linhas[0].split(",").map((campo) => campo.trim().toLowerCase());
  const cabecalhoValido =
    cabecalho.length === CABECALHO_ESPERADO.length &&
    CABECALHO_ESPERADO.every((campo, indice) => cabecalho[indice] === campo);

  if (!cabecalhoValido) {
    erros.push(`Cabeçalho inválido. Esperado exatamente: ${CABECALHO_ESPERADO.join(",")}`);
    return { registros, erros };
  }

  linhas.slice(1).forEach((linha, indice) => {
    const numeroLinha = indice + 2; // +1 por ser 1-based, +1 por pular o cabecalho
    const campos = linha.split(",");

    if (campos.length !== CABECALHO_ESPERADO.length) {
      erros.push(`Linha ${numeroLinha}: deveria ter ${CABECALHO_ESPERADO.length} campos, tem ${campos.length}.`);
      return;
    }

    const nome = campos[0].trim();
    if (!nome) {
      erros.push(`Linha ${numeroLinha}: nome é obrigatório.`);
      return;
    }

    registros.push({
      nome,
      documento: campos[1].trim(),
      email: campos[2].trim(),
      telefone: campos[3].trim(),
    });
  });

  return { registros, erros };
}
