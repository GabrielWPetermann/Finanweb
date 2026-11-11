// POST de uma folha de pagamento (folha-v1.xsd em JSON). Ver lib/integracao/rest.ts.

import { folhaParaXml } from "@/lib/integracao/json";
import { opcoes, receberEnvioJson } from "@/lib/integracao/rest";

export const POST = (request: Request) => receberEnvioJson(request, "folha", folhaParaXml);
export const OPTIONS = opcoes;
