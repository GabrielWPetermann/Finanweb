// GET ?origem=&documento= (inadimplencia-v1.xsd em JSON). Ver lib/integracao/rest.ts.

import { consultaInadimplenciaXml, respostaInadimplenciaJson } from "@/lib/integracao/json";
import { consultarJson, opcoes } from "@/lib/integracao/rest";

export const GET = (request: Request) => consultarJson(request, consultaInadimplenciaXml, respostaInadimplenciaJson);
export const OPTIONS = opcoes;
