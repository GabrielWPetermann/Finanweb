"use client";

import { useRef, useState } from "react";
import { editarParceiroAction, alternarAtivoParceiroAction } from "./actions";

export interface ParceiroLinha {
  id: string;
  nome: string;
  documento: string;
  email: string;
  telefone: string;
  ativo: boolean;
}

export function ListaParceiros({ parceiros }: { parceiros: ParceiroLinha[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selecionado, setSelecionado] = useState<ParceiroLinha | null>(null);

  function abrirEdicao(parceiro: ParceiroLinha) {
    setSelecionado(parceiro);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <ul className="lista-categorias">
        {parceiros.map((p) => (
          <li key={p.id}>
            <span>
              {p.nome}
              {!p.ativo && " (inativo)"}
              {p.documento && <span className="texto-suave"> — {p.documento}</span>}
            </span>
            <div className="linha-acoes">
              <button type="button" onClick={() => abrirEdicao(p)}>
                Editar
              </button>
              <form action={alternarAtivoParceiroAction}>
                <input type="hidden" name="id" value={p.id} />
                <button type="submit">{p.ativo ? "Desativar" : "Ativar"}</button>
              </form>
            </div>
          </li>
        ))}
        {parceiros.length === 0 && <li className="vazio">Nenhum cadastro ainda.</li>}
      </ul>

      <dialog ref={dialogRef} className="dialog-registro">
        <form action={editarParceiroAction} onSubmit={() => dialogRef.current?.close()}>
          <h3>Editar cadastro</h3>
          <input type="hidden" name="id" value={selecionado?.id ?? ""} />
          <div className="dialog-coluna" key={selecionado?.id}>
            <label>
              Nome
              <input type="text" name="nome" defaultValue={selecionado?.nome} required />
            </label>
            <label>
              Documento (CNPJ/CPF)
              <input type="text" name="documento" defaultValue={selecionado?.documento} />
            </label>
            <label>
              E-mail
              <input type="text" name="email" defaultValue={selecionado?.email} />
            </label>
            <label>
              Telefone
              <input type="text" name="telefone" defaultValue={selecionado?.telefone} />
            </label>
          </div>
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
