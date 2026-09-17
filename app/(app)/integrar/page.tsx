import { IntegrarForm } from "./integrar-form";

export default function IntegrarPage() {
  return (
    <div>
      <h1>Integrar arquivo</h1>
      <p className="subtitulo">
        Entrada e Saída aceitam CSV ou XML — os dois carregam a mesma informação, escolha o que for mais
        fácil de gerar do seu lado. Cadastro de Clientes e Fornecedores só em CSV.
      </p>

      <div className="grid-2">
        <div className="card">
          <h2>CSV</h2>
          <span className="card-label">
            O layout de sempre, em linhas <code>0</code> (cabeçalho), <code>1</code> (registro) e{" "}
            <code>9</code> (totalizador). Baixe um modelo e preencha em cima dele:
          </span>
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
          <span className="card-label">
            Mesmo conteúdo, com um schema formal por trás. O sistema recusa qualquer XML fora do schema,
            apontando a regra violada e a linha:
          </span>
          <div className="linha-botoes">
            <a href="/integrar/modelo?tipo=ENTRADA&formato=xml" className="botao-download">
              Entrada
            </a>
            <a href="/integrar/modelo?tipo=SAIDA&formato=xml" className="botao-download">
              Saída
            </a>
          </div>

          <span className="card-label">
            Vai gerar o XML por um sistema próprio? Baixe o schema (XSD) e valide o arquivo antes de enviar:
          </span>
          <div className="linha-botoes">
            <a href="/integrar/schema?tipo=ENTRADA" className="botao-download">
              XSD de Entrada
            </a>
            <a href="/integrar/schema?tipo=SAIDA" className="botao-download">
              XSD de Saída
            </a>
          </div>

          <a href="/documentacao#xml" className="link-button">
            Como montar o XML
          </a>
        </div>
      </div>

      <IntegrarForm />
    </div>
  );
}
