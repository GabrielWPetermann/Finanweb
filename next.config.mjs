/** @type {import('next').NextConfig} */
const nextConfig = {
  // xmllint-wasm carrega o .wasm e um worker por caminho de arquivo em runtime.
  // Empacotado pelo webpack, esses caminhos quebram ("Cannot find module
  // xmllint-node.js"), entao ele fica externo e e resolvido do node_modules.
  serverExternalPackages: ["xmllint-wasm"],

  // Arquivos lidos por caminho em runtime, que o tracing do Next nao enxerga
  // (ele so segue require/import). Sem isso eles nao entram no bundle de
  // deploy (serverless) e a validacao falha so em producao:
  //   - os .xsd, lidos pelo lib/xml/validador.ts;
  //   - o xmllint.wasm, que o proprio xmllint-wasm carrega de __dirname.
  outputFileTracingIncludes: {
    "/**": ["./lib/xml/schemas/**/*.xsd", "./node_modules/xmllint-wasm/*.wasm"],
  },
};

export default nextConfig;
