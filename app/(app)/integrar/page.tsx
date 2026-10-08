import { IntegrarForm } from "./integrar-form";

export default function IntegrarPage() {
  return (
    <div>
      <h1>Integrar arquivo</h1>
      <p className="subtitulo">
        Entrada e Saída em CSV ou XML. Clientes e Fornecedores apenas em CSV.{" "}
        <a href="/documentacao">Formatos aceitos</a>
      </p>

      <div className="grid-2">
        <div className="card">
          <h2>CSV</h2>
          <span className="card-label">Modelos:</span>
          <div className="linha-botoes">
            <a href="/integrar/modelo?tipo=ENTRADA" className="botao-download">
              Entrada
            </a>
            <a href="/integrar/modelo?tipo=SAIDA" className="botao-download">
              Saída
            </a>
            <a href="/integrar/modelo?tipo=CLIENTES" className="botao-download">
              Clientes
            </a>
            <a href="/integrar/modelo?tipo=FORNECEDORES" className="botao-download">
              Fornecedores
            </a>
          </div>
        </div>

        <div className="card">
          <h2>XML</h2>
          <span className="card-label">Modelos:</span>
          <div className="linha-botoes">
            <a href="/integrar/modelo?tipo=ENTRADA&formato=xml" className="botao-download">
              Entrada
            </a>
            <a href="/integrar/modelo?tipo=SAIDA&formato=xml" className="botao-download">
              Saída
            </a>
          </div>

          <span className="card-label">Schemas (XSD), para validar o arquivo antes do envio:</span>
          <div className="linha-botoes">
            <a href="/integrar/schema?tipo=ENTRADA" className="botao-download">
              XSD de Entrada
            </a>
            <a href="/integrar/schema?tipo=SAIDA" className="botao-download">
              XSD de Saída
            </a>
          </div>

          <a href="/documentacao#xml" className="link-button">
            Formato XML
          </a>
        </div>
      </div>

      <IntegrarForm />
    </div>
  );
}
