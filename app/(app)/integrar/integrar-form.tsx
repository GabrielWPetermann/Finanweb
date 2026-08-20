"use client";

import { useActionState } from "react";
import { importarAction, type ResultadoImportacao } from "./actions";

const estadoInicial: ResultadoImportacao = { ok: false };

export function IntegrarForm() {
  const [resultado, formAction, pending] = useActionState(importarAction, estadoInicial);

  return (
    <form action={formAction} className="card">
      <div className="campo">
        <span>Tipo de arquivo</span>
        <label>
          <input type="radio" name="tipo" value="ENTRADA" defaultChecked /> Entrada
        </label>
        <label>
          <input type="radio" name="tipo" value="SAIDA" /> Saída
        </label>
      </div>

      <div className="campo">
        <label htmlFor="arquivo">Arquivo CSV</label>
        <input type="file" id="arquivo" name="arquivo" accept=".csv,text/csv" required />
      </div>

      <button type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Importar"}
      </button>

      {resultado.erro && <p className="erro">{resultado.erro}</p>}
      {resultado.ok && (
        <p className="sucesso">
          Importado com sucesso: {resultado.qtdRegistros} registro(s), valor total{" "}
          {resultado.valorTotal?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          {resultado.qtdIgnorados ? ` — ${resultado.qtdIgnorados} linha(s) ignorada(s) (canceladas).` : ""}
        </p>
      )}
    </form>
  );
}
