// Gravacao de um movimento de Entrada ou Saida (CSV ou XML) no banco.
//
// Compartilhada pela tela de integrar e pelos arquivos recebidos via socket
// (/socket), para os dois caminhos passarem exatamente pelas mesmas
// validacoes: XSD, parser, Blob com o arquivo original e transacao no banco.
//
// Os envios dos outros setores (venda e compra v2, folha) tem gravacao
// propria, no fim do arquivo: chegam so em XML e trazem origem + referencia,
// que impedem um reenvio de duplicar o lancamento.

import { Prisma } from "@prisma/client";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { parseEntradaCsv } from "@/lib/parsers/entrada";
import { parseSaidaCsv } from "@/lib/parsers/saida";
import { parseEntradaXml } from "@/lib/parsers/entrada-xml";
import { parseSaidaXml } from "@/lib/parsers/saida-xml";
import { parseEntradaV2Xml } from "@/lib/parsers/entrada-v2-xml";
import { parseSaidaV2Xml } from "@/lib/parsers/saida-v2-xml";
import { parseFolhaXml } from "@/lib/parsers/folha-xml";
import type { EnvioCabecalho } from "@/lib/parsers/envio-xml";
import { SCHEMA_POR_TIPO, validarContraXsd, type SchemaXml } from "@/lib/xml/validador";
import { detectarMovimento, type TipoMovimento } from "@/lib/socket/caixa-entrada";
import { resolverParceiroPorDocumento } from "@/lib/parceiros";

export interface ResultadoImportacao {
  ok: boolean;
  erro?: string;
  qtdRegistros?: number;
  qtdIgnorados?: number;
  // Envios dos setores: registros que ja tinham sido lancados (mesma origem +
  // referencia) e foram pulados sem mudanca.
  qtdRepetidos?: number;
  valorTotal?: number;
  qtdCriados?: number;
  // Cadastro: parceiros atualizados. Envios dos setores: lancamentos em aberto
  // que mudaram de status ou vencimento num reenvio.
  qtdAtualizados?: number;
}

type Banco = Prisma.TransactionClient;

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

const NOME_TIPO: Record<TipoMovimento, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  FOLHA: "folha de pagamento",
};

/**
 * Valida e grava um movimento. O formato (CSV ou XML) vem da extensao de
 * nomeArquivo, que tambem e o nome que aparece no Historico. No XML, o
 * namespace diz se e o formato interno (v1) ou um envio de outro setor.
 */
