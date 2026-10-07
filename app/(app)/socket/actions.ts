"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/auth";
import { gerarMovimentoXml } from "@/lib/exportacao-xml";
import { importarMovimento, type ResultadoImportacao } from "@/lib/importacao";
import { MAX_BYTES_XML } from "@/lib/xml/validador";
import { enviarArquivo, listarConectados } from "@/lib/socket/cliente";
import { descartarRecebido, lerRecebido } from "@/lib/socket/caixa-entrada";

export interface ResultadoEnvio {
  ok: boolean;
  erro?: string;
  nomeArquivo?: string;
  destinatarios?: string[];
}

export interface ResultadoConectados {
  ok: boolean;
  erro?: string;
  conectados?: string[];
}

const SESSAO_EXPIRADA = "Sessão expirada. Faça login novamente.";

export async function enviarSocketAction(
  _estadoAnterior: ResultadoEnvio,
  formData: FormData
): Promise<ResultadoEnvio> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, erro: SESSAO_EXPIRADA };

  // "#ana", "ana" e "3" valem; vazio manda para todos os conectados.
  const destino = String(formData.get("destino") ?? "").trim().replace(/^#/, "") || null;
  if (destino && /\s/.test(destino)) {
    return { ok: false, erro: "O destino é um nome ou id do servidor, sem espaços." };
  }

  let nomeArquivo: string;
  let conteudo: Buffer;

  if (formData.get("origem") === "arquivo") {
    const arquivo = formData.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) {
      return { ok: false, erro: "Selecione um arquivo XML." };
    }
    if (!arquivo.name.toLowerCase().endsWith(".xml")) {
      return { ok: false, erro: "O arquivo precisa ter extensão .xml." };
    }
    if (arquivo.size > MAX_BYTES_XML) {
      return { ok: false, erro: "Arquivo maior que 10 MB, o limite de XML do Finanweb." };
    }
    nomeArquivo = arquivo.name;
    conteudo = Buffer.from(await arquivo.arrayBuffer());
  } else {
    const tipo = String(formData.get("tipo") ?? "");
    const inicio = String(formData.get("inicio") ?? "");
    const fim = String(formData.get("fim") ?? "");
    if (tipo !== "ENTRADAS" && tipo !== "SAIDAS") {
      return { ok: false, erro: "Escolha Entradas ou Saídas." };
    }
    if (!inicio || !fim) {
      return { ok: false, erro: "Informe o período (de e até)." };
    }

    const resultado = await gerarMovimentoXml(
      tipo,
      new Date(inicio),
      new Date(`${fim}T23:59:59.999Z`),
      usuario.username
    );
    if (!resultado.ok) return { ok: false, erro: resultado.erro };

    // O periodo no nome ajuda quem recebe a saber o que chegou.
    nomeArquivo = resultado.nomeArquivo.replace(".xml", `-${inicio}-a-${fim}.xml`);
    conteudo = Buffer.from(resultado.xml, "utf8");
  }

  const envio = await enviarArquivo(nomeArquivo, conteudo, destino);
  if (!envio.ok) return { ok: false, erro: envio.erro };
  return { ok: true, nomeArquivo, destinatarios: envio.destinatarios };
}

export async function conectadosAction(): Promise<ResultadoConectados> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, erro: SESSAO_EXPIRADA };

  const resultado = await listarConectados();
  if (!resultado.ok) return { ok: false, erro: resultado.erro };
  return { ok: true, conectados: resultado.conectados };
}

export async function importarRecebidoAction(
  _estadoAnterior: ResultadoImportacao,
  formData: FormData
): Promise<ResultadoImportacao> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, erro: SESSAO_EXPIRADA };

  const pathname = String(formData.get("pathname") ?? "");
  const recebido = await lerRecebido(pathname);
  if (!recebido) {
    return { ok: false, erro: "Arquivo não encontrado na caixa de entrada (já importado ou descartado?)." };
  }

  // Mesmo caminho da tela de integrar: XSD, parser, Blob e banco. Quem
  // aprova aparece no Historico como autor da importacao.
  const resultado = await importarMovimento(
    recebido.arquivo.tipo,
    recebido.arquivo.nomeArquivo,
    recebido.conteudo,
    usuario.id
  );

  // Importado sai da caixa; com erro fica, para poder ser descartado.
  if (resultado.ok) {
    await descartarRecebido(pathname);
    revalidatePath("/socket");
  }
  return resultado;
}

export async function descartarRecebidoAction(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return;

  await descartarRecebido(String(formData.get("pathname") ?? ""));
  revalidatePath("/socket");
}
