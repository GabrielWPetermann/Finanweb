"use client";

import { useState } from "react";

const CRIAR_NOVO = "__novo__";

export interface OpcaoParceiro {
  id: string;
  nome: string;
}

export function SeletorParceiro({
  label,
  campoId,
  campoNomeNovo,
  opcoes,
  valorInicial,
  placeholderNovo,
}: {
  label: string;
  campoId: string;
  campoNomeNovo: string;
  opcoes: OpcaoParceiro[];
  valorInicial?: string;
  placeholderNovo: string;
}) {
  const [selecionado, setSelecionado] = useState(valorInicial ?? "");
  const criandoNovo = selecionado === CRIAR_NOVO;

  return (
    <label>
      {label}
      <select
        name={criandoNovo ? undefined : campoId}
        value={selecionado}
        onChange={(evento) => setSelecionado(evento.target.value)}
        required={!criandoNovo}
      >
        <option value="" disabled>
          Selecione...
        </option>
        {opcoes.map((opcao) => (
          <option key={opcao.id} value={opcao.id}>
            {opcao.nome}
          </option>
        ))}
        <option value={CRIAR_NOVO}>+ Criar novo...</option>
      </select>
      {criandoNovo && (
        <input type="text" name={campoNomeNovo} placeholder={placeholderNovo} required autoFocus />
      )}
    </label>
  );
}
