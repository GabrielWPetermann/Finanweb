// Servico SOAP 1.1: POST com o envelope, GET ?wsdl para o WSDL. A logica fica
// em lib/integracao/soap.ts; fora do login, como o resto de /api.

import { CORS } from "@/lib/integracao/rest";
import { atenderSoap } from "@/lib/integracao/soap";
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
  const resposta = await atenderSoap(await request.text());
  return new Response(resposta.xml, { status: resposta.status, headers: XML });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}
