// JSON da API REST <-> XML dos contratos.
//
// O REST nao tem regra propria: o JSON de um envio ou de uma consulta vira o
// XML do contrato e passa pelo mesmo XSD e pelo mesmo codigo do socket. Na
// volta, o XML da resposta vira JSON. Os nomes dos campos sao os dos
// elementos e atributos do XSD; valores monetarios aceitam numero ou texto
// ("1450.00") e voltam como numero.

import { XMLParser } from "fast-xml-parser";
import { escaparXml } from "@/lib/xml/escape";

type Json = Record<string, unknown>;

function objeto(valor: unknown): Json {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor) ? (valor as Json) : {};
}

function lista(valor: unknown): Json[] {
  return Array.isArray(valor) ? valor.map(objeto) : [];
}

// Campo ausente vira texto vazio, que o XSD reprova com o nome do elemento.
function texto(valor: unknown): string {
  if (typeof valor === "string") return valor;
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  return "";
}

function el(nome: string, valor: unknown, recuo: string): string {
  return `${recuo}<${nome}>${escaparXml(texto(valor))}</${nome}>`;
}

// Atributo ausente fica de fora: se for obrigatorio, o XSD diz qual falta.
function attr(nome: string, valor: unknown): string {
  const t = texto(valor);
  return t === "" ? "" : ` ${nome}="${escaparXml(t)}"`;
}

function cabecalho(valor: unknown): string {
  const c = objeto(valor);
  return [
    "  <cabecalho>",
    el("empresa", c.empresa, "    "),
    el("cnpj", c.cnpj, "    "),
    el("origem", c.origem, "    "),
    el("dataArquivo", c.dataArquivo, "    "),
    el("usuario", c.usuario, "    "),
    "  </cabecalho>",
  ].join("\n");
}

const DECLARACAO = '<?xml version="1.0" encoding="UTF-8"?>';

// ===================== Envios: JSON -> XML =====================

export function vendaParaXml(corpo: unknown): string {
  const v = objeto(corpo);
  const t = objeto(v.totalizador);
  const pedidos = lista(v.pedidos).map((p) => {
    const cliente = objeto(p.cliente);
    const desconto = objeto(p.desconto);
    return [
      `    <pedido${attr("referencia", p.referencia)}${attr("status", p.status)}>`,
      `      <cliente${attr("documento", cliente.documento)}>${escaparXml(texto(cliente.nome))}</cliente>`,
      el("categoria", p.categoria, "      "),
      el("subtotal", p.subtotal, "      "),
      `      <desconto${attr("percentual", desconto.percentual)}>${escaparXml(texto(desconto.valor))}</desconto>`,
      el("frete", p.frete, "      "),
      el("valorTotal", p.valorTotal, "      "),
      el("formaPagamento", p.formaPagamento, "      "),
      el("dataPedido", p.dataPedido, "      "),
      el("vencimento", p.vencimento, "      "),
      "    </pedido>",
    ].join("\n");
  });
  return [
    DECLARACAO,
    '<movimento xmlns="urn:finanweb:entrada:2.0" versao="2.0" tipo="ENTRADA">',
    cabecalho(v.cabecalho),
    "  <pedidos>",
    ...pedidos,
    "  </pedidos>",
    "  <totalizador>",
    el("qtdRegistros", t.qtdRegistros, "    "),
    el("valorTotalGeral", t.valorTotalGeral, "    "),
    "  </totalizador>",
    "</movimento>",
    "",
  ].join("\n");
}

