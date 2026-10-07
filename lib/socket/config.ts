// Endereco do servidor de chat da disciplina e o nome com que o Finanweb
// aparece nele. Sem as variaveis, usa o servidor do professor.
export const SOCKET_HOST = process.env.SOCKET_HOST || "electronicsystems.com.br";
export const SOCKET_PORTA = Number(process.env.SOCKET_PORTA || 5000);

// Nome do ouvinte (npm run socket), que e para onde os outros sistemas
// mandam arquivos. O envio feito pela tela usa "<nome>-envio", porque o nome
// do ouvinte ja esta em uso enquanto ele esta conectado.
export const SOCKET_NOME = process.env.SOCKET_NOME || "finanweb";
export const SOCKET_NOME_ENVIO = `${SOCKET_NOME}-envio`;
