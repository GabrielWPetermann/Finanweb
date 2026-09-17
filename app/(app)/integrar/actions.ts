"use server";

import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";
import { parseEntradaCsv } from "@/lib/parsers/entrada";
import { parseSaidaCsv } from "@/lib/parsers/saida";
import { parseCadastroCsv } from "@/lib/parsers/cadastro";
import { parseEntradaXml } from "@/lib/parsers/entrada-xml";
import { parseSaidaXml } from "@/lib/parsers/saida-xml";
import { SCHEMA_POR_TIPO, validarContraXsd } from "@/lib/xml/validador";
import { resolverParceiroPorDocumento, importarParceiroCadastro } from "@/lib/parceiros";

export interface ResultadoImportacao {
  ok: boolean;
  erro?: string;
  qtdRegistros?: number;
  qtdIgnorados?: number;
  valorTotal?: number;
  qtdCriados?: number;
  qtdAtualizados?: number;
}

function parseDataAAAAMMDD(valor: string): Date {
  const ano = Number(valor.slice(0, 4));
  const mes = Number(valor.slice(4, 6));
  const dia = Number(valor.slice(6, 8));
  return new Date(Date.UTC(ano, mes - 1, dia));
}

const MAX_ERROS_EXIBIDOS = 5;

function formatarErrosParser(erros: string[]): string {
  const exibidos = erros.slice(0, MAX_ERROS_EXIBIDOS).join(" ");
  const restante = erros.length - MAX_ERROS_EXIBIDOS;
  return restante > 0 ? `${exibidos} (+${restante} outro(s) problema(s) no arquivo)` : exibidos;
}

// So para XML: a validacao no XSD monta a arvore inteira em memoria (libxml2
// em WebAssembly), entao um arquivo muito grande derruba a funcao. O limite
// nao se aplica ao CSV, que e lido linha a linha como sempre foi.
const MAX_BYTES_XML = 10 * 1024 * 1024;

