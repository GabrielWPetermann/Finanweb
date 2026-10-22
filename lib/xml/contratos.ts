// Contratos XML entre o Financeiro e os outros setores da turma, levantados
// no diagrama de interoperabilidade.
//
// Quem recebe ou responde a mensagem define o contrato, como numa API. Por
// isso os XSDs de tudo o que chega ao Financeiro ficam aqui, inclusive os que
// outro setor gera (venda, compra, folha).
//
// Este catalogo alimenta a pagina publica /contratos e a rota
// /api/contratos/<arquivo>, que so serve os arquivos listados aqui.

import type { SchemaXml } from "@/lib/xml/validador";

export interface Contrato {
  mensagem: string;
  setor: string;
  // recebe: o setor envia e o Financeiro lanca. responde: o setor pergunta e
  // o Financeiro devolve a resposta.
  sentido: "recebe" | "responde";
  // O que o setor faz com esta mensagem, escrito para quem esta do outro lado.
  descricao: string;
  namespace: string;
  schema: SchemaXml;
  // Arquivos em lib/xml/exemplos, validos contra o schema.
  exemplos: string[];
}

// Na ordem em que a pagina mostra: agrupados por setor.
export const CONTRATOS: Contrato[] = [
  {
    mensagem: "Venda",
    setor: "Vendas",
    sentido: "recebe",
    descricao: "Envia as vendas. Cada uma vira uma conta a receber no Financeiro.",
    namespace: "urn:finanweb:entrada:2.0",
    schema: "entrada-v2.xsd",
    exemplos: ["entrada-v2.xml"],
  },
  {
    mensagem: "Inadimplência de cliente",
    setor: "Vendas",
    sentido: "responde",
    descricao:
      "Pode perguntar se um cliente está inadimplente antes de vender a prazo. A resposta traz os títulos em atraso.",
    namespace: "urn:finanweb:inadimplencia:1.0",
    schema: "inadimplencia-v1.xsd",
    exemplos: ["inadimplencia-v1-consulta.xml", "inadimplencia-v1-resposta.xml"],
  },
  {
    mensagem: "Compra",
    setor: "Compras",
    sentido: "recebe",
    descricao: "Envia as compras. Cada uma vira uma conta a pagar ao fornecedor no Financeiro.",
    namespace: "urn:finanweb:saida:2.0",
    schema: "saida-v2.xsd",
    exemplos: ["saida-v2.xml"],
  },
  {
    mensagem: "Pendências com fornecedor",
    setor: "Compras",
    sentido: "responde",
    descricao:
      "Pode perguntar o que está em aberto a pagar a um fornecedor, ou a todos. A resposta traz cada conta com o vencimento.",
    namespace: "urn:finanweb:pendencias-fornecedor:1.0",
    schema: "pendencias-fornecedor-v1.xsd",
    exemplos: ["pendencias-fornecedor-v1-consulta.xml", "pendencias-fornecedor-v1-resposta.xml"],
  },
  {
    mensagem: "Folha de pagamento",
    setor: "RH",
    sentido: "recebe",
    descricao: "Envia a folha de cada mês. O salário líquido de cada funcionário vira um valor a pagar no Financeiro.",
    namespace: "urn:finanweb:folha:1.0",
    schema: "folha-v1.xsd",
    exemplos: ["folha-v1.xml"],
  },
];
