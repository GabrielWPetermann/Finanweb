import { NextRequest, NextResponse } from "next/server";
import {
  gerarModeloEntradaCsv,
  gerarModeloSaidaCsv,
  gerarModeloClientesCsv,
  gerarModeloFornecedoresCsv,
  gerarModeloEntradaXml,
  gerarModeloSaidaXml,
} from "@/lib/templates";

interface Modelo {
  gerar: () => string;
  nomeArquivo: string;
  contentType: string;
}

const CSV = "text/csv; charset=utf-8";
const XML = "application/xml; charset=utf-8";

const MODELOS_CSV: Record<string, Modelo> = {
  ENTRADA: { gerar: gerarModeloEntradaCsv, nomeArquivo: "modelo-entrada.csv", contentType: CSV },
  SAIDA: { gerar: gerarModeloSaidaCsv, nomeArquivo: "modelo-saida.csv", contentType: CSV },
  CLIENTES: { gerar: gerarModeloClientesCsv, nomeArquivo: "modelo-clientes.csv", contentType: CSV },
  FORNECEDORES: { gerar: gerarModeloFornecedoresCsv, nomeArquivo: "modelo-fornecedores.csv", contentType: CSV },
};

// Cadastro de clientes e fornecedores nao tem formato XML: e uma lista plana,
// sem cabecalho nem totalizador, e nao ha XSD para ela.
const MODELOS_XML: Record<string, Modelo> = {
  ENTRADA: { gerar: gerarModeloEntradaXml, nomeArquivo: "modelo-entrada.xml", contentType: XML },
  SAIDA: { gerar: gerarModeloSaidaXml, nomeArquivo: "modelo-saida.xml", contentType: XML },
};

export async function GET(request: NextRequest) {
  const tipo = request.nextUrl.searchParams.get("tipo") ?? "";
  // Sem o parametro, continua devolvendo CSV como sempre fez.
  const formato = (request.nextUrl.searchParams.get("formato") ?? "csv").toLowerCase();

  if (formato !== "csv" && formato !== "xml") {
    return NextResponse.json({ error: "Parâmetro formato inválido (use csv ou xml)" }, { status: 400 });
  }

  const modelo = formato === "xml" ? MODELOS_XML[tipo] : MODELOS_CSV[tipo];
  if (!modelo) {
    return NextResponse.json(
      { error: `Não há modelo ${formato.toUpperCase()} para o tipo "${tipo}"` },
      { status: 400 }
    );
  }

  return new NextResponse(modelo.gerar(), {
    headers: {
      "Content-Type": modelo.contentType,
      "Content-Disposition": `attachment; filename="${modelo.nomeArquivo}"`,
    },
  });
}
