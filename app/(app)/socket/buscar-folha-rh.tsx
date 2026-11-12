"use client";

import { useActionState } from "react";
import { buscarFolhaRhAction } from "./actions";

/** Puxa da API do RH a folha publicada de uma competencia. */
export function BuscarFolhaRh({ competenciaAtual }: { competenciaAtual: string }) {
  const [resultado, buscar, pending] = useActionState(buscarFolhaRhAction, null);

  return (
    <form action={buscar} className="filtros buscar-folha">
      <label>
        Folha do RH (competência)
        <input type="month" name="competencia" defaultValue={competenciaAtual} required />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Buscando..." : "Buscar folha do RH"}
      </button>
      {resultado && !resultado.ok && <p className="erro">{resultado.erro}</p>}
      {resultado?.ok && <p className="sucesso">{resultado.mensagem}</p>}
    </form>
  );
}
