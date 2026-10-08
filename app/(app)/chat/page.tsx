import { ultimasMensagens } from "@/lib/socket/chat";
import { SOCKET_NOME } from "@/lib/socket/config";
import { lerConectados } from "@/lib/socket/estado";
import { PainelChat } from "./painel-chat";

export default async function ChatPage() {
  const [mensagens, estado] = await Promise.all([ultimasMensagens(), lerConectados()]);

  return (
    <div>
      <h1>Chat</h1>
      <p className="subtitulo">Mensagens trocadas com os sistemas conectados ao servidor da turma.</p>
      <PainelChat iniciais={mensagens} estadoInicial={estado} nomeOuvinte={SOCKET_NOME} />
    </div>
  );
}
