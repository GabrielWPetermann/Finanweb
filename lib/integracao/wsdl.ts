// WSDL 1.1 do servico SOAP (GET /api/soap?wsdl). Os tipos sao os proprios
// XSDs dos contratos, importados pela URL publica de /api/contratos: o WSDL
// nao repete nenhuma definicao.

import { NS_SERVICO } from "@/lib/integracao/soap";

// Prefixo -> [namespace, schema]. Os prefixos so existem dentro do WSDL.
const SCHEMAS: Record<string, [string, string]> = {
  tns: [NS_SERVICO, "servico-v1.xsd"],
  ven: ["urn:finanweb:entrada:2.0", "entrada-v2.xsd"],
  com: ["urn:finanweb:saida:2.0", "saida-v2.xsd"],
  fol: ["urn:finanweb:folha:1.0", "folha-v1.xsd"],
  ina: ["urn:finanweb:inadimplencia:1.0", "inadimplencia-v1.xsd"],
  pen: ["urn:finanweb:pendencias-fornecedor:1.0", "pendencias-fornecedor-v1.xsd"],
  pag: ["urn:finanweb:pagamentos-folha:1.0", "pagamentos-folha-v1.xsd"],
  avi: ["urn:finanweb:aviso-pagamento:1.0", "aviso-pagamento-v1.xsd"],
};

// Os nomes sao os do campo soap do catalogo (lib/xml/contratos.ts).
export const OPERACOES = [
  { nome: "EnviarVenda", entrada: "ven:movimento", saida: "tns:confirmacaoEnvio" },
  { nome: "EnviarCompra", entrada: "com:movimento", saida: "tns:confirmacaoEnvio" },
  { nome: "EnviarFolha", entrada: "fol:folha", saida: "tns:confirmacaoEnvio" },
  { nome: "ConsultarInadimplencia", entrada: "ina:consultaInadimplencia", saida: "ina:respostaInadimplencia" },
  { nome: "ConsultarPendencias", entrada: "pen:consultaPendencias", saida: "pen:respostaPendencias" },
  { nome: "ConsultarPagamentosFolha", entrada: "pag:consultaPagamentosFolha", saida: "pag:respostaPagamentosFolha" },
  { nome: "ConsultarAvisosPagamento", entrada: "tns:consultaAvisosPagamento", saida: "tns:respostaAvisosPagamento" },
];

/** base: origem publica do Finanweb, ex. https://finanwebsistema.vercel.app */
export function montarWsdl(base: string): string {
  const declaracoes = Object.entries(SCHEMAS)
    .map(([prefixo, [namespace]]) => `\n                  xmlns:${prefixo}="${namespace}"`)
    .join("");
  const imports = Object.values(SCHEMAS)
    .map(([namespace, arquivo]) => `      <xsd:import namespace="${namespace}" schemaLocation="${base}/api/contratos/${arquivo}"/>`)
    .join("\n");

  const mensagens = OPERACOES.map(
    (o) => `  <wsdl:message name="${o.nome}Entrada">
    <wsdl:part name="corpo" element="${o.entrada}"/>
  </wsdl:message>
  <wsdl:message name="${o.nome}Saida">
    <wsdl:part name="corpo" element="${o.saida}"/>
  </wsdl:message>`
  ).join("\n");

  const portType = OPERACOES.map(
    (o) => `    <wsdl:operation name="${o.nome}">
      <wsdl:input message="tns:${o.nome}Entrada"/>
      <wsdl:output message="tns:${o.nome}Saida"/>
    </wsdl:operation>`
  ).join("\n");

  const binding = OPERACOES.map(
    (o) => `    <wsdl:operation name="${o.nome}">
      <soap:operation soapAction="${NS_SERVICO}#${o.nome}" style="document"/>
      <wsdl:input><soap:body use="literal"/></wsdl:input>
      <wsdl:output><soap:body use="literal"/></wsdl:output>
    </wsdl:operation>`
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<wsdl:definitions name="Finanweb"
                  targetNamespace="${NS_SERVICO}"
                  xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"
                  xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
                  xmlns:xsd="http://www.w3.org/2001/XMLSchema"${declaracoes}>
  <wsdl:documentation>
    Servico SOAP do Financeiro (Finanweb). Os mesmos contratos do socket e da
    API REST: ${base}/contratos. Envios ficam aguardando a aprovacao do
    Financeiro; consultas respondem na hora. Recusas voltam como soap:Fault.
  </wsdl:documentation>

  <wsdl:types>
    <xsd:schema>
${imports}
    </xsd:schema>
  </wsdl:types>

${mensagens}

  <wsdl:portType name="FinanwebPortType">
${portType}
  </wsdl:portType>

  <wsdl:binding name="FinanwebBinding" type="tns:FinanwebPortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
${binding}
  </wsdl:binding>

  <wsdl:service name="Finanweb">
    <wsdl:port name="FinanwebPort" binding="tns:FinanwebBinding">
      <soap:address location="${base}/api/soap"/>
    </wsdl:port>
  </wsdl:service>
</wsdl:definitions>
`;
}