export async function importarMovimento(
  tipo: TipoMovimento,
  nomeArquivo: string,
  conteudo: string,
  usuarioId: string
): Promise<ResultadoImportacao> {
  const ehXml = nomeArquivo.toLowerCase().endsWith(".xml");
  const contentTypeBlob = ehXml ? "application/xml" : "text/csv";

  const formato = ehXml ? detectarMovimento(conteudo) : null;
  if (formato && formato.schema !== SCHEMA_POR_TIPO.ENTRADA && formato.schema !== SCHEMA_POR_TIPO.SAIDA) {
    // A folha vira Saida, entao na tela de integrar ela entra como Saida.
    const lancadoComo = formato.tipo === "FOLHA" ? "SAIDA" : formato.tipo;
    if (tipo !== formato.tipo && tipo !== lancadoComo) {
      return {
        ok: false,
        erro: `O arquivo é de ${NOME_TIPO[formato.tipo]} (${formato.schema}), não de ${NOME_TIPO[tipo]}.`,
      };
    }
    return importarEnvioSetor(formato.schema, nomeArquivo, conteudo, usuarioId);
  }
  if (tipo === "FOLHA") {
    return { ok: false, erro: "A folha de pagamento só é aceita em XML, no formato folha-v1.xsd." };
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

// ===================== Envios dos outros setores =====================

// A folha nao diz como cada salario e pago: a forma de pagamento so marca
// que o lancamento veio dela, em vez de inventar uma.
const CATEGORIA_FOLHA = "Folha de pagamento";
const FORMA_PAGAMENTO_FOLHA = "Folha de pagamento";

function parseDataIso(valor: string): Date {
  return new Date(`${valor}T00:00:00.000Z`);
}

interface LancamentoEnvio {
  referencia: string;
  valor: number;
  // Status e vencimento que o setor mandou, comparados com o lancamento ja
  // gravado num reenvio. A folha nao manda status: fica sem.
  status?: string;
  vencimento?: string; // AAAA-MM-DD
  // Ausente nos CANCELADO: nunca viram lancamento novo, so cancelam um que ja
  // esteja em aberto.
  gravar?: (tx: Banco, importacaoId: string) => Promise<void>;
}

interface Envio {
  tipo: "ENTRADA" | "SAIDA";
  cabecalho: EnvioCabecalho;
  lancamentos: LancamentoEnvio[];
}

function cancelamentos(referencias: string[]): LancamentoEnvio[] {
  return referencias.map((referencia) => ({ referencia, valor: 0, status: "CANCELADO" }));
}

type Leitura = Envio | { erro: string };

async function categoriaPorNome(tx: Banco, nome: string, tipo: "ENTRADA" | "SAIDA") {
  return tx.categoria.upsert({
    where: { nome_tipo: { nome, tipo } },
    create: { nome, tipo },
    update: {},
  });
}

function lerVenda(conteudo: string): Leitura {
  const resultado = parseEntradaV2Xml(conteudo);
  if (resultado.erros.length > 0) return { erro: formatarErrosParser(resultado.erros) };
  if (!resultado.cabecalho) return { erro: mensagemFormatoInvalido(true) };
  const { origem } = resultado.cabecalho;

  return {
    tipo: "ENTRADA",
    cabecalho: resultado.cabecalho,
    lancamentos: [
      ...resultado.pedidos.map((pedido): LancamentoEnvio => ({
        referencia: pedido.referencia,
        valor: pedido.valorTotal,
        status: pedido.status,
        vencimento: pedido.vencimento,
        gravar: async (tx, importacaoId) => {
          const categoria = await categoriaPorNome(tx, pedido.categoria, "ENTRADA");
          const cliente = await resolverParceiroPorDocumento(tx, pedido.cliente, pedido.documento, "CLIENTE");
          await tx.pedidoAgrupado.create({
            data: {
              importacaoId,
              clienteId: cliente.id,
              categoriaId: categoria.id,
              subtotal: pedido.subtotal,
              descontoPercentual: pedido.descontoPercentual,
              descontoValor: pedido.descontoValor,
              frete: pedido.frete,
              valorTotal: pedido.valorTotal,
              formaPagamento: pedido.formaPagamento,
              dataPedido: parseDataIso(pedido.dataPedido),
              vencimento: parseDataIso(pedido.vencimento),
              status: pedido.status,
              origem,
              referencia: pedido.referencia,
            },
          });
        },
      })),
      ...cancelamentos(resultado.cancelados),
    ],
  };
}

function lerCompra(conteudo: string): Leitura {
  const resultado = parseSaidaV2Xml(conteudo);
  if (resultado.erros.length > 0) return { erro: formatarErrosParser(resultado.erros) };
  if (!resultado.cabecalho) return { erro: mensagemFormatoInvalido(true) };
  const { origem } = resultado.cabecalho;

  return {
    tipo: "SAIDA",
    cabecalho: resultado.cabecalho,
    lancamentos: [
      ...resultado.despesas.map((despesa): LancamentoEnvio => ({
        referencia: despesa.referencia,
        valor: despesa.valor,
        status: despesa.status,
        vencimento: despesa.vencimento,
        gravar: async (tx, importacaoId) => {
          const categoria = await categoriaPorNome(tx, despesa.categoria, "SAIDA");
          const fornecedor = await resolverParceiroPorDocumento(
            tx,
            despesa.fornecedor,
            despesa.documento,
            "FORNECEDOR"
          );
          await tx.despesaAgrupada.create({
            data: {
              importacaoId,
              fornecedorId: fornecedor.id,
              categoriaId: categoria.id,
              valor: despesa.valor,
              formaPagamento: despesa.formaPagamento,
              // Relatorios e exportacao filtram as Saidas por dataPagamento:
              // com a emissao, a compra aparece no periodo em que foi feita. O
              // prazo fica no vencimento.
              dataPagamento: parseDataIso(despesa.dataEmissao),
              vencimento: parseDataIso(despesa.vencimento),
              status: despesa.status,
              origem,
              referencia: despesa.referencia,
            },
          });
        },
      })),
      ...cancelamentos(resultado.cancelados),
    ],
  };
}

function lerFolha(conteudo: string): Leitura {
  const resultado = parseFolhaXml(conteudo);
  if (resultado.erros.length > 0) return { erro: formatarErrosParser(resultado.erros) };
  if (!resultado.cabecalho) return { erro: mensagemFormatoInvalido(true) };
  const { origem } = resultado.cabecalho;
  const dataPagamento = parseDataIso(resultado.dataPagamento);

  return {
    tipo: "SAIDA",
    cabecalho: resultado.cabecalho,
    // Uma despesa por funcionario, com o liquido. A referencia leva o CPF
    // para a chave origem + referencia ser unica por funcionario.
    lancamentos: resultado.funcionarios.map((funcionario) => ({
      referencia: `${resultado.referencia}/${funcionario.cpf}`,
      valor: funcionario.salarioLiquido,
      gravar: async (tx, importacaoId) => {
        const categoria = await categoriaPorNome(tx, CATEGORIA_FOLHA, "SAIDA");
        // Funcionario entra como fornecedor, pelo CPF: para o Financeiro e
        // alguem a quem pagar, e um tipo proprio exigiria mudar o enum.
        const parceiro = await resolverParceiroPorDocumento(tx, funcionario.nome, funcionario.cpf, "FORNECEDOR");
        await tx.despesaAgrupada.create({
          data: {
            importacaoId,
            fornecedorId: parceiro.id,
            categoriaId: categoria.id,
            valor: funcionario.salarioLiquido,
            formaPagamento: FORMA_PAGAMENTO_FOLHA,
            dataPagamento,
            vencimento: dataPagamento,
            status: "PENDENTE",
            origem,
            referencia: `${resultado.referencia}/${funcionario.cpf}`,
          },
        });
      },
    })),
  };
}

const LEITORES: Partial<Record<SchemaXml, (conteudo: string) => Leitura>> = {
  "entrada-v2.xsd": lerVenda,
  "saida-v2.xsd": lerCompra,
  "folha-v1.xsd": lerFolha,
};

async function importarEnvioSetor(
  schema: SchemaXml,
  nomeArquivo: string,
  conteudo: string,
  usuarioId: string
): Promise<ResultadoImportacao> {
  const ler = LEITORES[schema];
  if (!ler) return { ok: false, erro: `O Finanweb ainda não importa ${schema}.` };

  const errosXsd = await validarContraXsd(conteudo, schema);
  if (errosXsd.length > 0) return { ok: false, erro: formatarErrosParser(errosXsd) };

  const envio = ler(conteudo);
  if ("erro" in envio) return { ok: false, erro: envio.erro };

  // Reenvio nao duplica. O que ja foi lancado com a mesma origem +
  // referencia so muda enquanto estiver em aberto (PENDENTE): passa a ter o
  // status e o vencimento do arquivo, para o setor poder avisar que recebeu ou
  // pagou (CONFIRMADO), que desistiu (CANCELADO) ou que renegociou o prazo.
  // Lancamento ja baixado no Financeiro nao volta para PENDENTE.
  const { origem } = envio.cabecalho;
  const consulta = {
    where: { origem, referencia: { in: envio.lancamentos.map((l) => l.referencia) } },
    select: { id: true, referencia: true, status: true, vencimento: true },
  };
  const jaLancados =
    envio.tipo === "ENTRADA"
      ? await prisma.pedidoAgrupado.findMany(consulta)
      : await prisma.despesaAgrupada.findMany(consulta);
  const porReferencia = new Map(jaLancados.map((r) => [r.referencia, r]));

  const novos: LancamentoEnvio[] = [];
  const atualizacoes: { id: string; data: { status: string; vencimento?: Date } }[] = [];
  let qtdRepetidos = 0;
  let qtdIgnorados = 0;
  for (const lancamento of envio.lancamentos) {
    const existente = porReferencia.get(lancamento.referencia);
    if (!existente) {
      if (lancamento.gravar) novos.push(lancamento);
      else qtdIgnorados++; // CANCELADO de algo que nunca foi lancado
      continue;
    }

    const emAberto = existente.status.trim().toUpperCase() === "PENDENTE";
    const status = lancamento.status ?? existente.status;
    const vencimento = lancamento.vencimento ? parseDataIso(lancamento.vencimento) : undefined;
    const mudouStatus = status.toUpperCase() !== existente.status.trim().toUpperCase();
    const mudouVencimento = vencimento !== undefined && vencimento.getTime() !== existente.vencimento?.getTime();
    if (emAberto && (mudouStatus || mudouVencimento)) {
      atualizacoes.push({ id: existente.id, data: { status, ...(mudouVencimento ? { vencimento } : {}) } });
    } else {
      qtdRepetidos++;
    }
  }

  if (novos.length === 0 && atualizacoes.length === 0) {
    return {
      ok: false,
      erro:
        qtdRepetidos === 0
          ? "Nenhum registro para lançar: todos estão CANCELADO."
          : `Nada novo: os ${qtdRepetidos} registro(s) já tinham sido lançados antes (mesma origem "${origem}" e referência), sem mudança de status ou vencimento.`,
    };
  }

  const valorTotal = Math.round(novos.reduce((soma, l) => soma + l.valor * 100, 0)) / 100;

  try {
    // So atualizacao, sem lancamento novo: nao vira importacao no Historico,
    // que conta o que entrou.
    const pasta = envio.tipo === "ENTRADA" ? "entradas" : "saidas";
    const blob =
      novos.length > 0
        ? await put(`${pasta}/${Date.now()}-${nomeArquivo}`, conteudo, {
            access: "private",
            contentType: "application/xml",
          })
        : null;

    await prisma.$transaction(async (tx) => {
      if (blob) {
        const importacao = await tx.importacao.create({
          data: {
            tipo: envio.tipo,
            nomeArquivo,
            blobUrl: blob.url,
            usuarioId,
            dataArquivoOriginal: parseDataIso(envio.cabecalho.dataArquivo),
            qtdRegistros: novos.length,
            valorTotal,
          },
        });
        for (const lancamento of novos) {
          await lancamento.gravar?.(tx, importacao.id);
        }
      }
      for (const { id, data } of atualizacoes) {
        if (envio.tipo === "ENTRADA") await tx.pedidoAgrupado.update({ where: { id }, data });
        else await tx.despesaAgrupada.update({ where: { id }, data });
      }
    });
  } catch (erro) {
    // Outra aprovacao lancou parte do arquivo entre a conferencia acima e a
    // gravacao: o unique de origem + referencia barra a duplicata.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return {
        ok: false,
        erro: "Parte deste arquivo acabou de ser lançada por outra importação. Tente de novo para lançar só o que falta.",
      };
    }
    console.error(erro);
    return { ok: false, erro: "Não foi possível gravar a importação. Tente novamente." };
  }

  return {
    ok: true,
    qtdRegistros: novos.length,
    qtdIgnorados,
    qtdRepetidos,
    qtdAtualizados: atualizacoes.length,
    valorTotal,
  };
}
