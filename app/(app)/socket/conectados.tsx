"use client";

import { useActionState } from "react";
import { conectadosAction, type ResultadoConectados } from "./actions";

const estadoInicial: ResultadoConectados = { ok: false };

export function Conectados({ nomeOuvinte }: { nomeOuvinte: string }) {
  const [resultado, formAction, pending] = useActionState(conectadosAction, estadoInicial);
  const ouvinteOnline = resultado.conectados?.some((rotulo) =>
    rotulo.toLowerCase().startsWith(`${nomeOuvinte.toLowerCase()}#`)
  );

  return (
    <form action={formAction}>
      <button type="submit" disabled={pending}>
        {pending ? "Consultando..." : "Ver quem está conectado"}
      </button>

      {resultado.erro && <p className="erro">{resultado.erro}</p>}
      {resultado.ok && (
        <>
          <p className={ouvinteOnline ? "sucesso" : "erro"}>
            {ouvinteOnline
              ? `Ouvinte "${nomeOuvinte}" conectado: os XMLs enviados para ele chegam na lista abaixo.`
              : `Ouvinte "${nomeOuvinte}" fora do ar: rode npm run socket para receber arquivos.`}
          </p>
          <p className="texto-suave">
            Conectados: {resultado.conectados?.length ? resultado.conectados.join(", ") : "ninguém além desta consulta"}
          </p>
        </>
      )}
    </form>
  );
}
