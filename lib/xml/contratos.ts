// Contratos XML entre o Financeiro e os outros setores da turma, levantados
// no diagrama de interoperabilidade.
//
// Quem recebe ou responde a mensagem define o contrato, como numa API. Por
// isso os XSDs de tudo o que chega ao Financeiro ficam aqui, inclusive os que
// outro setor gera (venda, compra, folha).
//
// Cada mensagem passa por tres caminhos: socket (o XML como arquivo), REST
// (o mesmo conteudo em JSON, lib/integracao/json.ts) e SOAP (o XML dentro do
// envelope). O XSD vale para os tres.
//
// Este catalogo alimenta a pagina publica /contratos, o indice /api/v1 e a
// rota /api/contratos/<arquivo>, que so serve os arquivos listados aqui.

import type { SchemaXml } from "@/lib/xml/validador";

export interface Contrato {
  mensagem: string;
  setor: string;
  // recebe: o setor envia e o Financeiro lanca. responde: o setor pergunta e
  // o Financeiro devolve a resposta. envia: o Financeiro manda por conta
  // propria, sem pergunta.
  sentido: "recebe" | "responde" | "envia";
  // O que o setor faz com esta mensagem, escrito para quem esta do outro lado.
  descricao: string;
  namespace: string;
  schema: SchemaXml;
  // Arquivos em lib/xml/exemplos: os .xml validos contra o schema e os .json
  // equivalentes da API REST.
  exemplos: string[];
  // A mesma mensagem pela API REST (metodo e caminho, com um exemplo de
  // parametros nas consultas) e a operacao no WSDL do SOAP.
  rest: string;
  soap: string;
}

// Na ordem em que a pagina mostra: agrupados por setor.
// O aviso de pagamento aparece uma vez por setor que recebe (Compras e RH),
// com o mesmo schema.
export const CONTRATOS: Contrato[] = [
  {
    mensagem: "Venda",
    setor: "Vendas",
    sentido: "recebe",
    descricao: "Envia as vendas. Cada uma vira uma conta a receber no Financeiro.",
    namespace: "urn:finanweb:entrada:2.0",
    schema: "entrada-v2.xsd",
    exemplos: ["entrada-v2.xml", "entrada-v2.json"],
    rest: "POST /api/v1/vendas",
    soap: "EnviarVenda",
  },
  {
    mensagem: "Inadimplência de cliente",
    setor: "Vendas",
    sentido: "responde",
    descricao:
      "Pode perguntar se um cliente está inadimplente antes de vender a prazo. A resposta traz os títulos em atraso.",
    namespace: "urn:finanweb:inadimplencia:1.0",
    schema: "inadimplencia-v1.xsd",
    exemplos: ["inadimplencia-v1-consulta.xml", "inadimplencia-v1-resposta.xml", "inadimplencia-v1-resposta.json"],
    rest: "GET /api/v1/inadimplencia?origem=vendas&documento=12345678909",
    soap: "ConsultarInadimplencia",
  },
  {
    mensagem: "Aviso de recebimento",
    setor: "Vendas",
    sentido: "envia",
    descricao:
      "Recebe um aviso quando o Financeiro recebe ou cancela uma venda enviada por vocês, com a mesma referência.",
    namespace: "urn:finanweb:aviso-recebimento:1.0",
    schema: "aviso-recebimento-v1.xsd",
    exemplos: ["aviso-recebimento-v1.xml", "avisos-recebimento-vendas.json"],
    rest: "GET /api/v1/avisos-recebimento?origem=vendas&desde=2026-11-01T00:00:00Z",
    soap: "ConsultarAvisosRecebimento",
  },
  {
    mensagem: "Compra",
    setor: "Compras",
    sentido: "recebe",
    descricao: "Envia as compras. Cada uma vira uma conta a pagar ao fornecedor no Financeiro.",
    namespace: "urn:finanweb:saida:2.0",
    schema: "saida-v2.xsd",
    exemplos: ["saida-v2.xml", "saida-v2.json"],
    rest: "POST /api/v1/compras",
    soap: "EnviarCompra",
  },
  {
    mensagem: "Pendências com fornecedor",
    setor: "Compras",
    sentido: "responde",
    descricao:
      "Pode perguntar o que está em aberto a pagar a um fornecedor, ou a todos. A resposta traz cada conta com o vencimento.",
    namespace: "urn:finanweb:pendencias-fornecedor:1.0",
    schema: "pendencias-fornecedor-v1.xsd",
    exemplos: [
      "pendencias-fornecedor-v1-consulta.xml",
      "pendencias-fornecedor-v1-resposta.xml",
      "pendencias-fornecedor-v1-resposta.json",
    ],
    rest: "GET /api/v1/pendencias?origem=compras&documento=11444777000161",
    soap: "ConsultarPendencias",
  },
  {
    mensagem: "Aviso de pagamento",
    setor: "Compras",
    sentido: "envia",
    descricao:
      "Recebe um aviso quando o Financeiro paga ou cancela uma compra enviada por vocês, com a mesma referência.",
    namespace: "urn:finanweb:aviso-pagamento:1.0",
    schema: "aviso-pagamento-v1.xsd",
    exemplos: ["aviso-pagamento-v1-compra.xml", "avisos-pagamento-compras.json"],
    rest: "GET /api/v1/avisos-pagamento?origem=compras&desde=2026-11-01T00:00:00Z",
    soap: "ConsultarAvisosPagamento",
  },
  {
    mensagem: "Folha de pagamento",
    setor: "RH",
    sentido: "recebe",
    descricao: "Envia a folha de cada mês. O salário líquido de cada funcionário vira um valor a pagar no Financeiro.",
    namespace: "urn:finanweb:folha:1.0",
    schema: "folha-v1.xsd",
    exemplos: ["folha-v1.xml", "folha-v1.json"],
    rest: "POST /api/v1/folhas",
    soap: "EnviarFolha",
  },
  {
    mensagem: "Pagamentos da folha",
    setor: "RH",
    sentido: "responde",
    descricao:
      "Pode perguntar quais funcionários das folhas enviadas já foram pagos. A resposta traz cada um como pago, pendente ou cancelado, com a data.",
    namespace: "urn:finanweb:pagamentos-folha:1.0",
    schema: "pagamentos-folha-v1.xsd",
    exemplos: [
      "pagamentos-folha-v1-consulta.xml",
      "pagamentos-folha-v1-resposta.xml",
      "pagamentos-folha-v1-resposta.json",
    ],
    rest: "GET /api/v1/pagamentos-folha?origem=rh&referencia=FOLHA-2026-10",
    soap: "ConsultarPagamentosFolha",
  },
  {
    mensagem: "Aviso de pagamento",
    setor: "RH",
    sentido: "envia",
    descricao:
      "Recebe um aviso quando o Financeiro paga ou cancela o salário de um funcionário da folha, com a referência da folha e o CPF.",
    namespace: "urn:finanweb:aviso-pagamento:1.0",
    schema: "aviso-pagamento-v1.xsd",
    exemplos: ["aviso-pagamento-v1-folha.xml", "avisos-pagamento-rh.json"],
    rest: "GET /api/v1/avisos-pagamento?origem=rh&desde=2026-11-01T00:00:00Z",
    soap: "ConsultarAvisosPagamento",
  },
];
