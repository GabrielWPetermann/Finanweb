// Contrato da API REST em OpenAPI 3.0 (lib/integracao/openapi.ts).

import { montarOpenApi } from "@/lib/integracao/openapi";
import { json, opcoes } from "@/lib/integracao/rest";

export function GET(request: Request): Response {
  return json(montarOpenApi(new URL(request.url).origin));
}

export const OPTIONS = opcoes;
