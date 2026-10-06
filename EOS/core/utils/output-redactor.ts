/**
 * Mantém hashes de saída auditáveis sem copiar credenciais para relatórios.
 * É deliberadamente conservador: em caso de dúvida, mascara o valor inteiro.
 */
export function redactOutput(value: string): string {
  return value
    .replace(/\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/([^\s:@/]+):([^\s@/]+)@/gi, '$1://[REDACTED]:[REDACTED]@')
    .replace(/\b(authorization|proxy-authorization)\s*:\s*[^\r\n]+/gi, '$1: [REDACTED]')
    .replace(/\b(bearer)\s+[A-Za-z0-9._~+\/-]+=*/gi, '$1 [REDACTED]')
    .replace(/\b(password|passwd|secret|token|api[_-]?key|database[_-]?url)\b\s*([=:])\s*[^\s'"`]+/gi, '$1$2[REDACTED]');
}
