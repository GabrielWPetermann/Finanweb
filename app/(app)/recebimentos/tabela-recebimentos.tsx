"use client";

import { useRef, useState } from "react";
import { editarRecebimentoAction, excluirRecebimentoAction } from "./actions";

export interface RecebimentoLinha {
  id: string;
  cliente: string;
  categoriaNome: string;
  subtotal: string;
  descontoPercentual: string;
  descontoValor: string;
  frete: string;
  valorTotal: string;
  formaPagamento: string;
  dataPedido: string;
  status: string;
  valorFormatado: string;
  dataFormatada: string;
}

function confirmarExclusao(evento: React.FormEvent<HTMLFormElement>) {
  if (!confirm("Excluir este recebimento? Essa ação não pode ser desfeita.")) {
    evento.preventDefault();
  }
}

export function TabelaRecebimentos({
  pedidos,
  categoriasNomes,
  isAdmin,
}: {
  pedidos: RecebimentoLinha[];
  categoriasNomes: string[];
  isAdmin: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selecionado, setSelecionado] = useState<RecebimentoLinha | null>(null);

  function abrirEdicao(pedido: RecebimentoLinha) {
    setSelecionado(pedido);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Categoria</th>
            <th>Data</th>
            <th>Forma de pagamento</th>
            <th>Valor total</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => (
            <tr key={p.id}>
              <td>{p.cliente}</td>
              <td>{p.categoriaNome}</td>
              <td>{p.dataFormatada}</td>
              <td>{p.formaPagamento}</td>
              <td>{p.valorFormatado}</td>
              <td>{p.status}</td>
              <td>
                <div className="linha-acoes">
                  <button type="button" onClick={() => abrirEdicao(p)}>
                    Editar
                  </button>
                  {isAdmin && (
                    <form action={excluirRecebimentoAction} onSubmit={confirmarExclusao}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="botao-perigo">
                        Excluir
                      </button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {pedidos.length === 0 && (
            <tr>
              <td colSpan={7}>Nenhum registro encontrado.</td>
            </tr>
          )}
        </tbody>
      </table>

      <dialog ref={dialogRef} className="dialog-registro">
        <form action={editarRecebimentoAction} onSubmit={() => dialogRef.current?.close()}>
          <h3>Editar recebimento</h3>
          <input type="hidden" name="id" value={selecionado?.id ?? ""} />

          <div className="grid-2" key={selecionado?.id}>
            <label>
              Cliente
              <input type="text" name="cliente" defaultValue={selecionado?.cliente} required />
            </label>
            <label>
              Categoria
              <input type="text" name="categoria" defaultValue={selecionado?.categoriaNome} list="categorias-entrada-dialog" required />
            </label>
            <label>
              Subtotal
              <input type="text" name="subtotal" defaultValue={selecionado?.subtotal} />
            </label>
            <label>
              Desconto (%)
              <input type="text" name="descontoPercentual" defaultValue={selecionado?.descontoPercentual} />
            </label>
            <label>
              Desconto (R$)
              <input type="text" name="descontoValor" defaultValue={selecionado?.descontoValor} />
            </label>
            <label>
              Frete
              <input type="text" name="frete" defaultValue={selecionado?.frete} />
            </label>
            <label>
              Valor total
              <input type="text" name="valorTotal" defaultValue={selecionado?.valorTotal} required />
            </label>
            <label>
              Forma de pagamento
              <input type="text" name="formaPagamento" defaultValue={selecionado?.formaPagamento} required />
            </label>
            <label>
              Data
              <input type="date" name="dataPedido" defaultValue={selecionado?.dataPedido} required />
            </label>
            <label>
              Status
              <input type="text" name="status" defaultValue={selecionado?.status} required />
            </label>
          </div>

          <datalist id="categorias-entrada-dialog">
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
