// Status de um lancamento como lista fechada (lib/forms.ts). Um status antigo,
// de antes da lista, aparece como opcao a mais so no lancamento que o tem,
// para a edicao nao trocar o valor sem ninguem pedir.

import { STATUS_LANCAMENTO } from "@/lib/forms";

const ROTULOS: Record<"recebimento" | "pagamento", Record<(typeof STATUS_LANCAMENTO)[number], string>> = {
  recebimento: { PENDENTE: "Pendente (a receber)", CONFIRMADO: "Confirmado (recebido)", CANCELADO: "Cancelado" },
  pagamento: { PENDENTE: "Pendente (a pagar)", CONFIRMADO: "Confirmado (pago)", CANCELADO: "Cancelado" },
};

export function SeletorStatus({
  tipo,
  valorInicial = "CONFIRMADO",
}: {
  tipo: "recebimento" | "pagamento";
  valorInicial?: string;
}) {
  const antigo = (STATUS_LANCAMENTO as readonly string[]).includes(valorInicial) ? null : valorInicial;
  return (
    <label>
      Status
      <select name="status" defaultValue={valorInicial} required>
        {STATUS_LANCAMENTO.map((status) => (
          <option key={status} value={status}>
            {ROTULOS[tipo][status]}
          </option>
        ))}
        {antigo && <option value={antigo}>{antigo} (valor antigo)</option>}
      </select>
    </label>
  );
}
