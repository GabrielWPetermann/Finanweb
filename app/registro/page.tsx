// Pagina publica do registry da turma (fora do login, ver o matcher do
// middleware): o "find" para quem prefere olhar a chamar /api/registro, e o
// passo a passo de publish-find-bind para os outros setores.

import type { Metadata } from "next";
import { headers } from "next/headers";
import { buscarServicos, PROTOCOLOS, type Servico } from "@/lib/registro";

export const metadata: Metadata = {
  title: "Registry de serviços · Finanweb",
};

interface Props {
  searchParams: Promise<{ setor?: string; nome?: string; protocolo?: string }>;
}

export default async function RegistroPage({ searchParams }: Props) {
  const filtros = await searchParams;
  const host = (await headers()).get("host") ?? "finanwebsistema.vercel.app";
  const base = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;

  let servicos: Servico[] = [];
  let erro: string | null = null;
  try {
    servicos = await buscarServicos(filtros, base);
  } catch (e) {
    console.error(e);
    erro = "Não foi possível carregar o registry agora.";
  }
  const setores = [...new Set(servicos.map((s) => s.setor))];

  return (
    <main className="content">
      <h1>Registry de serviços</h1>
      <p className="subtitulo">
        Onde cada setor da turma publica os serviços que oferece e onde os outros encontram o endereço e o
        contrato para chamar. Esta página não precisa de login. Contratos do Financeiro:{" "}
        <a href="/contratos">Contratos de integração</a>.
      </p>

      <form method="get" className="filtros">
        <label>
          Setor
          <input type="text" name="setor" defaultValue={filtros.setor ?? ""} placeholder="vendas" />
        </label>
        <label>
          Serviço
          <input type="text" name="nome" defaultValue={filtros.nome ?? ""} placeholder="inadimplência" />
        </label>
        <label>
          Protocolo
          <select name="protocolo" defaultValue={filtros.protocolo ?? ""}>
            <option value="">Todos</option>
            {PROTOCOLOS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Buscar</button>
        <a href="/registro" className="link-button">
          Limpar
        </a>
      </form>

      {erro && <p className="erro">{erro}</p>}
      {!erro && servicos.length === 0 && <p>Nenhum serviço encontrado.</p>}
      {setores.map((setor) => (
        <section key={setor}>
          <h2>{setor}</h2>
          <table>
            <thead>
              <tr>
                <th>Serviço</th>
                <th>Versão</th>
                <th>Protocolo</th>
                <th>Endpoint</th>
                <th>Operação</th>
                <th>Contrato</th>
                <th>Para</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {servicos
                .filter((s) => s.setor === setor)
                .map((s) => (
                  <tr key={`${s.nome}-${s.versao}-${s.protocolo}`}>
                    <td title={s.descricao}>{s.nome}</td>
                    <td>{s.versao}</td>
                    <td>{s.protocolo}</td>
                    <td>
                      <code>{s.endpoint}</code>
                    </td>
                    <td>{s.operacao && <code>{s.operacao}</code>}</td>
                    <td>{s.contrato && <a href={s.contrato}>abrir</a>}</td>
                    <td>{s.consumidor}</td>
                    <td>{s.situacao}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ))}

      <h2>Como usar: publish, find, bind</h2>
      <ol>
        <li>
          <strong>Chave</strong>: peça ao Financeiro a chave do seu setor (mensagem privada para{" "}
          <code>#finanweb</code>). Ela vale para publicar e remover só os serviços do seu setor.
        </li>
        <li>
          <strong>Publish</strong>: publique cada serviço que vocês oferecem, um por protocolo e versão. Publicar
          de novo com o mesmo nome, versão e protocolo atualiza o registro.
          <pre>{`curl -X POST ${base}/api/registro \\
  -H "Authorization: Bearer <chave do setor>" \\
  -H "Content-Type: application/json" \\
  -d '{ "nome": "Disponibilidade de produto", "versao": "1.0", "protocolo": "REST",
        "endpoint": "https://estoque.exemplo.com/api/disponibilidade", "operacao": "GET",
        "contrato": "https://estoque.exemplo.com/docs", "consumidor": "vendas",
        "descricao": "Quantidade disponível de um produto." }'`}</pre>
        </li>
        <li>
          <strong>Find</strong>: busque pelo setor, nome, protocolo ou consumidor:
          <pre>{`curl "${base}/api/registro?setor=financeiro&protocolo=REST"
curl "${base}/api/registro?consumidor=vendas"`}</pre>
        </li>
        <li>
          <strong>Bind</strong>: com o <code>endpoint</code>, a <code>operacao</code> e o <code>contrato</code> do
          resultado, chame o serviço direto. O registry só diz onde está e como chamar; a chamada não passa por ele.
        </li>
        <li>
          <strong>Versões</strong>: versão nova é outro registro. Mantenham a anterior como{" "}
          <code>DEPRECIADO</code> enquanto houver quem use, e depois <code>DESATIVADO</code> (some da busca, mas
          continua com <code>?situacao=DESATIVADO</code>). Para remover:{" "}
          <code>DELETE /api/registro?nome=&amp;versao=&amp;protocolo=</code>, com a chave.
        </li>
      </ol>
      <p className="subtitulo">
        Campos: <code>nome</code>, <code>versao</code> (&quot;1&quot;, &quot;1.0&quot; ou &quot;1.0.2&quot;),{" "}
        <code>protocolo</code> (SOCKET, REST ou SOAP), <code>endpoint</code> (URL; no SOCKET, o destino no
        servidor da turma), e os opcionais <code>operacao</code> (método HTTP ou operação SOAP),{" "}
        <code>contrato</code> (URL), <code>consumidor</code>, <code>descricao</code> e <code>situacao</code>{" "}
        (ATIVO, DEPRECIADO ou DESATIVADO). Os serviços do Financeiro saem do catálogo de contratos e são
        atualizados a cada deploy.
      </p>
    </main>
  );
}
