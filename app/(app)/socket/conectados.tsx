"use client";

import { useState, useTransition } from "react";
import type { EstadoConectados } from "@/lib/socket/estado";
import { conectadosAction } from "./actions";

/** Situacao da conexao com o servidor e quem mais esta conectado. */
export function StatusConectados({ estado, nomeOuvinte }: { estado: EstadoConectados; nomeOuvinte: string }) {
  if (!estado.ouvinteOnline) {
    return (
      <p className="erro">
        Desconectado do servidor: mensagens e arquivos não estão sendo recebidos.{" "}
        <a href="/documentacao#socket">Saiba mais</a>
      </p>
    );
  }

  const outros = estado.conectados.filter((rotulo) => !rotulo.toLowerCase().startsWith(`${nomeOuvinte.toLowerCase()}#`));
  return (
    <p className="texto-suave">
      Conectado ao servidor. Na sala: {outros.length > 0 ? outros.join(", ") : "ninguém"}.
    </p>
  );
}

export function Conectados({ inicial, nomeOuvinte }: { inicial: EstadoConectados; nomeOuvinte: string }) {
  const [estado, setEstado] = useState(inicial);
  const [pending, startTransition] = useTransition();

  function atualizar() {
    startTransition(async () => {
      const novo = await conectadosAction();
      if (novo) setEstado(novo);
    });
  }

  return (
    <>
      <StatusConectados estado={estado} nomeOuvinte={nomeOuvinte} />
      <button type="button" onClick={atualizar} disabled={pending}>
        {pending ? "Atualizando..." : "Atualizar"}
      </button>
    </>
  );
}
