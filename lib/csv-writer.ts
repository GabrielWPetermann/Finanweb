// Helper generico para montar CSV na mao (sem lib), usado pelos relatorios
// exportaveis.

export function linhaCsv(campos: Array<string | number | null | undefined>): string {
  return campos.map((campo) => (campo === null || campo === undefined ? "" : String(campo))).join(",");
}

export function montarCsv(linhas: string[]): string {
  return linhas.join("\r\n") + "\r\n";
}

export function formatarDataAAAAMMDD(data: Date): string {
  return data.toISOString().slice(0, 10).replace(/-/g, "");
}
