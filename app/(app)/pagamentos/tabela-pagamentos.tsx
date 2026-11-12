"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  cancelarPagamentosAction,
  confirmarPagamentosAction,
  editarPagamentoAction,
  excluirPagamentoAction,
} from "./actions";
import { SeletorParceiro, type OpcaoParceiro } from "../_components/seletor-parceiro";
import { SeletorStatus } from "../_components/seletor-status";

export interface PagamentoLinha {
  id: string;
  fornecedorId: string;
  fornecedorNome: string;
  categoriaNome: string;
  valor: string;
  formaPagamento: string;
  dataPagamento: string;
  status: string;
  // Identificador no sistema do setor (PC-1004, FOLHA-2026-10/CPF); nulo no manual.
  referencia: string | null;
  valorFormatado: string;
  dataFormatada: string;
}

/** Um lote de envio (uma importacao) ou os lancamentos feitos na tela. */
export interface LotePagamento {
  chave: string;
  titulo: string;
  detalhe: string;
  // Download do arquivo original, como no Historico.
  arquivo: string | null;
  despesas: PagamentoLinha[];
  qtdPendentes: number;
  totalFormatado: string;
  pendenteFormatado: string;
}

const ehPendente = (d: PagamentoLinha) => d.status.trim().toUpperCase() === "PENDENTE";

function confirmarExclusao(evento: React.FormEvent<HTMLFormElement>) {
  if (!confirm("Excluir este pagamento? Essa ação não pode ser desfeita.")) {
    evento.preventDefault();
  }
}

function BotoesBaixa({ qtd }: { qtd: number }) {
  const { pending } = useFormStatus();
  const vazio = qtd === 0 || pending;
  return (
    <>
      <button type="submit" formAction={confirmarPagamentosAction} value="CONFIRMADO" disabled={vazio}>
        {pending ? "Gravando..." : `Confirmar (${qtd})`}
      </button>
      <button type="submit" formAction={cancelarPagamentosAction} value="CANCELADO" className="botao-perigo" disabled={vazio}>
        Cancelar ({qtd})
      </button>
    </>
  );
}

function BlocoLote({
  lote,
  aberto,
  isAdmin,
  onEditar,
}: {
  lote: LotePagamento;
  aberto: boolean;
  isAdmin: boolean;
  onEditar: (d: PagamentoLinha) => void;
}) {
  const pendentes = lote.despesas.filter(ehPendente);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  // Marcados que ainda estao pendentes (depois de gravar, os baixados saem).
  const escolhidos = pendentes.filter((d) => marcados.has(d.id));
  const todos = pendentes.length > 0 && escolhidos.length === pendentes.length;

  function alternar(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function perguntar(evento: React.FormEvent<HTMLFormElement>) {
    const status = (evento.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    const acao = status === "CANCELADO" ? "Cancelar" : "Marcar como pagos (CONFIRMADO)";
    const avisos = lote.chave === "manual" ? "" : " O setor de origem recebe o aviso de cada um.";
    if (!confirm(`${acao} ${escolhidos.length} pagamento(s) de "${lote.titulo}"?${avisos}`)) {
      evento.preventDefault();
    }
  }

  return (
    <details className="lote" open={aberto}>
      <summary>
        <span className="lote-titulo">{lote.titulo}</span>
        <span className="lote-detalhe">{lote.detalhe}</span>
        <span className="lote-resumo">
          {lote.despesas.length} {lote.despesas.length === 1 ? "pagamento" : "pagamentos"} · {lote.totalFormatado}
          {lote.qtdPendentes > 0 && (
            <>
              {" "}
              · <strong>{lote.qtdPendentes} pendente{lote.qtdPendentes === 1 ? "" : "s"}</strong> (
              {lote.pendenteFormatado})
            </>
          )}
        </span>
        {lote.arquivo && (
          <a href={lote.arquivo} className="lote-arquivo">
            Baixar arquivo
          </a>
        )}
      </summary>

      {pendentes.length > 0 && (
        // Os ids marcados vao como campos do form; as acoes so mexem nos que
        // ainda estiverem pendentes.
        <form onSubmit={perguntar} className="lote-acoes">
          {escolhidos.map((d) => (
            <input key={d.id} type="hidden" name="id" value={d.id} />
          ))}
          <span>
            {escolhidos.length === 0
              ? "Marque os pendentes que quer baixar:"
              : `${escolhidos.length} de ${pendentes.length} pendente(s) marcado(s):`}
          </span>
          <BotoesBaixa qtd={escolhidos.length} />
        </form>
      )}

      <table>
        <thead>
          <tr>
            <th className="coluna-marcar">
              {pendentes.length > 0 && (
                <input
                  type="checkbox"
                  aria-label="Marcar todos os pendentes do lote"
                  title="Marcar todos os pendentes"
                  checked={todos}
                  onChange={() => setMarcados(todos ? new Set() : new Set(pendentes.map((d) => d.id)))}
                />
              )}
            </th>
            <th>Referência</th>
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
          {lote.despesas.map((d) => (
            <tr key={d.id} className={marcados.has(d.id) && ehPendente(d) ? "linha-marcada" : undefined}>
              <td className="coluna-marcar">
                {ehPendente(d) && (
                  <input
                    type="checkbox"
                    aria-label={`Marcar ${d.referencia ?? d.fornecedorNome}`}
                    checked={marcados.has(d.id)}
                    onChange={() => alternar(d.id)}
                  />
                )}
              </td>
              <td>{d.referencia ?? "—"}</td>
              <td>{d.fornecedorNome}</td>
              <td>{d.categoriaNome}</td>
              <td>{d.dataFormatada}</td>
              <td>{d.formaPagamento}</td>
              <td>{d.valorFormatado}</td>
              <td>{d.status}</td>
              <td>
                <div className="linha-acoes">
                  <button type="button" onClick={() => onEditar(d)}>
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
        </tbody>
      </table>
    </details>
  );
}

export function TabelaPagamentos({
  lotes,
  loteEscolhido,
  categoriasNomes,
  fornecedores,
  isAdmin,
}: {
  lotes: LotePagamento[];
  // Filtro por um lote: ele aparece aberto.
  loteEscolhido: boolean;
  categoriasNomes: string[];
  fornecedores: OpcaoParceiro[];
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
      {lotes.length === 0 && <p className="lote-vazio">Nenhum registro encontrado.</p>}
      {lotes.map((lote, indice) => (
        // So o lote mais recente vem aberto; o resumo dos outros ja diz o
        // que tem dentro.
        <BlocoLote
          key={lote.chave}
          lote={lote}
          aberto={indice === 0 || loteEscolhido}
          isAdmin={isAdmin}
          onEditar={abrirEdicao}
        />
      ))}

      <dialog ref={dialogRef} className="dialog-registro">
        <form action={editarPagamentoAction} onSubmit={() => dialogRef.current?.close()}>
          <h3>Editar pagamento</h3>
          <input type="hidden" name="id" value={selecionado?.id ?? ""} />

          <div className="grid-2" key={selecionado?.id}>
            <SeletorParceiro
              label="Fornecedor"
              campoId="fornecedorId"
              campoNomeNovo="fornecedorNovoNome"
              opcoes={fornecedores}
              valorInicial={selecionado?.fornecedorId}
              placeholderNovo="Nome do novo fornecedor"
            />
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
            <SeletorStatus tipo="pagamento" valorInicial={selecionado?.status} />
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
