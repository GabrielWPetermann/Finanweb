// GET [?origem=][&desde=] -- avisos de pagamento (aviso-pagamento-v1.xsd) ja
// gerados para o setor da chave, em JSON. Ver buscarAvisosJson.

import { avisoPagamentoJson } from "@/lib/integracao/json";
import { buscarAvisosJson, opcoes } from "@/lib/integracao/rest";

export const GET = (request: Request) => buscarAvisosJson(request, "pagamento", avisoPagamentoJson);
export const OPTIONS = opcoes;
