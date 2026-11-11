"use client";

import { useActionState } from "react";
import { gerarChaveAction, type ResultadoChave } from "./actions";

const estadoInicial: ResultadoChave = {};

export function GerarChave() {
  const [resultado, action, pending] = useActionState(gerarChaveAction, estadoInicial);

  return (
    <form action={action} className="linha-form">
      <input type="text" name="setor" placeholder="Setor (ex.: vendas)" required />
      <button type="submit" disabled={pending}>
        Gerar chave
      </button>
      {resultado.erro && <p className="erro">{resultado.erro}</p>}
      {resultado.chave && (
        <p className="sucesso">
          Chave de <strong>{resultado.setor}</strong>: <code>{resultado.chave}</code>. Copie agora e mande ao setor
          em privado: ela não aparece de novo. Gerar outra invalida esta.
        </p>
      )}
    </form>
  );
}
