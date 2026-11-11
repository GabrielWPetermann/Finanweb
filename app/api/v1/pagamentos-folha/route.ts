// GET ?origem=[&referencia=][&cpf=] (pagamentos-folha-v1.xsd em JSON). Ver lib/integracao/rest.ts.

import { consultaPagamentosFolhaXml, respostaPagamentosFolhaJson } from "@/lib/integracao/json";
import { consultarJson, opcoes } from "@/lib/integracao/rest";

export const GET = (request: Request) =>
  consultarJson(request, consultaPagamentosFolhaXml, respostaPagamentosFolhaJson);
export const OPTIONS = opcoes;
