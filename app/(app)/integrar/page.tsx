import { IntegrarForm } from "./integrar-form";

export default function IntegrarPage() {
  return (
    <div>
      <h1>Integrar arquivo</h1>
      <p className="subtitulo">Envie um arquivo CSV de Entrada ou Saída no formato padrão.</p>
      <IntegrarForm />
    </div>
  );
}
