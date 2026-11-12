// GET [?origem=][&desde=] -- avisos de recebimento (aviso-recebimento-v1.xsd)
// ja gerados para o setor da chave, em JSON. Ver buscarAvisosJson.

import { avisoRecebimentoJson } from "@/lib/integracao/json";
import { buscarAvisosJson, opcoes } from "@/lib/integracao/rest";

export const GET = (request: Request) => buscarAvisosJson(request, "recebimento", avisoRecebimentoJson);
export const OPTIONS = opcoes;
