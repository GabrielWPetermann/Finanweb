// Simulador do setor de RH, para testar a folha de pagamento com o Finanweb de
// verdade enquanto o grupo do RH nao tem sistema.
//
// Conecta no servidor da turma com outro nome ("rh" por padrao, nunca o do
// ouvinte) e abre uma pagina em http://localhost:3100 para montar a folha,
// mandar para #finanweb e ver as respostas. A pagina nao fala direto com o
// servidor porque navegador nao abre conexao TCP: este processo faz a ponte.
//
//   npm run simulador:rh
//   SIMULADOR_NOME=rhteste npm run simulador:rh   (se "rh" estiver em uso)

import http from "node:http";
import net from "node:net";
import { validarContraXsd } from "@/lib/xml/validador";
import { SOCKET_HOST, SOCKET_NOME, SOCKET_PORTA } from "@/lib/socket/config";
import { LeitorProtocolo, linhaDeTexto, montarPedacos, normalizarDestino, type PedacoRecebido } from "@/lib/socket/protocolo";

const NOME = process.env.SIMULADOR_NOME || "rh";
const PORTA_HTTP = Number(process.env.SIMULADOR_PORTA || 3100);
const ESPERA_RECONEXAO_MS = 5000;
const ESPERA_FIM_ARQUIVO_MS = 3000;
const MAX_EVENTOS = 300;

if (NOME.toLowerCase() === SOCKET_NOME.toLowerCase()) {
  console.error(`O simulador não pode usar o nome do ouvinte ("${SOCKET_NOME}"). Use SIMULADOR_NOME=rh.`);
  process.exit(1);
}

interface Evento {
  n: number;
  hora: string;
  tipo: "texto" | "arquivo" | "enviado" | "sistema" | "erro";
  texto: string;
  arquivo?: { nome: string; conteudo: string };
}

const eventos: Evento[] = [];
let contador = 0;
let nomeAtual = "";

function registrar(tipo: Evento["tipo"], texto: string, arquivo?: Evento["arquivo"]) {
  const evento = { n: ++contador, hora: new Date().toLocaleTimeString("pt-BR"), tipo, texto, arquivo };
  eventos.push(evento);
  if (eventos.length > MAX_EVENTOS) eventos.shift();
  console.log(`${evento.hora}  ${texto}`);
}

// ===================== Conexao com o servidor da turma =====================

let socket: net.Socket | null = null;

function conectar() {
  const conexao = net.connect({ host: SOCKET_HOST, port: SOCKET_PORTA });
  socket = conexao;
  const emAndamento = new Map<string, { partes: Buffer[]; timer?: NodeJS.Timeout }>();

  function finalizar(chave: string, remetente: string, nome: string) {
    const arquivo = emAndamento.get(chave);
    if (!arquivo) return;
    clearTimeout(arquivo.timer);
    emAndamento.delete(chave);
    const conteudo = Buffer.concat(arquivo.partes).toString("utf8");
    registrar("arquivo", `arquivo "${nome}" de ${remetente} (${Buffer.byteLength(conteudo)} bytes)`, { nome, conteudo });
  }

  function aoReceberPedaco({ remetente, nomeArquivo, dados }: PedacoRecebido) {
    const chave = `${remetente}/${nomeArquivo}`;
    const arquivo = emAndamento.get(chave) ?? { partes: [] };
    emAndamento.set(chave, arquivo);
    if (dados.length === 0) return finalizar(chave, remetente, nomeArquivo);
    arquivo.partes.push(dados);
    clearTimeout(arquivo.timer);
    arquivo.timer = setTimeout(() => finalizar(chave, remetente, nomeArquivo), ESPERA_FIM_ARQUIVO_MS);
  }

  function aoReceberTexto(linha: string) {
    const confirmado = /^\[servidor\] agora você é (\S+)$/.exec(linha);
    if (confirmado) nomeAtual = confirmado[1];
    if (linha.includes("já está em uso")) {
      registrar("erro", `${linha} — feche o simulador e rode com SIMULADOR_NOME=rhteste`);
      return;
    }
    registrar("texto", linha);
  }

  const leitor = new LeitorProtocolo(aoReceberTexto, aoReceberPedaco);
  conexao.on("connect", () => {
    registrar("sistema", `conectado em ${SOCKET_HOST}:${SOCKET_PORTA}, pedindo o nome "${NOME}"`);
    conexao.write(`/nome ${NOME}\n`);
  });
  conexao.on("data", (dados) => leitor.alimentar(dados));
  conexao.on("error", (erro: NodeJS.ErrnoException) => registrar("erro", `erro de conexão: ${erro.code ?? erro.message}`));
  conexao.on("close", () => {
    nomeAtual = "";
    registrar("sistema", `desconectado, tentando de novo em ${ESPERA_RECONEXAO_MS / 1000}s`);
    setTimeout(conectar, ESPERA_RECONEXAO_MS);
  });
}

