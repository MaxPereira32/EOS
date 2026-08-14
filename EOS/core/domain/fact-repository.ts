/**
 * EOS CONTINUOUS ARCHITECTURE - FACT REPOSITORY CONTRACT (v6.0.0)
 * Strict Domain Interface & Integrity Errors for Fact Persistence
 */

import { Fact } from './types';

export class FactIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FactIntegrityError';
    Object.setPrototypeOf(this, FactIntegrityError.prototype);
  }
}

export class FactOverwriteForbiddenError extends FactIntegrityError {
  constructor(factId: string) {
    super(`Overwrite prohibited: Fact ID '${factId}' already exists with different content.`);
    this.name = 'FactOverwriteForbiddenError';
    Object.setPrototypeOf(this, FactOverwriteForbiddenError.prototype);
  }
}

export class FactCorruptedError extends FactIntegrityError {
  constructor(message: string) {
    super(`Fact Storage Corruption Detected: ${message}`);
    this.name = 'FactCorruptedError';
    Object.setPrototypeOf(this, FactCorruptedError.prototype);
  }
}

export class FactStateTransitionForbiddenError extends FactIntegrityError {
  constructor(factId: string, currentStatus: string, targetStatus: string) {
    super(`State Transition Prohibited for Fact '${factId}': Cannot transition from '${currentStatus}' to '${targetStatus}'.`);
    this.name = 'FactStateTransitionForbiddenError';
    Object.setPrototypeOf(this, FactStateTransitionForbiddenError.prototype);
  }
}

export interface FactRepository {
  /**
   * Persiste um Fact imutável no repositório.
   * Se um Fact com o mesmo fact_id já existir com conteúdo idêntico, a operação é idempotente.
   * Se um Fact com o mesmo fact_id já existir com conteúdo diferente, lança FactOverwriteForbiddenError.
   * Se o Fact violar qualquer invariante de integridade (INV-6.0), lança FactIntegrityError.
   */
  save(fact: Fact): void;

  /**
   * Recupera um Fact único pelo seu fact_id.
   * Retorna null se não encontrado.
   */
  getById(factId: string): Fact | null;

  /**
   * Recupera todos os Facts associados a uma identidade semântica (semantic_hash).
   * Retorna histórico contendo versões VALID e SUPERSEDED.
   */
  findBySemanticHash(semanticHash: string): readonly Fact[];

  /**
   * Recupera Facts que possuem uma proveniência física idêntica (input_hash).
   */
  findByInputHash(inputHash: string): readonly Fact[];

  /**
   * Recupera o histórico cronológico de evoluções de um semantic_hash.
   */
  findHistoryBySemanticHash(semanticHash: string): readonly Fact[];

  /**
   * Recupera a versão ativa (VALID) atual de uma afirmação semântica.
   * Retorna null se não houver versão VALID ativa.
   */
  findValidBySemanticHash(semanticHash: string): Fact | null;

  /**
   * Retorna todos os Facts armazenados no repositório.
   */
  getAll(): readonly Fact[];
}
