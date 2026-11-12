"use client";

import { useActionState, useState } from "react";
import type { TipoMovimento } from "@/lib/socket/caixa-entrada";
import {
  descartarRecebidosAction,
  importarRecebidosAction,
  type ResultadoRecebido,
  type ResultadoRecebidos,
} from "./actions";

export interface LinhaRecebido {
  pathname: string;
  recebidoEm: string;
  remetente: string;
  nomeArquivo: string;
  tipo: TipoMovimento;
  tamanho: string;
}

const NOME_TIPO: Record<TipoMovimento, string> = { ENTRADA: "Entrada", SAIDA: "Saída", FOLHA: "Folha" };

const estadoInicial: ResultadoRecebidos = { itens: [] };

const moeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function descreverImportado(r: ResultadoRecebido): string {
  return [
    `${r.qtdRegistros ?? 0} registro(s) novo(s)`,
    r.valorTotal !== undefined ? `valor total ${moeda(r.valorTotal)}` : null,
    r.qtdIgnorados ? `${r.qtdIgnorados} linha(s) ignorada(s) (canceladas)` : null,
    r.qtdRepetidos ? `${r.qtdRepetidos} já lançado(s) antes, pulado(s)` : null,
    r.qtdAtualizados ? `${r.qtdAtualizados} já lançado(s) em aberto atualizado(s) (status ou vencimento)` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ListaRecebidos({ linhas }: { linhas: LinhaRecebido[] }) {
  const [resultado, importarAction, pending] = useActionState(importarRecebidosAction, estadoInicial);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  // Marcados que ainda estao na caixa (os importados ou descartados saem).
  const escolhidos = linhas.filter((l) => marcados.has(l.pathname));
  const todos = linhas.length > 0 && escolhidos.length === linhas.length;

  function alternar(pathname: string) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(pathname)) novo.delete(pathname);
      else novo.add(pathname);
      return novo;
    });
  }

  function confirmarDescarte(qtd: number) {
    return (evento: React.FormEvent<HTMLFormElement>) => {
      const texto =
        qtd === 1
          ? "Descartar esse arquivo? Ele é apagado da caixa de entrada sem ser importado."
          : `Descartar ${qtd} arquivos? Eles são apagados da caixa de entrada sem ser importados.`;
      if (!confirm(texto)) evento.preventDefault();
    };
  }

  const importados = resultado.itens.filter((i) => i.ok);
  const recusados = resultado.itens.filter((i) => !i.ok);

  return (
    <>
      {resultado.erro && <p className="erro">{resultado.erro}</p>}
      {importados.length > 0 && (
        <div className="sucesso">
          <strong>Importado{importados.length > 1 ? `s ${importados.length} arquivos` : ""}</strong> (já aparece no
          Histórico):
          <ul>
            {importados.map((r) => (
              <li key={r.nomeArquivo}>
                {r.nomeArquivo}: {descreverImportado(r)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {recusados.length > 0 && (
        <div className="erro">
          <strong>Não importado{recusados.length > 1 ? `s ${recusados.length} arquivos` : ""}</strong> (continuam na
          caixa):
          <ul>
            {recusados.map((r) => (
              <li key={r.nomeArquivo}>
                {r.nomeArquivo}: {r.erro}
              </li>
            ))}
          </ul>
        </div>
      )}

      {linhas.length > 0 && (
        <div className="lote-acoes recebidos-acoes">
          <span>
            {escolhidos.length === 0
              ? "Marque os arquivos para importar ou descartar vários de uma vez:"
              : `${escolhidos.length} de ${linhas.length} arquivo(s) marcado(s):`}
          </span>
          <form action={importarAction}>
            {escolhidos.map((l) => (
              <input key={l.pathname} type="hidden" name="pathname" value={l.pathname} />
            ))}
            <button type="submit" disabled={pending || escolhidos.length === 0}>
              {pending ? "Importando..." : `Importar marcados (${escolhidos.length})`}
            </button>
          </form>
          <form action={descartarRecebidosAction} onSubmit={confirmarDescarte(escolhidos.length)}>
            {escolhidos.map((l) => (
              <input key={l.pathname} type="hidden" name="pathname" value={l.pathname} />
            ))}
            <button type="submit" className="botao-perigo" disabled={pending || escolhidos.length === 0}>
              Descartar marcados ({escolhidos.length})
            </button>
          </form>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th className="coluna-marcar">
              {linhas.length > 0 && (
                <input
                  type="checkbox"
                  aria-label="Marcar todos os arquivos"
                  title="Marcar todos"
                  checked={todos}
                  onChange={() => setMarcados(todos ? new Set() : new Set(linhas.map((l) => l.pathname)))}
                />
              )}
            </th>
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
            <tr key={linha.pathname} className={marcados.has(linha.pathname) ? "linha-marcada" : undefined}>
              <td className="coluna-marcar">
                <input
                  type="checkbox"
                  aria-label={`Marcar ${linha.nomeArquivo}`}
                  checked={marcados.has(linha.pathname)}
                  onChange={() => alternar(linha.pathname)}
                />
              </td>
              <td>{linha.recebidoEm}</td>
              <td>{linha.remetente}</td>
              <td>{linha.nomeArquivo}</td>
              <td>{NOME_TIPO[linha.tipo]}</td>
              <td>{linha.tamanho}</td>
              <td>
                <div className="linha-acoes">
                  <form action={importarAction}>
                    <input type="hidden" name="pathname" value={linha.pathname} />
                    <button type="submit" disabled={pending}>
                      Importar
                    </button>
                  </form>
                  <form action={descartarRecebidosAction} onSubmit={confirmarDescarte(1)}>
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
              <td colSpan={7}>Nenhum arquivo aguardando aprovação.</td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
