import { NextRequest, NextResponse } from "next/server";
import {
  gerarModeloEntradaCsv,
  gerarModeloSaidaCsv,
  gerarModeloClientesCsv,
  gerarModeloFornecedoresCsv,
} from "@/lib/templates";

const GERADORES: Record<string, { gerar: () => string; nomeArquivo: string }> = {
  ENTRADA: { gerar: gerarModeloEntradaCsv, nomeArquivo: "modelo-entrada.csv" },
  SAIDA: { gerar: gerarModeloSaidaCsv, nomeArquivo: "modelo-saida.csv" },
  CLIENTES: { gerar: gerarModeloClientesCsv, nomeArquivo: "modelo-clientes.csv" },
  FORNECEDORES: { gerar: gerarModeloFornecedoresCsv, nomeArquivo: "modelo-fornecedores.csv" },
};

export async function GET(request: NextRequest) {
  const tipo = request.nextUrl.searchParams.get("tipo") ?? "";
  const gerador = GERADORES[tipo];

  if (!gerador) {
    return NextResponse.json({ error: "Parâmetro tipo inválido" }, { status: 400 });
  }

  return new NextResponse(gerador.gerar(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${gerador.nomeArquivo}"`,
    },
  });
}
