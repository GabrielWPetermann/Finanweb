import { NextRequest, NextResponse } from "next/server";
import { gerarModeloEntradaCsv, gerarModeloSaidaCsv } from "@/lib/templates";

export async function GET(request: NextRequest) {
  const tipo = request.nextUrl.searchParams.get("tipo");

  if (tipo !== "ENTRADA" && tipo !== "SAIDA") {
    return NextResponse.json({ error: "Parâmetro tipo inválido" }, { status: 400 });
  }

  const csv = tipo === "ENTRADA" ? gerarModeloEntradaCsv() : gerarModeloSaidaCsv();
  const nomeArquivo = tipo === "ENTRADA" ? "modelo-entrada.csv" : "modelo-saida.csv";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
