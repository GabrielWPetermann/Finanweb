export default function RelatoriosPage() {
  return (
    <div>
      <h1>Relatórios</h1>
      <p className="subtitulo">Exporta os dados do período selecionado em CSV ou XML.</p>

      <form method="get" action="/relatorios/export" className="card">
        <label>
          Tipo
          <select name="tipo" defaultValue="BALANCO">
            <option value="ENTRADAS">Entradas</option>
            <option value="SAIDAS">Saídas</option>
            <option value="BALANCO">Balanço</option>
          </select>
        </label>
        <label>
          Formato
          <select name="formato" defaultValue="csv">
            <option value="csv">CSV</option>
            <option value="xml">XML (validado por XSD)</option>
          </select>
        </label>
        <label>
          De
          <input type="date" name="inicio" required />
        </label>
        <label>
          Até
          <input type="date" name="fim" required />
        </label>
        <button type="submit">Exportar</button>
      </form>

      <p className="subtitulo">
        O XML sai no mesmo formato aceito pela tela de integrar, com o movimento completo — dá para
        exportar aqui e reimportar sem conversão. Balanço só existe em CSV: é um agregado de três
        linhas, sem contrato de intercâmbio.
      </p>
    </div>
  );
}
