// Consultas que os outros setores fazem ao Financeiro pelo socket:
// inadimplencia de cliente (Vendas) e pendencias com fornecedor (Compras).
//
// O ouvinte passa o XML recebido para responderConsulta e manda o XML
// devolvido de volta a quem perguntou, na hora e sem aprovacao: consulta so
// le o banco. Fica separado do ouvinte para poder ser testado sem socket, com
// o banco e a data de hoje vindos de fora.

import type { Prisma } from "@prisma/client";
import { XMLParser } from "fast-xml-parser";
import { prisma } from "@/lib/db";
import { lerNamespaceRaiz } from "@/lib/socket/caixa-entrada";
import { escaparXml, formatarDataIso } from "@/lib/xml/escape";
import { validarContraXsd, type SchemaXml } from "@/lib/xml/validador";

type Banco = Prisma.TransactionClient;
type No = Record<string, unknown>;

// Os envios v2 trazem o vencimento. Lancamento sem ele (manual, CSV ou XML
// v1): conta a receber vence 30 dias depois do pedido, e a despesa pendente
// vence na dataPagamento, que e a data prevista para pagar.
const PRAZO_RECEBIMENTO_DIAS = 30;
const DIA_MS = 86_400_000;

// Mesmo padrao do XSD das respostas. A referencia da folha leva o CPF junto
// ("FOLHA-2026-10/98765432100") e pode passar do limite: o atributo e
// opcional, entao fica de fora em vez de derrubar a resposta.
const REGEX_REFERENCIA = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,59}$/;

// Limites do textoObrigatorio dos XSDs. Nome cadastrado na mao pode passar
// disso, e um campo fora do contrato derrubaria a resposta inteira.
const MAX_TEXTO = 120;

const MENSAGEM_ERRO_BANCO = "Não foi possível consultar o Financeiro agora. Tente de novo em alguns minutos.";

export type RespostaConsulta =
  | { ok: true; nomeArquivo: string; xml: string; resumo: string }
  // Consulta que nao passa no XSD: o ouvinte responde em texto no chat.
  | { ok: false; erro: string };

interface Resultado {
  corpo: string; // elementos depois de <dataConsulta>
  resumo: string; // uma linha para o log e o chat do Finanweb
}

interface TipoConsulta {
  schema: SchemaXml;
  raizConsulta: string;
  raizResposta: string;
  prefixoArquivo: string;
  responder: (db: Banco, consulta: No, hoje: string) => Promise<Resultado>;
}

const PREFIXO_ATRIBUTO = "@";

// parseTagValue/parseAttributeValue false pelo mesmo motivo dos parsers de
// movimento: o CPF "00011122233" viraria numero e perderia os zeros.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: PREFIXO_ATRIBUTO,
  parseTagValue: false,
  parseAttributeValue: false,
  ignoreDeclaration: true,
  removeNSPrefix: true,
});

function texto(no: unknown): string {
  if (no === undefined || no === null) return "";
  if (typeof no === "object") return String((no as No)["#text"] ?? "").trim();
  return String(no).trim();
}

