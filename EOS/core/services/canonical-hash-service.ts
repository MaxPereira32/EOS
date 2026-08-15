/**
 * EOS CORE SERVICES — CANONICAL HASH SERVICE
 * Centralized JCS RFC 8785 canonical JSON hashing service for ActionPlans, AuditArtifacts and future domain contracts.
 */

import { canonicalHash, canonicalStringify } from '../utils/canonical-json';

export class CanonicalHashService {
  /**
   * Serializa um objeto em JSON canônico determinístico JCS RFC 8785.
   */
  public static stringify(payload: any): string {
    return canonicalStringify(payload);
  }

  /**
   * Calcula o hash SHA-256 do JSON canônico JCS RFC 8785 de um objeto.
   */
  public static hash(payload: any): string {
    return canonicalHash(payload);
  }
}
