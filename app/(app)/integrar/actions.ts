"use server";

import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";
import { parseEntradaCsv } from "@/lib/parsers/entrada";
import { parseSaidaCsv } from "@/lib/parsers/saida";
import { resolverParceiroPorDocumento } from "@/lib/parceiros";

export interface ResultadoImportacao {
  ok: boolean;
  erro?: string;
  qtdRegistros?: number;
  qtdIgnorados?: number;
  valorTotal?: number;
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

  if (tipo !== "ENTRADA" && tipo !== "SAIDA") {
    return { ok: false, erro: "Selecione o tipo do arquivo." };
  }
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, erro: "Selecione um arquivo CSV." };
  }
  if (!arquivo.name.toLowerCase().endsWith(".csv")) {
    return { ok: false, erro: "O arquivo precisa ter extensão .csv." };
  }

  const conteudo = await arquivo.text();

  if (tipo === "ENTRADA") {
    const resultado = parseEntradaCsv(conteudo);
    if (resultado.erros.length > 0) {
      return { ok: false, erro: formatarErrosParser(resultado.erros) };
    }
    if (!resultado.cabecalho || !resultado.totalizador || resultado.pedidos.length === 0) {
      return { ok: false, erro: "Arquivo fora do formato esperado (faltam linhas tipo 0/1/9)." };
    }

    const totalizador = resultado.totalizador;

    try {
      const blob = await put(`entradas/${Date.now()}-${arquivo.name}`, conteudo, {
        access: "private",
        contentType: "text/csv",
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

  const resultado = parseSaidaCsv(conteudo);
  if (resultado.erros.length > 0) {
    return { ok: false, erro: formatarErrosParser(resultado.erros) };
  }
  if (!resultado.cabecalho || !resultado.totalizador || resultado.despesas.length === 0) {
    return { ok: false, erro: "Arquivo fora do formato esperado (faltam linhas tipo 0/1/9)." };
  }

  const totalizador = resultado.totalizador;

  try {
    const blob = await put(`saidas/${Date.now()}-${arquivo.name}`, conteudo, {
      access: "private",
      contentType: "text/csv",
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
