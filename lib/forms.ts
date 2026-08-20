// Helpers para ler campos de formulario (FormData) nos server actions de
// lancamento manual/edicao de Recebimentos e Pagamentos.

export function paraNumero(valor: FormDataEntryValue | null, padrao = 0): number {
  const texto = String(valor ?? "").trim().replace(",", ".");
  if (texto === "") return padrao;
  const numero = Number(texto);
  return Number.isNaN(numero) ? padrao : numero;
}

export function paraDataInput(valor: FormDataEntryValue | null): Date {
  return new Date(`${String(valor)}T00:00:00.000Z`);
}

export function paraDataInputValue(data: Date): string {
  return data.toISOString().slice(0, 10);
}
