/**
 * EOS CONTINUOUS ARCHITECTURE - IN-MEMORY FACT REPOSITORY (v6.0.0)
 * Strict, Deterministic & In-Memory Fact Persistence Engine
 */

import { Fact, FACT_SCHEMA_VERSION_1_0 } from '../domain/types';
import { FactRepository, FactIntegrityError, FactOverwriteForbiddenError } from '../domain/fact-repository';
import { canonicalStringify } from '../utils/canonical-json';

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = (obj as any)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

export class InMemoryFactRepository implements FactRepository {
  private readonly storage = new Map<string, Fact>();
  private readonly semanticIndex = new Map<string, string[]>();
  private readonly inputIndex = new Map<string, string[]>();
  private readonly insertionOrder: string[] = [];

  public save(fact: Fact): void {
    // 1. Integridade: Validação de Invariantes INV-6.0
    this.validateFactIntegrity(fact);

    // 2. Regra de No-Overwrite (INV-6.0-05)
    if (this.storage.has(fact.fact_id)) {
      const existing = this.storage.get(fact.fact_id)!;
      if (canonicalStringify(existing) === canonicalStringify(fact)) {
        // Operação Idempotente
        return;
      }
      throw new FactOverwriteForbiddenError(fact.fact_id);
    }

    // 3. Superseding Governance (Fatos com mesmo semantic_hash e input_hash diferente)
    const existingFactIds = this.semanticIndex.get(fact.semantic_hash) || [];
    for (const fid of existingFactIds) {
      const prev = this.storage.get(fid);
      if (prev && prev.lifecycle_status === 'VALID') {
        const superseded: Fact = deepFreeze({
          ...prev,
          lifecycle_status: 'SUPERSEDED',
        });
        this.storage.set(fid, superseded);
      }
    }

    // 4. Congelamento em runtime para garantir imutabilidade absoluta
    const frozenFact = deepFreeze({ ...fact });

    // 5. Armazenamento e Indexação
    this.storage.set(frozenFact.fact_id, frozenFact);
    this.insertionOrder.push(frozenFact.fact_id);

    // Indexar por semantic_hash
    if (!this.semanticIndex.has(frozenFact.semantic_hash)) {
      this.semanticIndex.set(frozenFact.semantic_hash, []);
    }
    this.semanticIndex.get(frozenFact.semantic_hash)!.push(frozenFact.fact_id);

    // Indexar por input_hash
    if (!this.inputIndex.has(frozenFact.input_hash)) {
      this.inputIndex.set(frozenFact.input_hash, []);
    }
    this.inputIndex.get(frozenFact.input_hash)!.push(frozenFact.fact_id);
  }

  public getById(factId: string): Fact | null {
    const fact = this.storage.get(factId);
    return fact ? fact : null;
  }

  public findBySemanticHash(semanticHash: string): readonly Fact[] {
    const ids = this.semanticIndex.get(semanticHash) || [];
    return ids.map((id) => this.storage.get(id)!).filter(Boolean);
  }

  public findByInputHash(inputHash: string): readonly Fact[] {
    const ids = this.inputIndex.get(inputHash) || [];
    return ids.map((id) => this.storage.get(id)!).filter(Boolean);
  }

  public findHistoryBySemanticHash(semanticHash: string): readonly Fact[] {
    return this.findBySemanticHash(semanticHash);
  }

  public findValidBySemanticHash(semanticHash: string): Fact | null {
    const facts = this.findBySemanticHash(semanticHash);
    const valid = facts.filter((f) => f.lifecycle_status === 'VALID');
    if (valid.length === 0) return null;
    return valid[valid.length - 1];
  }

  public getAll(): readonly Fact[] {
    return this.insertionOrder.map((id) => this.storage.get(id)!);
  }

  private validateFactIntegrity(fact: Fact): void {
    if (!fact || typeof fact !== 'object') {
      throw new FactIntegrityError('INV-6.0-01: Fact must be a non-null object');
    }

    const mandatoryFields: (keyof Fact)[] = [
      'fact_id',
      'schema_version',
      'fact_type',
      'provider_id',
      'provider_version',
      'evidence_ids',
      'input_hash',
      'semantic_hash',
      'lifecycle_status',
      'payload',
    ];

    for (const field of mandatoryFields) {
      if (fact[field] === undefined || fact[field] === null) {
        throw new FactIntegrityError(`INV-6.0-01: Fact missing required field '${field}'`);
      }
    }

    // INV-6.0-02: evidence_ids não pode ser vazio
    if (!Array.isArray(fact.evidence_ids) || fact.evidence_ids.length === 0) {
      throw new FactIntegrityError('INV-6.0-02: Fact evidence_ids array must not be empty');
    }

    // INV-6.0-03: input_hash formato SHA-256
    if (typeof fact.input_hash !== 'string' || !/^[a-f0-9]{64}$/i.test(fact.input_hash)) {
      throw new FactIntegrityError('INV-6.0-03: Fact input_hash must be a valid 64-character SHA-256 hex string');
    }

    // INV-6.0-04: semantic_hash formato SHA-256
    if (typeof fact.semantic_hash !== 'string' || !/^[a-f0-9]{64}$/i.test(fact.semantic_hash)) {
      throw new FactIntegrityError('INV-6.0-04: Fact semantic_hash must be a valid 64-character SHA-256 hex string');
    }

    // INV-6.0-06: schema_version = FACT_SCHEMA_VERSION_1_0 ("1.0")
    if (fact.schema_version !== FACT_SCHEMA_VERSION_1_0) {
      throw new FactIntegrityError(`INV-6.0-06: Fact schema_version '${fact.schema_version}' is invalid. Expected '${FACT_SCHEMA_VERSION_1_0}'`);
    }
  }
}
