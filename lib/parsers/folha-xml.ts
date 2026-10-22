// Parser da folha de pagamento que o RH envia (folha-v1.xsd). Para o
// Financeiro, cada funcionario e um valor a pagar na dataPagamento da folha.
//
// O XSD e conferido antes. Aqui sobram as contas que ele nao expressa:
// salarioLiquido = salarioBruto - descontos, e o totalizador.

import { atributo, centavos, criarParser, lerCabecalho, texto, type EnvioCabecalho, type No } from "@/lib/parsers/envio-xml";

export interface FolhaFuncionario {
  cpf: string;
  nome: string;
  salarioLiquido: number;
}

export interface FolhaParseResult {
  cabecalho: EnvioCabecalho | null;
  referencia: string; // da folha; cada funcionario vira <referencia>/<cpf>
  competencia: string; // AAAA-MM
  dataPagamento: string; // AAAA-MM-DD
  funcionarios: FolhaFuncionario[];
  erros: string[];
}

const parser = criarParser("funcionario");

export function parseFolhaXml(conteudo: string): FolhaParseResult {
  const resultado: FolhaParseResult = {
    cabecalho: null,
    referencia: "",
    competencia: "",
    dataPagamento: "",
    funcionarios: [],
    erros: [],
  };

  let documento: No;
  try {
    documento = parser.parse(conteudo) as No;
  } catch {
    return { ...resultado, erros: ["Arquivo XML mal formado."] };
  }

  const folha = documento.folha as No | undefined;
  resultado.cabecalho = lerCabecalho(folha?.cabecalho);
  if (!folha || !resultado.cabecalho) {
    return { ...resultado, erros: ["Elementos <folha> e <cabecalho> são obrigatórios."] };
  }

  resultado.referencia = atributo(folha, "referencia");
  resultado.competencia = texto(folha.competencia);
  resultado.dataPagamento = texto(folha.dataPagamento);

  let somaLiquido = 0;
  const lista = ((folha.funcionarios as No | undefined)?.funcionario ?? []) as No[];
  for (const funcionario of lista) {
    const cpf = atributo(funcionario, "cpf");
    const bruto = texto(funcionario.salarioBruto);
    const descontos = texto(funcionario.descontos);
    const liquido = texto(funcionario.salarioLiquido);
    if (centavos(bruto) - centavos(descontos) !== centavos(liquido)) {
      resultado.erros.push(`Funcionário ${cpf}: salarioLiquido ${liquido} diferente de salarioBruto - descontos.`);
      continue;
    }
    somaLiquido += centavos(liquido);
    resultado.funcionarios.push({
      cpf,
      nome: texto(funcionario.nome),
      salarioLiquido: Number(liquido),
    });
  }

  const totalizador = folha.totalizador as No | undefined;
  const qtdFuncionarios = Number(texto(totalizador?.qtdFuncionarios));
  const valorLiquidoTotal = texto(totalizador?.valorLiquidoTotal);
  if (qtdFuncionarios !== lista.length) {
    resultado.erros.push(`Totalizador: qtdFuncionarios ${qtdFuncionarios}, mas a folha tem ${lista.length}.`);
  }
  if (resultado.erros.length === 0 && centavos(valorLiquidoTotal) !== somaLiquido) {
    resultado.erros.push(
      `Totalizador: valorLiquidoTotal ${valorLiquidoTotal}, mas a soma dos líquidos é ${(somaLiquido / 100).toFixed(2)}.`
    );
  }

  return resultado;
}
