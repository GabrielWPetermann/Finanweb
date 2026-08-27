"use client";

import { recusarUsuarioAction } from "./actions";

function confirmarRecusa(evento: React.FormEvent<HTMLFormElement>) {
  if (!confirm("Recusar essa solicitação de cadastro? O registro é apagado, sem volta.")) {
    evento.preventDefault();
  }
}

export function BotaoRecusar({ id }: { id: string }) {
  return (
    <form action={recusarUsuarioAction} onSubmit={confirmarRecusa}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="botao-perigo">
        Recusar
      </button>
    </form>
  );
}
