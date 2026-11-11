// Recebimento de um movimento (venda, compra, folha ou o formato interno v1),
// seja qual for o caminho por onde ele chegou: socket, REST ou SOAP.
//
// Os tres passam pelas mesmas conferencias antes de ir para a caixa de
// entrada de /socket, onde alguem aprova a importacao: namespace conhecido,
// tamanho, XSD. A gravacao no banco so acontece na aprovacao (lib/importacao).

import { detectarMovimento, guardarRecebido, type TipoMovimento } from "@/lib/socket/caixa-entrada";
import { MAX_BYTES_XML, validarContraXsd, type SchemaXml } from "@/lib/xml/validador";

/** Data e hora para o nome do arquivo na caixa de entrada: 20261111T153012. */
export function carimbo(): string {
  return new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
}

export type ResultadoRecebimento =
  | { ok: true; tipo: TipoMovimento; schema: SchemaXml }
  | {
      ok: false;
      // NAO_E_MOVIMENTO: namespace que nao e de movimento aceito aqui.
      // INVALIDO: grande demais ou reprovado no XSD. FALHA: erro do nosso lado.
      motivo: "NAO_E_MOVIMENTO" | "INVALIDO" | "FALHA";
      erro: string;
    };

// Os outros setores so mandam os contratos de /contratos. O v1 e o formato
// interno do Finanweb, aceito so pelo socket (reimportar o que foi exportado).
const SCHEMAS_DOS_SETORES = new Set<SchemaXml>(["entrada-v2.xsd", "saida-v2.xsd", "folha-v1.xsd"]);

export async function receberMovimento(
  conteudo: string,
  { remetente, nomeArquivo, aceitaV1 = false }: { remetente: string; nomeArquivo: string; aceitaV1?: boolean }
): Promise<ResultadoRecebimento> {
  if (Buffer.byteLength(conteudo, "utf8") > MAX_BYTES_XML) {
    return { ok: false, motivo: "INVALIDO", erro: "o limite é de 10 MB por XML." };
  }

  const formato = detectarMovimento(conteudo);
  if (!formato || (!aceitaV1 && !SCHEMAS_DOS_SETORES.has(formato.schema))) {
    return {
      ok: false,
      motivo: "NAO_E_MOVIMENTO",
      erro: "não é um movimento do Finanweb. Os formatos aceitos estão na página /contratos do Finanweb.",
    };
  }

  // Validar ja na chegada da a resposta na hora para quem mandou, em vez de
  // o erro so aparecer quando alguem tentar aprovar.
  const erros = await validarContraXsd(conteudo, formato.schema);
  if (erros.length > 0) {
    return { ok: false, motivo: "INVALIDO", erro: `não passou no XSD: ${erros.slice(0, 3).join(" ")}` };
  }

  try {
    await guardarRecebido({ remetente, nomeArquivo, tipo: formato.tipo }, conteudo);
  } catch (erro) {
    console.error(erro);
    return { ok: false, motivo: "FALHA", erro: "não pôde ser guardado no Finanweb. Tente de novo." };
  }
  return { ok: true, tipo: formato.tipo, schema: formato.schema };
}