export function compraParaXml(corpo: unknown): string {
  const c = objeto(corpo);
  const t = objeto(c.totalizador);
  const despesas = lista(c.despesas).map((d) => {
    const fornecedor = objeto(d.fornecedor);
    return [
      `    <despesa${attr("referencia", d.referencia)}${attr("status", d.status)}>`,
      `      <fornecedor${attr("documento", fornecedor.documento)}>${escaparXml(texto(fornecedor.nome))}</fornecedor>`,
      el("categoria", d.categoria, "      "),
      el("valor", d.valor, "      "),
      el("formaPagamento", d.formaPagamento, "      "),
      el("dataEmissao", d.dataEmissao, "      "),
      el("vencimento", d.vencimento, "      "),
      "    </despesa>",
    ].join("\n");
  });
  return [
    DECLARACAO,
    '<movimento xmlns="urn:finanweb:saida:2.0" versao="2.0" tipo="SAIDA">',
    cabecalho(c.cabecalho),
    "  <despesas>",
    ...despesas,
    "  </despesas>",
    "  <totalizador>",
    el("qtdRegistros", t.qtdRegistros, "    "),
    el("valorTotalGeral", t.valorTotalGeral, "    "),
    "  </totalizador>",
    "</movimento>",
    "",
  ].join("\n");
}

export function folhaParaXml(corpo: unknown): string {
  const f = objeto(corpo);
  const t = objeto(f.totalizador);
  const funcionarios = lista(f.funcionarios).map((p) =>
    [
      `    <funcionario${attr("cpf", p.cpf)}${attr("matricula", p.matricula)}>`,
      el("nome", p.nome, "      "),
      el("salarioBruto", p.salarioBruto, "      "),
      el("descontos", p.descontos, "      "),
      el("salarioLiquido", p.salarioLiquido, "      "),
      "    </funcionario>",
    ].join("\n")
  );
  return [
    DECLARACAO,
    `<folha xmlns="urn:finanweb:folha:1.0" versao="1.0"${attr("referencia", f.referencia)}>`,
    cabecalho(f.cabecalho),
    el("competencia", f.competencia, "  "),
    el("dataPagamento", f.dataPagamento, "  "),
    "  <funcionarios>",
    ...funcionarios,
    "  </funcionarios>",
    "  <totalizador>",
    el("qtdFuncionarios", t.qtdFuncionarios, "    "),
    el("valorLiquidoTotal", t.valorLiquidoTotal, "    "),
    "  </totalizador>",
    "</folha>",
    "",
  ].join("\n");
}

// ===================== Consultas: parametros -> XML =====================

export type Parametros = Record<string, string | undefined>;

// Opcional some do XML; obrigatorio vazio fica, para o XSD apontar.
function opcional(nome: string, valor: string | undefined): string[] {
  return valor ? [el(nome, valor, "  ")] : [];
}

function consulta(raiz: string, namespace: string, id: string, corpo: string[]): string {
  return [DECLARACAO, `<${raiz} xmlns="${namespace}" versao="1.0"${attr("id", id)}>`, ...corpo, `</${raiz}>`, ""].join(
    "\n"
  );
}

export function consultaInadimplenciaXml(p: Parametros, id: string): string {
  return consulta("consultaInadimplencia", "urn:finanweb:inadimplencia:1.0", id, [
    el("origem", p.origem, "  "),
    el("documento", p.documento, "  "),
  ]);
}

export function consultaPendenciasXml(p: Parametros, id: string): string {
  return consulta("consultaPendencias", "urn:finanweb:pendencias-fornecedor:1.0", id, [
    el("origem", p.origem, "  "),
    ...opcional("documento", p.documento),
  ]);
}

export function consultaPagamentosFolhaXml(p: Parametros, id: string): string {
  return consulta("consultaPagamentosFolha", "urn:finanweb:pagamentos-folha:1.0", id, [
    el("origem", p.origem, "  "),
    ...opcional("referencia", p.referencia),
    ...opcional("cpf", p.cpf),
  ]);
}

// ===================== Respostas: XML -> JSON =====================

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  parseTagValue: false,
  parseAttributeValue: false,
  ignoreDeclaration: true,
  removeNSPrefix: true,
  isArray: (nome) => nome === "titulo" || nome === "pendencia" || nome === "pagamento",
});

// Elemento com atributo vira objeto com "#text"; sem atributo, texto direto.
function valorDe(no: unknown): string {
  if (no === undefined || no === null) return "";
  if (typeof no === "object") return String((no as Json)["#text"] ?? "");
  return String(no);
}

