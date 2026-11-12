import { revalidatePath } from "next/cache";

/**
 * Telas que mostram o que uma importacao lanca ou atualiza. Sem isso, quem
 * ja tinha aberto Pagamentos ou Recebimentos continuava vendo a lista de
 * antes da aprovacao. So para server actions: fora do Next nao ha cache.
 */
export function revalidarTelasDeLancamento() {
  for (const caminho of ["/pagamentos", "/recebimentos", "/historico", "/relatorios", "/"]) revalidatePath(caminho);
}
