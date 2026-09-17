// Helpers de escrita de XML, na mesma linha do lib/csv-writer.ts: montagem na
// mao, sem lib de serializacao.

const ENTIDADES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const REGEX_ESCAPE = /[&<>"']/g;

// Aplicado a todo texto e atributo vindo dos dados. Numeros e datas saem de
// toFixed/formatarDataIso e nao tem como conter esses caracteres.
export function escaparXml(texto: string): string {
  return texto.replace(REGEX_ESCAPE, (caractere) => ENTIDADES[caractere]);
}

// Simetrico ao formatarDataAAAAMMDD do csv-writer, mas no formato do xs:date.
export function formatarDataIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

// AAAAMMDD (layout texto) -> AAAA-MM-DD (xs:date).
export function dataTextoParaIso(valor: string): string {
  return `${valor.slice(0, 4)}-${valor.slice(4, 6)}-${valor.slice(6, 8)}`;
}

// AAAA-MM-DD (xs:date) -> AAAAMMDD, que e o que os parsers devolvem.
export function dataIsoParaTexto(valor: string): string {
  return valor.slice(0, 4) + valor.slice(5, 7) + valor.slice(8, 10);
}
