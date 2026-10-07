// Gravacao de um movimento de Entrada ou Saida (CSV ou XML) no banco.
//
// Compartilhada pela tela de integrar e pelos arquivos recebidos via socket
// (/socket), para os dois caminhos passarem exatamente pelas mesmas
// validacoes: XSD, parser, Blob com o arquivo original e transacao no banco.

import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { parseEntradaCsv } from "@/lib/parsers/entrada";
import { parseSaidaCsv } from "@/lib/parsers/saida";
import { parseEntradaXml } from "@/lib/parsers/entrada-xml";
import { parseSaidaXml } from "@/lib/parsers/saida-xml";
import { SCHEMA_POR_TIPO, validarContraXsd } from "@/lib/xml/validador";
import { resolverParceiroPorDocumento } from "@/lib/parceiros";

export interface ResultadoImportacao {
  ok: boolean;
  erro?: string;
  qtdRegistros?: number;
  qtdIgnorados?: number;
  valorTotal?: number;
  qtdCriados?: number;
  qtdAtualizados?: number;
}

const MAX_ERROS_EXIBIDOS = 5;

export function formatarErrosParser(erros: string[]): string {
  const exibidos = erros.slice(0, MAX_ERROS_EXIBIDOS).join(" ");
  const restante = erros.length - MAX_ERROS_EXIBIDOS;
  return restante > 0 ? `${exibidos} (+${restante} outro(s) problema(s) no arquivo)` : exibidos;
}

function parseDataAAAAMMDD(valor: string): Date {
  const ano = Number(valor.slice(0, 4));
  const mes = Number(valor.slice(4, 6));
  const dia = Number(valor.slice(6, 8));
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function mensagemFormatoInvalido(ehXml: boolean): string {
  return ehXml
    ? "Arquivo fora do formato esperado (faltam <cabecalho>, <totalizador> ou registros)."
    : "Arquivo fora do formato esperado (faltam linhas tipo 0/1/9).";
}

/**
 * Valida e grava um movimento. O formato (CSV ou XML) vem da extensao de
 * nomeArquivo, que tambem e o nome que aparece no Historico.
 */
export async function importarMovimento(
  tipo: "ENTRADA" | "SAIDA",
  nomeArquivo: string,
  conteudo: string,
  usuarioId: string
): Promise<ResultadoImportacao> {
  const ehXml = nomeArquivo.toLowerCase().endsWith(".xml");
  const contentTypeBlob = ehXml ? "application/xml" : "text/csv";

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
      const blob = await put(`entradas/${Date.now()}-${nomeArquivo}`, conteudo, {
        access: "private",
        contentType: contentTypeBlob,
      });

      await prisma.$transaction(async (tx) => {
        const importacao = await tx.importacao.create({
          data: {
            tipo: "ENTRADA",
            nomeArquivo,
            blobUrl: blob.url,
            usuarioId,
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
    const blob = await put(`saidas/${Date.now()}-${nomeArquivo}`, conteudo, {
      access: "private",
      contentType: contentTypeBlob,
    });

    await prisma.$transaction(async (tx) => {
      const importacao = await tx.importacao.create({
        data: {
          tipo: "SAIDA",
          nomeArquivo,
          blobUrl: blob.url,
          usuarioId,
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