/** AAAA-MM-DD do dia no fuso de quem roda o ouvinte, e nao em UTC. */
function dataLocalIso(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function diasEntre(inicioIso: string, fimIso: string): number {
  return Math.round((Date.parse(fimIso) - Date.parse(inicioIso)) / DIA_MS);
}

function valor(numero: Prisma.Decimal | number): string {
  return Number(numero).toFixed(2);
}

function textoContrato(valorTexto: string, padrao: string): string {
  const limpo = valorTexto.trim().slice(0, MAX_TEXTO).trim();
  return limpo || padrao;
}

// O documento e gravado como foi digitado no CSV ou no cadastro, as vezes com
// pontuacao. A consulta chega so com digitos, entao procura as tres formas.
function variantesDocumento(digitos: string): string[] {
  const variantes = [digitos];
  if (digitos.length === 11) {
    variantes.push(digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"));
  } else if (digitos.length === 14) {
    variantes.push(digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5"));
  }
  return variantes;
}

function atributoReferencia(referencia: string | null): string {
  return referencia && REGEX_REFERENCIA.test(referencia) ? ` referencia="${referencia}"` : "";
}

/** Documento gravado -> atributo do XSD (so digitos, 11 ou 14), ou nada. */
function atributoDocumento(documento: string | null): string {
  const digitos = (documento ?? "").replace(/\D/g, "");
  return digitos.length === 11 || digitos.length === 14 ? ` documento="${digitos}"` : "";
}

async function responderInadimplencia(db: Banco, consulta: No, hoje: string): Promise<Resultado> {
  const documento = texto(consulta.documento);
  const clientes = await db.parceiro.findMany({
    where: { tipo: "CLIENTE", documento: { in: variantesDocumento(documento) } },
    select: { id: true },
  });

  if (clientes.length === 0) {
    return {
      corpo: `  <documento>${documento}</documento>
  <situacao>SEM_CADASTRO</situacao>
  <valorEmAtraso>0.00</valorEmAtraso>
  <titulos/>`,
      resumo: `${documento} sem cadastro`,
    };
  }

  // O status e texto livre no CSV; "pendente" minusculo tambem conta.
  const pedidos = await db.pedidoAgrupado.findMany({
    where: {
      clienteId: { in: clientes.map((c) => c.id) },
      status: { equals: "PENDENTE", mode: "insensitive" },
    },
    select: { valorTotal: true, dataPedido: true, vencimento: true, referencia: true },
  });

  const atrasados = pedidos
    .map((pedido) => ({
      ...pedido,
      venceEm: formatarDataIso(
        pedido.vencimento ?? new Date(pedido.dataPedido.getTime() + PRAZO_RECEBIMENTO_DIAS * DIA_MS)
      ),
    }))
    .filter((pedido) => pedido.venceEm < hoje)
    .sort((a, b) => a.venceEm.localeCompare(b.venceEm));

  const titulos: string[] = [];
  let emAtraso = 0;
  for (const pedido of atrasados) {
    emAtraso += Number(pedido.valorTotal);
    titulos.push(`    <titulo${atributoReferencia(pedido.referencia)}>
      <valor>${valor(pedido.valorTotal)}</valor>
      <vencimento>${pedido.venceEm}</vencimento>
      <diasAtraso>${diasEntre(pedido.venceEm, hoje)}</diasAtraso>
    </titulo>`);
  }

  const situacao = titulos.length > 0 ? "INADIMPLENTE" : "ADIMPLENTE";
  return {
    corpo: `  <documento>${documento}</documento>
  <situacao>${situacao}</situacao>
  <valorEmAtraso>${valor(emAtraso)}</valorEmAtraso>
${titulos.length > 0 ? `  <titulos>\n${titulos.join("\n")}\n  </titulos>` : "  <titulos/>"}`,
    resumo: `${documento} ${situacao}${titulos.length > 0 ? `, ${titulos.length} título(s), ${valor(emAtraso)} em atraso` : ""}`,
  };
}

async function responderPendencias(db: Banco, consulta: No): Promise<Resultado> {
  const documento = texto(consulta.documento);

  // Sem documento na consulta: todos os fornecedores. Com documento que nao
  // e de nenhum fornecedor: lista vazia, que o contrato aceita.
  let fornecedorIds: string[] | undefined;
  if (documento) {
    const fornecedores = await db.parceiro.findMany({
      where: { tipo: "FORNECEDOR", documento: { in: variantesDocumento(documento) } },
      select: { id: true },
    });
    fornecedorIds = fornecedores.map((f) => f.id);
  }

  const despesas = await db.despesaAgrupada.findMany({
    where: {
      status: { equals: "PENDENTE", mode: "insensitive" },
      ...(fornecedorIds ? { fornecedorId: { in: fornecedorIds } } : {}),
    },
    select: {
      valor: true,
      dataPagamento: true,
      vencimento: true,
      referencia: true,
      fornecedor: { select: { nome: true, documento: true } },
      categoria: { select: { nome: true } },
    },
  });

  let total = 0;
  const pendencias = despesas
    .map((d) => ({ ...d, venceEm: formatarDataIso(d.vencimento ?? d.dataPagamento) }))
    .sort((a, b) => a.venceEm.localeCompare(b.venceEm))
    .map((d) => {
      total += Number(d.valor);
      return `    <pendencia${atributoReferencia(d.referencia)}>
      <fornecedor${atributoDocumento(d.fornecedor.documento)}>${escaparXml(textoContrato(d.fornecedor.nome, "(sem nome)"))}</fornecedor>
      <categoria>${escaparXml(textoContrato(d.categoria.nome, "(sem categoria)"))}</categoria>
      <valor>${valor(d.valor)}</valor>
      <vencimento>${d.venceEm}</vencimento>
    </pendencia>`;
    });

  return {
    corpo: `${pendencias.length > 0 ? `  <pendencias>\n${pendencias.join("\n")}\n  </pendencias>` : "  <pendencias/>"}
  <totalizador>
    <qtdPendencias>${pendencias.length}</qtdPendencias>
    <valorTotal>${valor(total)}</valorTotal>
  </totalizador>`,
    resumo: `${documento || "todos os fornecedores"}: ${pendencias.length} pendência(s), ${valor(total)}`,
  };
}

const CONSULTAS: Record<string, TipoConsulta> = {
  "urn:finanweb:inadimplencia:1.0": {
    schema: "inadimplencia-v1.xsd",
    raizConsulta: "consultaInadimplencia",
    raizResposta: "respostaInadimplencia",
    prefixoArquivo: "resposta-inadimplencia",
    responder: responderInadimplencia,
  },
  "urn:finanweb:pendencias-fornecedor:1.0": {
    schema: "pendencias-fornecedor-v1.xsd",
    raizConsulta: "consultaPendencias",
    raizResposta: "respostaPendencias",
    prefixoArquivo: "resposta-pendencias",
    responder: responderPendencias,
  },
};

export function ehConsulta(conteudo: string): boolean {
  const namespace = lerNamespaceRaiz(conteudo);
  return namespace !== null && namespace in CONSULTAS;
}

function montarResposta(namespace: string, tipo: TipoConsulta, id: string, hoje: string, corpo: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<${tipo.raizResposta} xmlns="${namespace}" versao="1.0" id="${id}">
  <dataConsulta>${hoje}</dataConsulta>
${corpo}
</${tipo.raizResposta}>
`;
}

/**
 * Responde uma consulta de inadimplencia ou de pendencias. ok: false so
 * quando a propria consulta e invalida; falha ao ler o banco vira uma
 * resposta com <erro>, que tambem segue o contrato.
 */
export async function responderConsulta(
  conteudo: string,
  { db = prisma, hoje = new Date() }: { db?: Banco; hoje?: Date } = {}
): Promise<RespostaConsulta> {
  const namespace = lerNamespaceRaiz(conteudo);
  const tipo = namespace ? CONSULTAS[namespace] : undefined;
  if (!namespace || !tipo) return { ok: false, erro: "não é uma consulta do Finanweb." };

  const erros = await validarContraXsd(conteudo, tipo.schema);
  if (erros.length > 0) return { ok: false, erro: `não passou no XSD: ${erros.slice(0, 3).join(" ")}` };

  // O XSD tem os dois elementos raiz: uma resposta mandada para ca passa nele,
  // mas nao e pergunta.
  const consulta = (parser.parse(conteudo) as No)[tipo.raizConsulta] as No | undefined;
  if (!consulta) return { ok: false, erro: `esperado <${tipo.raizConsulta}> como elemento raiz.` };

  // O XSD ja garante o formato do id (letras, digitos, . _ -): ele vai direto
  // para o atributo e para o nome do arquivo.
  const id = texto(consulta[`${PREFIXO_ATRIBUTO}id`]);
  const dataConsulta = dataLocalIso(hoje);
  const nomeArquivo = `${tipo.prefixoArquivo}-${id}.xml`;

  let resultado: Resultado;
  try {
    resultado = await tipo.responder(db, consulta, dataConsulta);
  } catch (erro) {
    console.error(erro);
    resultado = { corpo: `  <erro>${MENSAGEM_ERRO_BANCO}</erro>`, resumo: "erro ao ler o banco" };
  }

  // Confere a propria resposta, como a exportacao: dado gravado fora do
  // contrato vira <erro> em vez de um arquivo que o outro lado recusaria.
  let xml = montarResposta(namespace, tipo, id, dataConsulta, resultado.corpo);
  const errosResposta = await validarContraXsd(xml, tipo.schema);
  if (errosResposta.length > 0) {
    console.error(`resposta fora do XSD (${nomeArquivo}): ${errosResposta.join(" ")}`);
    xml = montarResposta(
      namespace,
      tipo,
      id,
      dataConsulta,
      `  <erro>A resposta não pôde ser montada: há dados no Financeiro fora do contrato.</erro>`
    );
    resultado = { ...resultado, resumo: `${resultado.resumo} (fora do XSD, respondido com erro)` };
  }

  return { ok: true, nomeArquivo, xml, resumo: `${tipo.raizConsulta} ${id}: ${resultado.resumo}` };
}
