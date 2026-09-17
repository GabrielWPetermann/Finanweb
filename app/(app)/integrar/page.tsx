import { IntegrarForm } from "./integrar-form";

export default function IntegrarPage() {
  return (
    <div>
      <h1>Integrar arquivo</h1>
      <p className="subtitulo">
        Envie um arquivo de Entrada, Saída, ou de cadastro de Clientes/Fornecedores. Entrada e Saída
        aceitam CSV ou XML; o cadastro aceita apenas CSV.
      </p>

      <div className="card">
        <span className="card-label">Não sabe o formato? Baixe um modelo já pronto e preencha em cima dele:</span>
        <div className="linha-form">
          <a href="/integrar/modelo?tipo=ENTRADA" className="link-button">
            Entrada (CSV)
          </a>
          <a href="/integrar/modelo?tipo=ENTRADA&formato=xml" className="link-button">
            Entrada (XML)
          </a>
          <a href="/integrar/modelo?tipo=SAIDA" className="link-button">
            Saída (CSV)
          </a>
          <a href="/integrar/modelo?tipo=SAIDA&formato=xml" className="link-button">
            Saída (XML)
          </a>
          <a href="/integrar/modelo?tipo=CLIENTES" className="link-button">
            Clientes (CSV)
          </a>
          <a href="/integrar/modelo?tipo=FORNECEDORES" className="link-button">
            Fornecedores (CSV)
          </a>
        </div>
      </div>

      <div className="card">
        <span className="card-label">
          Vai gerar o XML por um sistema próprio? Baixe o schema (XSD) e valide o arquivo antes de
          enviar — o sistema recusa qualquer XML que não siga essas regras:
        </span>
        <div className="linha-form">
          <a href="/integrar/schema?tipo=ENTRADA" className="link-button">
            XSD de Entrada
          </a>
          <a href="/integrar/schema?tipo=SAIDA" className="link-button">
            XSD de Saída
          </a>
          <a href="/documentacao#xml" className="link-button">
            Como montar o XML
          </a>
        </div>
      </div>

      <IntegrarForm />
    </div>
  );
}