function conectado(): net.Socket | null {
  return socket && !socket.destroyed && nomeAtual ? socket : null;
}

// ===================== Pagina e API local =====================

async function lerCorpo(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const partes: Buffer[] = [];
  for await (const parte of req) partes.push(parte as Buffer);
  try {
    return JSON.parse(Buffer.concat(partes).toString("utf8") || "{}");
  } catch {
    return {};
  }
}

function json(res: http.ServerResponse, status: number, corpo: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(corpo));
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(PAGINA);
    return;
  }

  if (req.method === "GET" && url.pathname === "/estado") {
    const desde = Number(url.searchParams.get("desde") || 0);
    json(res, 200, { nome: nomeAtual, nomePedido: NOME, ouvinte: SOCKET_NOME, eventos: eventos.filter((e) => e.n > desde) });
    return;
  }

  // Valida no XSD da folha e manda como arquivo. forcar = manda mesmo
  // reprovado, para ver a recusa do Finanweb.
  if (req.method === "POST" && url.pathname === "/enviar") {
    const corpo = await lerCorpo(req);
    const xml = String(corpo.xml ?? "");
    const nomeArquivo = String(corpo.nomeArquivo || "folha.xml");
    const destino = normalizarDestino(String(corpo.destino ?? SOCKET_NOME));
    const errosXsd = await validarContraXsd(xml, "folha-v1.xsd");
    if (errosXsd.length > 0 && !corpo.forcar) {
      json(res, 200, { ok: false, errosXsd });
      return;
    }
    const conexao = conectado();
    if (!conexao) {
      json(res, 200, { ok: false, erro: "Simulador não está conectado ao servidor." });
      return;
    }
    for (const pedaco of montarPedacos(nomeArquivo, Buffer.from(xml, "utf8"), destino)) conexao.write(pedaco);
    registrar("enviado", `enviado "${nomeArquivo}" para ${destino ?? "todos"}${errosXsd.length > 0 ? " (fora do XSD, de propósito)" : ""}`, {
      nome: nomeArquivo,
      conteudo: xml,
    });
    json(res, 200, { ok: true, errosXsd });
    return;
  }

  if (req.method === "POST" && url.pathname === "/texto") {
    const corpo = await lerCorpo(req);
    const texto = linhaDeTexto(String(corpo.texto ?? ""));
    const destino = normalizarDestino(String(corpo.destino ?? ""));
    const conexao = conectado();
    if (!conexao || !texto) {
      json(res, 200, { ok: false, erro: !conexao ? "Simulador não está conectado ao servidor." : "Mensagem vazia." });
      return;
    }
    conexao.write(`${destino ? `#${destino} ` : ""}${texto}\n`);
    registrar("enviado", `mensagem para ${destino ?? "todos"}: ${texto}`);
    json(res, 200, { ok: true });
    return;
  }

  res.writeHead(404).end();
});

servidor.listen(PORTA_HTTP, "127.0.0.1", () => {
  registrar("sistema", `simulador do RH em http://localhost:${PORTA_HTTP} (Ctrl+C para sair)`);
  conectar();
});

// ===================== Pagina =====================

