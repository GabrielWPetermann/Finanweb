// Indice da API REST: o que cada setor pode chamar, tirado do catalogo de
// contratos. A documentacao completa fica em /contratos.

import { json, opcoes } from "@/lib/integracao/rest";
import { CONTRATOS } from "@/lib/xml/contratos";

export function GET(request: Request): Response {
  const base = new URL(request.url).origin;
  return json({
    documentacao: `${base}/contratos`,
    wsdl: `${base}/api/soap?wsdl`,
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
