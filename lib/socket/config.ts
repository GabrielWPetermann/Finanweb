// Endereco do servidor de chat da disciplina e o nome com que o Finanweb
// aparece nele. Sem as variaveis, usa o servidor do professor.
export const SOCKET_HOST = process.env.SOCKET_HOST || "electronicsystems.com.br";
export const SOCKET_PORTA = Number(process.env.SOCKET_PORTA || 5000);

// Nome do ouvinte (npm run socket) no servidor. Tudo o que o Finanweb manda
// ou recebe passa pela conexao dele, entao e o unico nome que a turma ve.
export const SOCKET_NOME = process.env.SOCKET_NOME || "finanweb";
