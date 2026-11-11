// POST de uma compra (saida-v2.xsd em JSON). Ver lib/integracao/rest.ts.

import { compraParaXml } from "@/lib/integracao/json";
import { opcoes, receberEnvioJson } from "@/lib/integracao/rest";

export const POST = (request: Request) => receberEnvioJson(request, "compra", compraParaXml);
export const OPTIONS = opcoes;
