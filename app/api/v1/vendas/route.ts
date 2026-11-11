// POST de uma venda (entrada-v2.xsd em JSON). Ver lib/integracao/rest.ts.

import { vendaParaXml } from "@/lib/integracao/json";
import { opcoes, receberEnvioJson } from "@/lib/integracao/rest";

export const POST = (request: Request) => receberEnvioJson(request, "venda", vendaParaXml);
export const OPTIONS = opcoes;
