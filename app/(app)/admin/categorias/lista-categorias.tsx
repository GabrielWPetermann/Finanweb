"use client";

import { useRef, useState } from "react";
import { renomearCategoriaAction } from "./actions";

interface Categoria {
  id: string;
  nome: string;
}

export function ListaCategorias({ categorias }: { categorias: Categoria[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selecionada, setSelecionada] = useState<Categoria | null>(null);

  function abrirEdicao(categoria: Categoria) {
    setSelecionada(categoria);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <ul className="lista-categorias">
        {categorias.map((c) => (
          <li key={c.id}>
            <span>{c.nome}</span>
            <button type="button" onClick={() => abrirEdicao(c)}>
              Editar
            </button>
          </li>
        ))}
        {categorias.length === 0 && <li className="vazio">Nenhuma categoria ainda.</li>}
      </ul>

      <dialog ref={dialogRef} className="dialog-categoria">
        <form action={renomearCategoriaAction} onSubmit={() => dialogRef.current?.close()}>
          <h3>Editar categoria</h3>
          <input type="hidden" name="id" value={selecionada?.id ?? ""} />
          <label>
            Nome
            <input type="text" name="nome" defaultValue={selecionada?.nome ?? ""} key={selecionada?.id} required />
          </label>
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
