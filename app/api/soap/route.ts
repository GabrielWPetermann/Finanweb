// Servico SOAP 1.1: POST com o envelope, GET ?wsdl para o WSDL. A logica fica
// em lib/integracao/soap.ts; fora do login, como o resto de /api. O POST exige
// a chave do setor em Authorization, como o REST; o WSDL e publico.

import { autorizarSetor } from "@/lib/integracao/acesso";
import { CORS } from "@/lib/integracao/rest";
import { atenderSoap, falha } from "@/lib/integracao/soap";
import { montarWsdl } from "@/lib/integracao/wsdl";

const XML = { ...CORS, "Content-Type": "text/xml; charset=utf-8" };

export function GET(request: Request): Response {
  const url = new URL(request.url);
  if (url.searchParams.has("wsdl")) return new Response(montarWsdl(url.origin), { headers: XML });
  return new Response(
    `Serviço SOAP 1.1 do Finanweb. WSDL: ${url.origin}/api/soap?wsdl\nDocumentação: ${url.origin}/contratos\n`,
    { headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } }
  );
}

export async function POST(request: Request): Promise<Response> {
  const acesso = await autorizarSetor(request);
  const resposta = acesso.ok
    ? await atenderSoap(await request.text(), acesso.setor)
    : falha(acesso.status === 503 ? "Server" : "Client", acesso.erro, acesso.status);
  return new Response(resposta.xml, { status: resposta.status, headers: { ...XML, ...acesso.cabecalhos } });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}
