"use client";

import { useActionState } from "react";
import type { ResultadoImportacao } from "@/lib/importacao";
import { descartarRecebidoAction, importarRecebidoAction } from "./actions";

export interface LinhaRecebido {
  pathname: string;
  recebidoEm: string;
  remetente: string;
  nomeArquivo: string;
  tipo: "ENTRADA" | "SAIDA";
  tamanho: string;
}

const estadoInicial: ResultadoImportacao = { ok: false };

function confirmarDescarte(evento: React.FormEvent<HTMLFormElement>) {
  if (!confirm("Descartar esse arquivo? Ele é apagado da caixa de entrada sem ser importado.")) {
    evento.preventDefault();
  }
}

export function ListaRecebidos({ linhas }: { linhas: LinhaRecebido[] }) {
  const [resultado, importarAction, pending] = useActionState(importarRecebidoAction, estadoInicial);

  return (
    <>
      {resultado.erro && <p className="erro">Não importado: {resultado.erro}</p>}
      {resultado.ok && resultado.valorTotal !== undefined && (
        <p className="sucesso">
          Importado: {resultado.qtdRegistros} registro(s), valor total{" "}
          {resultado.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          {resultado.qtdIgnorados ? ` - ${resultado.qtdIgnorados} linha(s) ignorada(s) (canceladas).` : ""} Já
          aparece no Histórico.
        </p>
      )}

      <table>
        <thead>
          <tr>
            <th>Recebido em</th>
            <th>De</th>
            <th>Arquivo</th>
            <th>Tipo</th>
            <th>Tamanho</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.pathname}>
              <td>{linha.recebidoEm}</td>
              <td>{linha.remetente}</td>
              <td>{linha.nomeArquivo}</td>
              <td>{linha.tipo === "ENTRADA" ? "Entrada" : "Saída"}</td>
              <td>{linha.tamanho}</td>
              <td>
                <div className="linha-acoes">
                  <form action={importarAction}>
                    <input type="hidden" name="pathname" value={linha.pathname} />
                    <button type="submit" disabled={pending}>
                      Importar
                    </button>
                  </form>
                  <form action={descartarRecebidoAction} onSubmit={confirmarDescarte}>
                    <input type="hidden" name="pathname" value={linha.pathname} />
                    <button type="submit" className="botao-perigo" disabled={pending}>
                      Descartar
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
          {linhas.length === 0 && (
            <tr>
              <td colSpan={6}>Nenhum arquivo aguardando aprovação.</td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
