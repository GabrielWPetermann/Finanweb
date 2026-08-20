"use client";

import { useRef, useState } from "react";
import { editarPagamentoAction, excluirPagamentoAction } from "./actions";

export interface PagamentoLinha {
  id: string;
  fornecedor: string;
  categoriaNome: string;
  valor: string;
  formaPagamento: string;
  dataPagamento: string;
  status: string;
  valorFormatado: string;
  dataFormatada: string;
}

function confirmarExclusao(evento: React.FormEvent<HTMLFormElement>) {
  if (!confirm("Excluir este pagamento? Essa ação não pode ser desfeita.")) {
    evento.preventDefault();
  }
}

export function TabelaPagamentos({
  despesas,
  categoriasNomes,
  isAdmin,
}: {
  despesas: PagamentoLinha[];
  categoriasNomes: string[];
  isAdmin: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selecionado, setSelecionado] = useState<PagamentoLinha | null>(null);

  function abrirEdicao(despesa: PagamentoLinha) {
    setSelecionado(despesa);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Fornecedor</th>
            <th>Categoria</th>
            <th>Data</th>
            <th>Forma de pagamento</th>
            <th>Valor</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {despesas.map((d) => (
            <tr key={d.id}>
              <td>{d.fornecedor}</td>
              <td>{d.categoriaNome}</td>
              <td>{d.dataFormatada}</td>
              <td>{d.formaPagamento}</td>
              <td>{d.valorFormatado}</td>
              <td>{d.status}</td>
              <td>
                <div className="linha-acoes">
                  <button type="button" onClick={() => abrirEdicao(d)}>
                    Editar
                  </button>
                  {isAdmin && (
                    <form action={excluirPagamentoAction} onSubmit={confirmarExclusao}>
                      <input type="hidden" name="id" value={d.id} />
                      <button type="submit" className="botao-perigo">
                        Excluir
                      </button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {despesas.length === 0 && (
            <tr>
              <td colSpan={7}>Nenhum registro encontrado.</td>
            </tr>
          )}
        </tbody>
      </table>

      <dialog ref={dialogRef} className="dialog-registro">
        <form action={editarPagamentoAction} onSubmit={() => dialogRef.current?.close()}>
          <h3>Editar pagamento</h3>
          <input type="hidden" name="id" value={selecionado?.id ?? ""} />

          <div className="grid-2" key={selecionado?.id}>
            <label>
              Fornecedor
              <input type="text" name="fornecedor" defaultValue={selecionado?.fornecedor} required />
            </label>
            <label>
              Categoria
              <input
                type="text"
                name="categoria"
                defaultValue={selecionado?.categoriaNome}
                list="categorias-saida-dialog"
                required
              />
            </label>
            <label>
              Valor
              <input type="text" name="valor" defaultValue={selecionado?.valor} required />
            </label>
            <label>
              Forma de pagamento
              <input type="text" name="formaPagamento" defaultValue={selecionado?.formaPagamento} required />
            </label>
            <label>
              Data
              <input type="date" name="dataPagamento" defaultValue={selecionado?.dataPagamento} required />
            </label>
            <label>
              Status
              <input type="text" name="status" defaultValue={selecionado?.status} required />
            </label>
          </div>

          <datalist id="categorias-saida-dialog">
            {categoriasNomes.map((nome) => (
              <option key={nome} value={nome} />
            ))}
          </datalist>

          <div className="dialog-acoes">
            <button type="button" onClick={() => dialogRef.current?.close()}>
              Cancelar
            </button>
            <button type="submit">Salvar</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