const PAGINA = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Simulador do RH</title>
<style>
  :root { --fundo:#f6f7f9; --card:#fff; --texto:#1d2330; --suave:#667085; --borda:#d9dde5; --azul:#2558d6; --verde:#137a3f; --vermelho:#b42318; --amarelo:#8a5a00; }
  * { box-sizing: border-box; }
  body { margin:0; font:14px/1.45 system-ui, sans-serif; background:var(--fundo); color:var(--texto); }
  header { padding:14px 20px; background:var(--card); border-bottom:1px solid var(--borda); display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
  h1 { font-size:18px; margin:0; }
  h2 { font-size:15px; margin:0 0 10px; }
  .status { padding:3px 10px; border-radius:999px; font-size:12px; background:#fdecea; color:var(--vermelho); }
  .status.on { background:#e6f4ea; color:var(--verde); }
  main { display:grid; grid-template-columns: minmax(0,1.1fr) minmax(0,1fr); gap:16px; padding:16px 20px; }
  @media (max-width: 1100px) { main { grid-template-columns: 1fr; } #log { height:420px; } }
  .card { background:var(--card); border:1px solid var(--borda); border-radius:10px; padding:14px; }
  .linha { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px; }
  label { display:flex; flex-direction:column; gap:3px; font-size:12px; color:var(--suave); }
  input, textarea, select { font:inherit; padding:6px 8px; border:1px solid var(--borda); border-radius:6px; color:var(--texto); background:#fff; }
  textarea { width:100%; font-family: ui-monospace, Consolas, monospace; font-size:12px; }
  table { width:100%; border-collapse:collapse; margin-bottom:8px; }
  th, td { text-align:left; padding:4px; border-bottom:1px solid var(--borda); font-size:13px; }
  td input { width:100%; }
  button { font:inherit; padding:7px 12px; border-radius:6px; border:1px solid var(--borda); background:#fff; cursor:pointer; }
  button.primario { background:var(--azul); border-color:var(--azul); color:#fff; }
  button.pequeno { padding:3px 8px; font-size:12px; }
  .cenarios { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; }
  .aviso { font-size:13px; margin:8px 0; }
  .aviso.erro { color:var(--vermelho); } .aviso.ok { color:var(--verde); }
  #log { height:calc(100vh - 210px); min-height:300px; overflow:auto; font-size:13px; }
  .ev { padding:6px 0; border-bottom:1px solid var(--borda); }
  .ev .hora { color:var(--suave); font-size:12px; margin-right:6px; }
  .ev.arquivo .t, .ev.enviado .t { color:var(--azul); } .ev.erro .t { color:var(--vermelho); } .ev.sistema .t { color:var(--suave); }
  .ev.resposta .t { color:var(--verde); font-weight:600; } .ev.recusa .t { color:var(--vermelho); font-weight:600; }
  details pre { white-space:pre-wrap; background:var(--fundo); padding:8px; border-radius:6px; font-size:12px; margin:6px 0 0; }
</style>
</head>
<body>
<header>
  <h1>Simulador do RH</h1>
  <span id="status" class="status">conectando...</span>
  <span style="color:var(--suave)">manda a folha para <b id="destinoTopo"></b> pelo servidor da turma</span>
</header>
<main>
  <section class="card">
    <h2>Folha de pagamento <small style="color:var(--suave);font-weight:normal">(folha-v1.xsd)</small></h2>
    <div class="cenarios">
      <button class="pequeno" onclick="cenario('valida')">Folha válida</button>
      <button class="pequeno" onclick="cenario('nova')">Nova referência</button>
      <button class="pequeno" onclick="cenario('liquido')">Líquido errado</button>
      <button class="pequeno" onclick="cenario('totalizador')">Totalizador errado</button>
      <button class="pequeno" onclick="cenario('cpf')">CPF fora do XSD</button>
    </div>
    <div class="linha">
      <label>Referência<input id="referencia"></label>
      <label>Competência<input id="competencia" placeholder="AAAA-MM" size="8"></label>
      <label>Data de pagamento<input id="dataPagamento" type="date"></label>
      <label>Origem<input id="origem" size="8"></label>
    </div>
    <div class="linha">
      <label>Empresa<input id="empresa"></label>
      <label>CNPJ<input id="cnpj" size="15"></label>
      <label>Usuário<input id="usuario" size="10"></label>
    </div>
    <table>
      <thead><tr><th>CPF</th><th>Matrícula</th><th>Nome</th><th>Bruto</th><th>Descontos</th><th>Líquido</th><th></th></tr></thead>
      <tbody id="funcionarios"></tbody>
    </table>
    <div class="linha">
      <button class="pequeno" onclick="adicionar()">+ Funcionário</button>
      <label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="autoLiquido" checked> líquido = bruto - descontos</label>
      <label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="autoTotal" checked> totalizador automático</label>
    </div>
    <div class="linha">
      <label>Destino<input id="destino" size="12"></label>
      <label>Nome do arquivo<input id="nomeArquivo" value="folha.xml"></label>
    </div>
    <label>XML (pode editar antes de mandar)<textarea id="xml" rows="16"></textarea></label>
    <div class="linha" style="margin-top:10px">
      <button onclick="gerar()">Gerar XML do formulário</button>
      <button class="primario" onclick="enviar(false)">Validar e enviar</button>
      <button onclick="enviar(true)">Enviar mesmo fora do XSD</button>
    </div>
    <div id="aviso" class="aviso"></div>
    <h2 style="margin-top:14px">Mensagem no chat</h2>
    <div class="linha">
      <input id="texto" placeholder="texto" style="flex:1">
      <input id="destinoTexto" placeholder="destino (vazio = todos)" size="14">
      <button onclick="mandarTexto()">Enviar</button>
    </div>
  </section>
  <section class="card">
    <h2>Conversa no servidor</h2>
    <div id="log"></div>
  </section>
</main>
<script>
const $ = (id) => document.getElementById(id);
let ouvinte = "finanweb", ultimo = 0, iniciado = false;

const FUNCIONARIOS = [
  ["98765432100", "F-0042", "Carlos Lima", "3500.00", "412.35"],
  ["52998224725", "F-0057", "Beatriz Conceição", "5200.00", "917.60"],
  ["11144477735", "F-0063", "Diego Ramos", "2800.00", "296.40"],
];

function hojeIso() { return new Date().toISOString().slice(0, 10); }
function competenciaAtual() { return hojeIso().slice(0, 7); }

function linhaFuncionario(f) {
  const tr = document.createElement("tr");
  tr.innerHTML = '<td><input size="11"></td><td><input size="6"></td><td><input></td><td><input size="8"></td><td><input size="8"></td><td><input size="8"></td><td><button class="pequeno">x</button></td>';
  const inputs = tr.querySelectorAll("input");
  f.forEach((v, i) => (inputs[i].value = v));
  inputs[3].oninput = inputs[4].oninput = () => { if ($("autoLiquido").checked) calcular(tr); gerar(); };
  inputs[0].oninput = inputs[1].oninput = inputs[2].oninput = inputs[5].oninput = gerar;
  tr.querySelector("button").onclick = () => { tr.remove(); gerar(); };
  calcular(tr);
  return tr;
}
function calcular(tr) {
  const i = tr.querySelectorAll("input");
  i[5].value = ((Math.round(Number(i[3].value) * 100) - Math.round(Number(i[4].value) * 100)) / 100).toFixed(2);
}
function adicionar() { $("funcionarios").appendChild(linhaFuncionario(["", "", "", "0.00", "0.00"])); gerar(); }

function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function gerar() {
  const linhas = [...$("funcionarios").querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("input")].map((i) => i.value.trim()));
  const total = linhas.reduce((s, l) => s + Math.round(Number(l[5]) * 100), 0) / 100;
  const qtd = $("autoTotal").checked ? linhas.length : (linhas.length + 1);
  const valorTotal = $("autoTotal").checked ? total.toFixed(2) : (total + 100).toFixed(2);
  const funcionarios = linhas.map((l) => '    <funcionario cpf="' + esc(l[0]) + '"' + (l[1] ? ' matricula="' + esc(l[1]) + '"' : "") + '>\\n' +
    '      <nome>' + esc(l[2]) + '</nome>\\n      <salarioBruto>' + esc(l[3]) + '</salarioBruto>\\n' +
    '      <descontos>' + esc(l[4]) + '</descontos>\\n      <salarioLiquido>' + esc(l[5]) + '</salarioLiquido>\\n    </funcionario>').join("\\n");
  $("xml").value = '<?xml version="1.0" encoding="UTF-8"?>\\n' +
    '<folha xmlns="urn:finanweb:folha:1.0" versao="1.0" referencia="' + esc($("referencia").value) + '">\\n' +
    '  <cabecalho>\\n    <empresa>' + esc($("empresa").value) + '</empresa>\\n    <cnpj>' + esc($("cnpj").value) + '</cnpj>\\n' +
    '    <origem>' + esc($("origem").value) + '</origem>\\n    <dataArquivo>' + hojeIso() + '</dataArquivo>\\n' +
    '    <usuario>' + esc($("usuario").value) + '</usuario>\\n  </cabecalho>\\n' +
    '  <competencia>' + esc($("competencia").value) + '</competencia>\\n  <dataPagamento>' + esc($("dataPagamento").value) + '</dataPagamento>\\n' +
    '  <funcionarios>\\n' + funcionarios + '\\n  </funcionarios>\\n' +
    '  <totalizador>\\n    <qtdFuncionarios>' + qtd + '</qtdFuncionarios>\\n    <valorLiquidoTotal>' + valorTotal + '</valorLiquidoTotal>\\n  </totalizador>\\n</folha>\\n';
}

function cenario(nome) {
  if (nome === "valida" || !iniciado) {
    iniciado = true;
    $("referencia").value = "FOLHA-" + competenciaAtual();
    $("competencia").value = competenciaAtual();
    const pag = new Date(); pag.setMonth(pag.getMonth() + 1, 5);
    $("dataPagamento").value = pag.toISOString().slice(0, 10);
    $("empresa").value = "Empresa LTDA"; $("cnpj").value = "12345678000199"; $("usuario").value = "simulador.rh";
    $("funcionarios").innerHTML = "";
    FUNCIONARIOS.forEach((f) => $("funcionarios").appendChild(linhaFuncionario(f)));
    $("autoLiquido").checked = true; $("autoTotal").checked = true;
  }
  if (nome === "nova") $("referencia").value = "FOLHA-" + competenciaAtual() + "-" + Date.now().toString(36).slice(-5).toUpperCase();
  if (nome === "liquido") {
    $("autoLiquido").checked = false;
    const i = $("funcionarios").querySelector("tr").querySelectorAll("input");
    i[5].value = (Number(i[5].value) + 10).toFixed(2);
  }
  if (nome === "totalizador") $("autoTotal").checked = false;
  if (nome === "cpf") $("funcionarios").querySelector("tr input").value = "1234567890";
  gerar();
  $("aviso").textContent = "";
}

async function enviar(forcar) {
  $("aviso").className = "aviso"; $("aviso").textContent = "enviando...";
  const r = await fetch("/enviar", { method: "POST", body: JSON.stringify({ xml: $("xml").value, nomeArquivo: $("nomeArquivo").value, destino: $("destino").value, forcar }) }).then((r) => r.json());
  if (r.errosXsd && r.errosXsd.length && !r.ok) {
    $("aviso").className = "aviso erro";
    $("aviso").textContent = "Não enviado, o XML não passa no XSD: " + r.errosXsd.join(" | ") + " (use \\"Enviar mesmo fora do XSD\\" para testar a recusa)";
  } else if (!r.ok) {
    $("aviso").className = "aviso erro"; $("aviso").textContent = r.erro;
  } else {
    $("aviso").className = "aviso ok"; $("aviso").textContent = "Enviado. A resposta do Finanweb aparece na conversa ao lado.";
  }
}

async function mandarTexto() {
  const r = await fetch("/texto", { method: "POST", body: JSON.stringify({ texto: $("texto").value, destino: $("destinoTexto").value }) }).then((r) => r.json());
  if (r.ok) $("texto").value = "";
  else alert(r.erro);
}

function classe(e) {
  if (e.tipo !== "texto") return e.tipo;
  if (e.texto.includes(ouvinte) && /recusado|ignorado|não pôde/.test(e.texto)) return "recusa";
  if (e.texto.includes(ouvinte) && /recebido|enviado/.test(e.texto)) return "resposta";
  return "texto";
}

async function atualizar() {
  try {
    const r = await fetch("/estado?desde=" + ultimo).then((r) => r.json());
    ouvinte = r.ouvinte;
    if (!$("destino").value) $("destino").value = r.ouvinte;
    $("destinoTopo").textContent = "#" + r.ouvinte;
    if (!$("origem").value) { $("origem").value = r.nomePedido.toLowerCase(); gerar(); }
    $("status").textContent = r.nome ? "conectado como " + r.nome : "desconectado";
    $("status").className = "status" + (r.nome ? " on" : "");
    const log = $("log"), embaixo = log.scrollTop + log.clientHeight >= log.scrollHeight - 20;
    for (const e of r.eventos) {
      ultimo = e.n;
      const div = document.createElement("div");
      div.className = "ev " + classe(e);
      div.innerHTML = '<span class="hora">' + e.hora + '</span><span class="t"></span>';
      div.querySelector(".t").textContent = e.texto;
      if (e.arquivo) {
        const d = document.createElement("details");
        d.innerHTML = "<summary>ver " + esc(e.arquivo.nome) + "</summary><pre></pre>";
        d.querySelector("pre").textContent = e.arquivo.conteudo;
        div.appendChild(d);
      }
      log.appendChild(div);
    }
    if (embaixo) log.scrollTop = log.scrollHeight;
  } catch {
    $("status").textContent = "simulador parado"; $("status").className = "status";
  }
}

cenario("valida");
atualizar();
setInterval(atualizar, 1000);
</script>
</body>
</html>`;
