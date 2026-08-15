/**
 * EOS CORE UTILS — IETF RFC 8785 JSON CANONICALIZATION SCHEME (JCS)
 * Formal, normative implementation of RFC 8785 for deterministic JSON serialization
 * and SHA-256 canonical hashing.
 */

import * as crypto from 'crypto';

export const CANONICALIZATION_VERSION = 'JCS-RFC-8785';

/**
 * Serializa um valor de acordo com a especificação IETF RFC 8785 (JSON Canonicalization Scheme).
 * 
 * Regras RFC 8785:
 * 1. Chaves de objeto ordenadas por código de unidade UTF-16.
 * 2. Sem caracteres de espaço em branco adicionais (compact serialization).
 * 3. Strings escapadas seguindo o padrão RFC 8785 (apenas controle 0x00-0x1F, \, ").
 * 4. Números formatados usando a representação padrão do ES6/RFC 8785 (sem expoentes redundantes).
 * 5. Valores NaN ou Infinity disparam TypeError.
 * 6. Propriedades de objeto com valor undefined ou função são omitidas.
 */
export function canonicalStringify(val: any): string {
  if (val === null) {
    return 'null';
  }

  const type = typeof val;

  if (type === 'boolean') {
    return val ? 'true' : 'false';
  }

  if (type === 'number') {
    if (!Number.isFinite(val)) {
      throw new TypeError('JCS_RFC_8785_ERROR: NaN e Infinity não são valores JSON válidos conforme RFC 8785.');
    }
    return JSON.stringify(val);
  }

  if (type === 'string') {
    return JSON.stringify(val);
  }

  if (type === 'symbol' || type === 'function' || type === 'undefined') {
    return undefined as any;
  }

  if (Array.isArray(val)) {
    const elements = val.map(item => {
      const itemType = typeof item;
      if (item === undefined || itemType === 'symbol' || itemType === 'function') {
        return 'null';
      }
      return canonicalStringify(item);
    });
    return '[' + elements.join(',') + ']';
  }

  if (type === 'object') {
    // Ordenação lexicográfica estrita por unidades de código UTF-16 conforme RFC 8785 Seção 3.2.3
    const keys = Object.keys(val).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const pairs: string[] = [];

    for (const key of keys) {
      const value = val[key];
      if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
        continue;
      }
      const serializedValue = canonicalStringify(value);
      if (serializedValue !== undefined) {
        pairs.push(`${JSON.stringify(key)}:${serializedValue}`);
      }
    }

    return '{' + pairs.join(',') + '}';
  }

  throw new TypeError(`JCS_RFC_8785_ERROR: Tipo '${type}' não pode ser serializado.`);
}

/**
 * Calcula o hash SHA-256 do JSON canônico JCS RFC 8785 de um valor semântico.
 */
export function canonicalHash(val: any): string {
  const canonicalJson = canonicalStringify(val);
  return crypto.createHash('sha256').update(canonicalJson).digest('hex');
}