function atributo(no: unknown, nome: string): string | null {
  const valor = objeto(no)[`@${nome}`];
  return valor === undefined ? null : String(valor);
}

const numero = (no: unknown) => Number(valorDe(no));
const opcionalTexto = (no: unknown) => (no === undefined ? null : valorDe(no));

function raiz(xml: string, nome: string): Json {
  return objeto((parser.parse(xml) as Json)[nome]);
}

// Resposta com <erro> no lugar do resultado (banco fora do ar, dado fora do
// contrato): mesmo formato nas tres consultas.
function base(r: Json): Json {
  return { id: atributo(r, "id"), dataConsulta: valorDe(r.dataConsulta) };
}

export type RespostaJson = Json & { erro?: string };

export function respostaInadimplenciaJson(xml: string): RespostaJson {
  const r = raiz(xml, "respostaInadimplencia");
  if (r.erro !== undefined) return { ...base(r), erro: valorDe(r.erro) };
  return {
    ...base(r),
    documento: valorDe(r.documento),
    situacao: valorDe(r.situacao),
    valorEmAtraso: numero(r.valorEmAtraso),
    titulos: lista(objeto(r.titulos).titulo).map((t) => ({
      referencia: atributo(t, "referencia"),
      valor: numero(t.valor),
      vencimento: valorDe(t.vencimento),
      diasAtraso: numero(t.diasAtraso),
    })),
  };
}

export function respostaPendenciasJson(xml: string): RespostaJson {
  const r = raiz(xml, "respostaPendencias");
  if (r.erro !== undefined) return { ...base(r), erro: valorDe(r.erro) };
  const t = objeto(r.totalizador);
  return {
    ...base(r),
    pendencias: lista(objeto(r.pendencias).pendencia).map((p) => ({
      referencia: atributo(p, "referencia"),
      fornecedor: { nome: valorDe(p.fornecedor), documento: atributo(p.fornecedor, "documento") },
      categoria: valorDe(p.categoria),
      valor: numero(p.valor),
      vencimento: valorDe(p.vencimento),
    })),
    totalizador: { qtdPendencias: numero(t.qtdPendencias), valorTotal: numero(t.valorTotal) },
  };
}

export function respostaPagamentosFolhaJson(xml: string): RespostaJson {
  const r = raiz(xml, "respostaPagamentosFolha");
  if (r.erro !== undefined) return { ...base(r), erro: valorDe(r.erro) };
  const t = objeto(r.totalizador);
  return {
    ...base(r),
    pagamentos: lista(objeto(r.pagamentos).pagamento).map((p) => ({
      folha: atributo(p, "folha"),
      cpf: atributo(p, "cpf"),
      nome: valorDe(p.nome),
      valor: numero(p.valor),
      situacao: valorDe(p.situacao),
      dataPrevista: valorDe(p.dataPrevista),
      dataPagamento: opcionalTexto(p.dataPagamento),
    })),
    totalizador: {
      qtdPagos: numero(t.qtdPagos),
      valorPago: numero(t.valorPago),
      qtdPendentes: numero(t.qtdPendentes),
      valorPendente: numero(t.valorPendente),
    },
  };
}

export function avisoPagamentoJson(xml: string): Json {
  const a = raiz(xml, "avisoPagamento");
  return {
    id: atributo(a, "id"),
    dataAviso: valorDe(a.dataAviso),
    origem: valorDe(a.origem),
    referencia: valorDe(a.referencia),
    cpf: opcionalTexto(a.cpf),
    situacao: valorDe(a.situacao),
    favorecido: { nome: valorDe(a.favorecido), documento: atributo(a.favorecido, "documento") },
    valor: numero(a.valor),
    dataPagamento: opcionalTexto(a.dataPagamento),
  };
}

/**
 * Mensagem do XSD pensada para quem mandou JSON: sem o numero da linha do XML
 * gerado aqui e sem o namespace na frente de cada elemento.
 */
export function erroParaJson(erro: string): string {
  return erro.replace(/Linha \d+: /g, "").replace(/\{urn:[^}]+\}/g, "");
}
