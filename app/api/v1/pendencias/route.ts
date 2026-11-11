// GET ?origem=[&documento=] (pendencias-fornecedor-v1.xsd em JSON). Ver lib/integracao/rest.ts.

import { consultaPendenciasXml, respostaPendenciasJson } from "@/lib/integracao/json";
import { consultarJson, opcoes } from "@/lib/integracao/rest";

export const GET = (request: Request) => consultarJson(request, consultaPendenciasXml, respostaPendenciasJson);
export const OPTIONS = opcoes;
