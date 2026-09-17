/** @type {import('next').NextConfig} */
const nextConfig = {
  // xmllint-wasm carrega o .wasm e um worker por caminho de arquivo em runtime.
  // Empacotado pelo webpack, esses caminhos quebram ("Cannot find module
  // xmllint-node.js"), entao ele fica externo e e resolvido do node_modules.
  serverExternalPackages: ["xmllint-wasm"],

  // Os .xsd sao lidos do disco em runtime. Sem isso eles nao entram no bundle
  // de deploy (serverless) e a validacao falha so em producao.
  outputFileTracingIncludes: {
    "/**": ["./lib/xml/schemas/**/*.xsd"],
  },
};

export default nextConfig;
