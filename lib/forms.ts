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

// Status de um lancamento, os mesmos dos contratos v2: PENDENTE = a receber
// ou a pagar, CONFIRMADO = recebido ou pago, CANCELADO = nao vale.
export const STATUS_LANCAMENTO = ["PENDENTE", "CONFIRMADO", "CANCELADO"] as const;

/**
 * Status escolhido no formulario, ou null se nao for um dos tres. Na edicao,
 * `atual` e o status gravado: um valor antigo de texto livre (de um CSV, por
 * exemplo) pode ser mantido como esta, mas nao digitado de novo.
 */
export function lerStatus(valor: FormDataEntryValue | null, atual?: string): string | null {
  const status = String(valor ?? "").trim();
  if ((STATUS_LANCAMENTO as readonly string[]).includes(status)) return status;
  return atual !== undefined && status === atual ? status : null;
}
