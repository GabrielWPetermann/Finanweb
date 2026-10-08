"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MensagemTela } from "@/lib/socket/chat";
import type { EstadoConectados } from "@/lib/socket/estado";
import { StatusConectados } from "../socket/conectados";
import { enviarMensagemAction } from "./actions";

const INTERVALO_MS = 2000;
// Mais que isso na fila e o ouvinte provavelmente nao esta rodando.
const FILA_PARADA_MS = 10_000;

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function PainelChat({
  iniciais,
  estadoInicial,
  nomeOuvinte,
}: {
  iniciais: MensagemTela[];
  estadoInicial: EstadoConectados;
  nomeOuvinte: string;
}) {
  const [mensagens, setMensagens] = useState(iniciais);
  const [estado, setEstado] = useState(estadoInicial);
  const [texto, setTexto] = useState("");
  const [destino, setDestino] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // O aviso de fila parada depende do relogio: so no navegador, para o HTML
  // do servidor e o da primeira renderizacao serem iguais.
  const [montado, setMontado] = useState(false);
  const lista = useRef<HTMLDivElement>(null);
  const noFim = useRef(true);

  const atualizar = useCallback(async () => {
    try {
      const resposta = await fetch("/chat/mensagens", { cache: "no-store" });
      if (resposta.ok) {
        const dados = (await resposta.json()) as { mensagens: MensagemTela[]; estado: EstadoConectados };
        setMensagens(dados.mensagens);
        setEstado(dados.estado);
      }
    } catch {
      // sem rede: tenta de novo no proximo ciclo
    }
  }, []);

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) atualizar();
    }, INTERVALO_MS);
    return () => clearInterval(timer);
  }, [atualizar]);

  // Desce para a ultima mensagem, a nao ser que o usuario tenha subido para
  // ler o historico.
  useEffect(() => {
    const elemento = lista.current;
    if (elemento && noFim.current) elemento.scrollTop = elemento.scrollHeight;
  }, [mensagens]);

  function aoRolar() {
    const elemento = lista.current;
    if (elemento) noFim.current = elemento.scrollHeight - elemento.scrollTop - elemento.clientHeight < 40;
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    const resultado = await enviarMensagemAction(texto, destino);
    setEnviando(false);
    if (!resultado.ok) {
      setErro(resultado.erro ?? "Não foi possível enviar.");
      return;
    }
    setErro(null);
    setTexto("");
    noFim.current = true;
    atualizar();
  }

  const filaParada =
    montado &&
    mensagens.some(
      (m) => !m.enviada && Date.now() - new Date(m.criadoEm).getTime() > FILA_PARADA_MS
    );

  return (
    <div className="chat">
      <StatusConectados estado={estado} nomeOuvinte={nomeOuvinte} />
      <div className="chat-mensagens" ref={lista} onScroll={aoRolar}>
        {mensagens.length === 0 && <p className="texto-suave chat-vazio">Nenhuma mensagem ainda.</p>}
        {mensagens.map((m) =>
          m.aviso ? (
            <div key={m.id} className="chat-aviso">
              {m.texto} · <time suppressHydrationWarning>{hora(m.criadoEm)}</time>
            </div>
          ) : (
            <div key={m.id} className={`chat-balao ${m.direcao === "ENVIADA" ? "chat-enviada" : "chat-recebida"}`}>
              <div className="chat-meta">
                <strong>{m.autor}</strong>
                {m.direcao === "ENVIADA" && <span> → {m.destino ?? "todos"}</span>}
                {m.arquivo && <span className="chat-etiqueta">arquivo</span>}
                {m.privada && <span className="chat-etiqueta">privada</span>}
                <time suppressHydrationWarning>{hora(m.criadoEm)}</time>
                {!m.enviada && <span className="chat-etiqueta">pendente</span>}
              </div>
              <div className="chat-texto">{m.texto}</div>
            </div>
          )
        )}
      </div>

      {filaParada && (
        <p className="erro">Há mensagens pendentes. Elas serão enviadas quando a conexão com o servidor voltar.</p>
      )}
      {erro && <p className="erro">{erro}</p>}

      <form className="chat-form" onSubmit={enviar}>
        <input
          type="text"
          className="chat-destino"
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          placeholder="para: todos"
          aria-label="Destino (nome ou id; vazio = todos)"
        />
        <input
          type="text"
          className="chat-campo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva uma mensagem"
          aria-label="Mensagem"
          maxLength={1000}
        />
        <button type="submit" disabled={enviando || !texto.trim()}>
          {enviando ? "Enviando..." : "Enviar"}
        </button>
      </form>
    </div>
  );
}
