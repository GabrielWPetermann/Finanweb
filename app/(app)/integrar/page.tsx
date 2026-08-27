import { IntegrarForm } from "./integrar-form";

export default function IntegrarPage() {
  return (
    <div>
      <h1>Integrar arquivo</h1>
      <p className="subtitulo">
        Envie um arquivo CSV de Entrada, Saída, ou de cadastro de Clientes/Fornecedores.
      </p>

      <div className="card">
        <span className="card-label">Não sabe o formato? Baixe um modelo já pronto e preencha em cima dele:</span>
        <div className="linha-form">
          <a href="/integrar/modelo?tipo=ENTRADA" className="link-button">
            Modelo de Entrada
          </a>
          <a href="/integrar/modelo?tipo=SAIDA" className="link-button">
            Modelo de Saída
          </a>
          <a href="/integrar/modelo?tipo=CLIENTES" className="link-button">
            Modelo de Clientes
          </a>
          <a href="/integrar/modelo?tipo=FORNECEDORES" className="link-button">
            Modelo de Fornecedores
          </a>
        </div>
      </div>

      <IntegrarForm />
    </div>
  );
}
