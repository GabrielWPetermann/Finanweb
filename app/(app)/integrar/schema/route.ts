// Entrega os XSD para download. Quem vai gerar o arquivo do outro lado da
// integracao precisa do schema em maos: com ele, o parceiro valida antes de
// enviar, em vez de descobrir o erro so na resposta da importacao.

import { NextRequest, NextResponse } from "next/server";
import { lerSchema, SCHEMA_POR_TIPO, type SchemaXml } from "@/lib/xml/validador";

const NOMES: Record<string, SchemaXml> = {
  ENTRADA: SCHEMA_POR_TIPO.ENTRADA,
  SAIDA: SCHEMA_POR_TIPO.SAIDA,
};

export async function GET(request: NextRequest) {
  const tipo = request.nextUrl.searchParams.get("tipo") ?? "";
  const nome = NOMES[tipo];

  if (!nome) {
    return NextResponse.json({ error: "Parâmetro tipo inválido (use ENTRADA ou SAIDA)" }, { status: 400 });
  }

  return new NextResponse(lerSchema(nome), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