function mensagemFormatoInvalido(ehXml: boolean): string {
  return ehXml
    ? "Arquivo fora do formato esperado (faltam <cabecalho>, <totalizador> ou registros)."
    : "Arquivo fora do formato esperado (faltam linhas tipo 0/1/9).";
}

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
  const contentTypeBlob = ehXml ? "application/xml" : "text/csv";

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

  if (tipo === "ENTRADA") {
    // O XSD e conferido antes do parse: o que ele reprova nem chega a ser
    // interpretado, e os erros ja vem com o numero da linha do arquivo.
    if (ehXml) {
      const errosXsd = await validarContraXsd(conteudo, SCHEMA_POR_TIPO.ENTRADA);
      if (errosXsd.length > 0) {
        return { ok: false, erro: formatarErrosParser(errosXsd) };
      }
    }

    const resultado = ehXml ? parseEntradaXml(conteudo) : parseEntradaCsv(conteudo);
    if (resultado.erros.length > 0) {
      return { ok: false, erro: formatarErrosParser(resultado.erros) };
    }
    if (!resultado.cabecalho || !resultado.totalizador || resultado.pedidos.length === 0) {
      return { ok: false, erro: mensagemFormatoInvalido(ehXml) };
    }

    const totalizador = resultado.totalizador;

    try {
      const blob = await put(`entradas/${Date.now()}-${arquivo.name}`, conteudo, {
        access: "private",
        contentType: contentTypeBlob,
      });

      await prisma.$transaction(async (tx) => {
        const importacao = await tx.importacao.create({
          data: {
            tipo: "ENTRADA",
            nomeArquivo: arquivo.name,
            blobUrl: blob.url,
            usuarioId: usuario.id,
            dataArquivoOriginal: resultado.cabecalho?.dataArquivo
              ? parseDataAAAAMMDD(resultado.cabecalho.dataArquivo)
              : null,
            qtdRegistros: totalizador.qtdRegistros,
            valorTotal: totalizador.valorTotalGeral,
          },
        });

        for (const pedido of resultado.pedidos) {
          const categoria = await tx.categoria.upsert({
            where: { nome_tipo: { nome: pedido.categoria, tipo: "ENTRADA" } },
            create: { nome: pedido.categoria, tipo: "ENTRADA" },
            update: {},
          });
          const cliente = await resolverParceiroPorDocumento(tx, pedido.cliente, pedido.documento, "CLIENTE");

          await tx.pedidoAgrupado.create({
            data: {
              importacaoId: importacao.id,
              clienteId: cliente.id,
              categoriaId: categoria.id,
              subtotal: pedido.subtotal,
              descontoPercentual: pedido.descontoPercentual,
              descontoValor: pedido.descontoValor,
              frete: pedido.frete,
              valorTotal: pedido.valorTotal,
              formaPagamento: pedido.formaPagamento,
              dataPedido: parseDataAAAAMMDD(pedido.dataPedido),
              status: pedido.status,
            },
          });
        }
      });
    } catch (erro) {
      console.error(erro);
      return { ok: false, erro: "Não foi possível gravar a importação. Tente novamente." };
    }

    return {
      ok: true,
      qtdRegistros: resultado.pedidos.length,
      qtdIgnorados: resultado.ignorados,
      valorTotal: totalizador.valorTotalGeral,
    };
  }

  if (ehXml) {
    const errosXsd = await validarContraXsd(conteudo, SCHEMA_POR_TIPO.SAIDA);
    if (errosXsd.length > 0) {
      return { ok: false, erro: formatarErrosParser(errosXsd) };
    }
  }

  const resultado = ehXml ? parseSaidaXml(conteudo) : parseSaidaCsv(conteudo);
  if (resultado.erros.length > 0) {
    return { ok: false, erro: formatarErrosParser(resultado.erros) };
  }
  if (!resultado.cabecalho || !resultado.totalizador || resultado.despesas.length === 0) {
    return { ok: false, erro: mensagemFormatoInvalido(ehXml) };
  }

  const totalizador = resultado.totalizador;

  try {
    const blob = await put(`saidas/${Date.now()}-${arquivo.name}`, conteudo, {
      access: "private",
      contentType: contentTypeBlob,
    });

    await prisma.$transaction(async (tx) => {
      const importacao = await tx.importacao.create({
        data: {
          tipo: "SAIDA",
          nomeArquivo: arquivo.name,
          blobUrl: blob.url,
          usuarioId: usuario.id,
          dataArquivoOriginal: resultado.cabecalho?.dataArquivo
            ? parseDataAAAAMMDD(resultado.cabecalho.dataArquivo)
            : null,
          qtdRegistros: totalizador.qtdRegistros,
          valorTotal: totalizador.valorTotalGeral,
        },
      });

      for (const despesa of resultado.despesas) {
        const categoria = await tx.categoria.upsert({
          where: { nome_tipo: { nome: despesa.categoria, tipo: "SAIDA" } },
          create: { nome: despesa.categoria, tipo: "SAIDA" },
          update: {},
        });
        const fornecedor = await resolverParceiroPorDocumento(
          tx,
          despesa.fornecedor,
          despesa.documento,
          "FORNECEDOR"
        );

        await tx.despesaAgrupada.create({
          data: {
            importacaoId: importacao.id,
            fornecedorId: fornecedor.id,
            categoriaId: categoria.id,
            valor: despesa.valor,
            formaPagamento: despesa.formaPagamento,
            dataPagamento: parseDataAAAAMMDD(despesa.dataPagamento),
            status: despesa.status,
          },
        });
      }
    });
  } catch (erro) {
    console.error(erro);
    return { ok: false, erro: "Não foi possível gravar a importação. Tente novamente." };
  }

  return {
    ok: true,
    qtdRegistros: resultado.despesas.length,
    qtdIgnorados: resultado.ignorados,
    valorTotal: totalizador.valorTotalGeral,
  };
}
