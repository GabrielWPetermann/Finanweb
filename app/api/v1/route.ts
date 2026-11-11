// Indice da API REST: o que cada setor pode chamar, tirado do catalogo de
// contratos. A documentacao completa fica em /contratos.

import { json, opcoes } from "@/lib/integracao/rest";
import { CONTRATOS } from "@/lib/xml/contratos";

export function GET(request: Request): Response {
  const base = new URL(request.url).origin;
  return json({
    documentacao: `${base}/contratos`,
    openapi: `${base}/api/v1/openapi.json`,
    wsdl: `${base}/api/soap?wsdl`,
    registro: `${base}/api/registro`,
    rotas: CONTRATOS.map((c) => {
      const [metodo, caminho] = c.rest.split(" ");
      return {
        setor: c.setor,
        mensagem: c.mensagem,
        metodo,
        exemplo: `${base}${caminho}`,
        schema: `${base}/api/contratos/${c.schema}`,
        exemplos: c.exemplos.map((arquivo) => `${base}/api/contratos/${arquivo}`),
      };
    }),
  });
}

export const OPTIONS = opcoes;
