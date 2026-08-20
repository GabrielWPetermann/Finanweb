export default function RelatoriosPage() {
  return (
    <div>
      <h1>Relatórios</h1>
      <p className="subtitulo">Exporta um CSV com os dados do período selecionado.</p>

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
          De
          <input type="date" name="inicio" required />
        </label>
        <label>
          Até
          <input type="date" name="fim" required />
        </label>
        <button type="submit">Exportar CSV</button>
      </form>
    </div>
  );
}
