import * as crypto from 'crypto';

/**
 * Converte qualquer valor JavaScript em sua representação JSON canônica determinística,
 * onde as chaves de objetos são ordenadas lexicograficamente de forma recursiva.
 */
export function canonicalStringify(val: any): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(val).sort();
  const pairs = keys
    .filter(k => val[k] !== undefined)
    .map(k => `${JSON.stringify(k)}:${canonicalStringify(val[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Calcula o hash SHA-256 da representação JSON canônica de um valor semântico.
 */
export function canonicalHash(val: any): string {
  const canonicalJson = canonicalStringify(val);
  return crypto.createHash('sha256').update(canonicalJson).digest('hex');
}
