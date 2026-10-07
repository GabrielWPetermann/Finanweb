"use server";

import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";
import { parseCadastroCsv } from "@/lib/parsers/cadastro";
import { importarParceiroCadastro } from "@/lib/parceiros";
import { MAX_BYTES_XML } from "@/lib/xml/validador";
import { formatarErrosParser, importarMovimento, type ResultadoImportacao } from "@/lib/importacao";

export type { ResultadoImportacao };

export async function importarAction(
  _estadoAnterior: ResultadoImportacao,
  formData: FormData
): Promise<ResultadoImportacao> {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return { ok: false, erro: "Sessão expirada. Faça login novamente." };
  }

  const tipo = String(formData.get("tipo") ?? "");
  const arquivo = formData.get("arquivo");

  if (tipo !== "ENTRADA" && tipo !== "SAIDA" && tipo !== "CLIENTES" && tipo !== "FORNECEDORES") {
    return { ok: false, erro: "Selecione o tipo do arquivo." };
  }
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, erro: "Selecione um arquivo CSV ou XML." };
  }

  const nomeArquivo = arquivo.name.toLowerCase();
  const ehXml = nomeArquivo.endsWith(".xml");
  if (!ehXml && !nomeArquivo.endsWith(".csv")) {
    return { ok: false, erro: "O arquivo precisa ter extensão .csv ou .xml." };
  }
  if (ehXml && arquivo.size > MAX_BYTES_XML) {
    return {
      ok: false,
      erro: `Arquivo XML muito grande (${(arquivo.size / 1024 / 1024).toFixed(1)} MB). O limite é de 10 MB — divida o movimento em arquivos menores ou envie em CSV.`,
    };
  }

  const conteudo = await arquivo.text();

  if (tipo === "CLIENTES" || tipo === "FORNECEDORES") {
    // Cadastro e uma lista plana, sem cabecalho nem totalizador: nao ha XSD
    // para ele. So Entrada e Saida tem contrato XML.
    if (ehXml) {
      return {
        ok: false,
        erro: "Cadastro de clientes e fornecedores aceita apenas CSV. O formato XML está disponível para Entrada e Saída.",
      };
    }

    const resultadoCadastro = parseCadastroCsv(conteudo);
    if (resultadoCadastro.erros.length > 0) {
      return { ok: false, erro: formatarErrosParser(resultadoCadastro.erros) };
    }
    if (resultadoCadastro.registros.length === 0) {
      return { ok: false, erro: "Arquivo sem nenhum registro." };
    }

    const tipoParceiro = tipo === "CLIENTES" ? "CLIENTE" : "FORNECEDOR";
    let qtdCriados = 0;
    let qtdAtualizados = 0;

    try {
      await prisma.$transaction(async (tx) => {
        for (const registro of resultadoCadastro.registros) {
          const resultadoUpsert = await importarParceiroCadastro(tx, registro, tipoParceiro);
          if (resultadoUpsert === "criado") qtdCriados++;
          else qtdAtualizados++;
        }
      });
    } catch (erro) {
      console.error(erro);
      return { ok: false, erro: "Não foi possível gravar o cadastro. Tente novamente." };
    }

    return {
      ok: true,
      qtdRegistros: resultadoCadastro.registros.length,
      qtdCriados,
      qtdAtualizados,
    };
  }

  return importarMovimento(tipo, arquivo.name, conteudo, usuario.id);
}
