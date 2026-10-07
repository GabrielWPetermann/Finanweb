"use client";

import { useActionState, useState } from "react";
import { enviarSocketAction, type ResultadoEnvio } from "./actions";

const estadoInicial: ResultadoEnvio = { ok: false };

export function EnviarForm() {
  const [resultado, formAction, pending] = useActionState(enviarSocketAction, estadoInicial);
  // Campos controlados: o React 19 limpa o formulario depois de cada envio, e
  // apos um erro o usuario perderia o periodo e o destino que digitou.
  const [origem, setOrigem] = useState<"periodo" | "arquivo">("periodo");
  const [tipo, setTipo] = useState("ENTRADAS");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [destino, setDestino] = useState("");

  return (
    <form action={formAction} className="card">
      <h2>Enviar XML</h2>

      <div className="campo">
        <span>O que enviar</span>
        <label>
          <input
            type="radio"
            name="origem"
            value="periodo"
            checked={origem === "periodo"}
            onChange={() => setOrigem("periodo")}
          />{" "}
          Movimento do sistema (mesmo XML de Relatórios)
        </label>
        <label>
          <input
            type="radio"
            name="origem"
            value="arquivo"
            checked={origem === "arquivo"}
            onChange={() => setOrigem("arquivo")}
          />{" "}
          Arquivo XML do computador
        </label>
      </div>

      {origem === "periodo" ? (
        <div className="linha-form">
          <label>
            Tipo
            <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="ENTRADAS">Entradas</option>
              <option value="SAIDAS">Saídas</option>
            </select>
          </label>
          <label>
            De
            <input type="date" name="inicio" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
          </label>
          <label>
            Até
            <input type="date" name="fim" value={fim} onChange={(e) => setFim(e.target.value)} required />
          </label>
        </div>
      ) : (
        <div className="campo">
          <label htmlFor="arquivo-socket">Arquivo</label>
          <input type="file" id="arquivo-socket" name="arquivo" accept=".xml,application/xml,text/xml" required />
        </div>
      )}

      <div className="campo">
        <label htmlFor="destino">Destino</label>
        <input
          type="text"
          id="destino"
          name="destino"
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          placeholder="vazio = todos os conectados"
        />
        <small>Nome ou id de quem está conectado ao servidor (ex.: ana ou 3).</small>
      </div>

      <button type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Enviar pelo socket"}
      </button>

      {resultado.erro && <p className="erro">{resultado.erro}</p>}
      {resultado.ok && (
        <p className="sucesso">
          {resultado.nomeArquivo} enviado para {resultado.destinatarios?.join(", ")}.
        </p>
      )}
    </form>
  );
}
