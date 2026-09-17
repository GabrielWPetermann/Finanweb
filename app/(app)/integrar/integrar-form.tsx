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
        <label>
          <input type="radio" name="tipo" value="CLIENTES" /> Clientes (cadastro)
        </label>
        <label>
          <input type="radio" name="tipo" value="FORNECEDORES" /> Fornecedores (cadastro)
        </label>
      </div>

      <div className="campo">
        <label htmlFor="arquivo">Arquivo</label>
        <input
          type="file"
          id="arquivo"
          name="arquivo"
          accept=".csv,.xml,text/csv,application/xml,text/xml"
          required
        />
        <small>CSV ou XML para Entrada e Saída. Somente CSV para cadastro de Clientes/Fornecedores.</small>
      </div>

      <button type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Importar"}
      </button>

      {resultado.erro && <p className="erro">{resultado.erro}</p>}
      {resultado.ok && resultado.valorTotal !== undefined && (
        <p className="sucesso">
          Importado com sucesso: {resultado.qtdRegistros} registro(s), valor total{" "}
          {resultado.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          {resultado.qtdIgnorados ? ` - ${resultado.qtdIgnorados} linha(s) ignorada(s) (canceladas).` : ""}
        </p>
      )}
      {resultado.ok && resultado.valorTotal === undefined && (
        <p className="sucesso">
          Cadastro importado: {resultado.qtdRegistros} registro(s) — {resultado.qtdCriados} novo(s),{" "}
          {resultado.qtdAtualizados} atualizado(s).
        </p>
      )}
    </form>
  );
}
