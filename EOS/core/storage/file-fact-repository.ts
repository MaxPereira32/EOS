/**
 * EOS CONTINUOUS ARCHITECTURE - DURABLE FILE FACT REPOSITORY (v6.1.1)
 * Atomic, Crash-Resilient, Multi-Process & Durable File-Backed Fact Persistence Engine
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Fact, FACT_SCHEMA_VERSION_1_0 } from '../domain/types';
import {
  FactRepository,
  FactIntegrityError,
  FactOverwriteForbiddenError,
  FactCorruptedError,
  FactStateTransitionForbiddenError,
} from '../domain/fact-repository';
import { canonicalStringify, canonicalHash } from '../utils/canonical-json';

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

interface PersistedState {
  readonly version: string;
  readonly facts: Record<string, Fact>;
  readonly semanticIndex: Record<string, string[]>;
  readonly inputIndex: Record<string, string[]>;
  readonly insertionOrder: string[];
}

export class FileFactRepository implements FactRepository {
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath
      ? path.resolve(filePath)
      : path.resolve(process.cwd(), '.eos', 'facts_store.json');
    this.ensureDirectory();
    // Immediate validation on instantiation (Fail-fast on corrupted storage)
    this.loadState();
  }

  private get lockPath(): string {
    return `${this.filePath}.lock`;
  }

  private withLock<T>(fn: (token: string) => T): T {
    const maxRetries = 250;
    const retryDelayMs = 20;
    const staleTimeoutMs = 3000;

    let acquired = false;
    const token = crypto.randomBytes(16).toString('hex');
    const lockDataToWrite = JSON.stringify({ 
      protocol_version: '1.0',
      pid: process.pid, 
      token, 
      created_at: Date.now() 
    });

    for (let i = 0; i < maxRetries; i++) {
      try {
        let fd: number | undefined;
        let lockFileCreated = false;
        let mainOpError: any = null;
        try {
          fd = fs.openSync(this.lockPath, 'wx');
          lockFileCreated = true;
          fs.writeFileSync(fd, lockDataToWrite, 'utf-8');
          fs.fsyncSync(fd);
        } catch (err: any) {
          mainOpError = err;
          if (err.code !== 'EEXIST' && lockFileCreated) {
            try {
              const content = fs.readFileSync(this.lockPath, 'utf-8');
              if (content) {
                const lockData = JSON.parse(content);
                if (lockData.pid === process.pid && lockData.token === token) {
                  fs.unlinkSync(this.lockPath);
                }
              }
            } catch {}
          }
        } finally {
          if (fd !== undefined) {
            try { fs.closeSync(fd); } catch (closeErr) {
              if (!mainOpError) mainOpError = closeErr;
            }
          }
        }

        if (mainOpError) throw mainOpError;
        
        // LOCK-OWNERSHIP Posi-Acquisition Double Check (Phase 6.1.3)
        // Eliminates the suspend/preemption race condition.
        const verifyContent = fs.readFileSync(this.lockPath, 'utf-8');
        const verifyData = JSON.parse(verifyContent);
        
        if (verifyData.pid !== process.pid || verifyData.token !== token) {
          throw new FactIntegrityError('Preemption detected: Lock stolen during creation.');
        }

        acquired = true;
        break;
      } catch (err: any) {
        if (err instanceof FactIntegrityError) {
          throw err;
        }
        if (err.code === 'EEXIST') {
          let isStale = false;
          try {
            const stat = fs.statSync(this.lockPath);
            const content = fs.readFileSync(this.lockPath, 'utf-8');
            if (content) {
              const lockData = JSON.parse(content);
              
              if (lockData.protocol_version !== '1.0') {
                // Legacy lock fallback (e.g. from Phase 6.1.1 tests)
                if (Date.now() - stat.mtimeMs > staleTimeoutMs) {
                  isStale = true;
                }
              } else {
                // Phase 6.1.3 Strict Ownership Protocol
                let processDead = false;
                try {
                  process.kill(lockData.pid, 0);
                } catch (killErr: any) {
                  if (killErr.code === 'ESRCH') {
                    processDead = true;
                  }
                }
                if (processDead) {
                  isStale = true;
                }
              }
            } else {
              if (Date.now() - stat.mtimeMs > staleTimeoutMs) {
                isStale = true;
              }
            }
          } catch {
            try {
              const stat = fs.statSync(this.lockPath);
              if (Date.now() - stat.mtimeMs > staleTimeoutMs) {
                isStale = true;
              }
            } catch {}
          }

          if (isStale) {
            try {
              fs.unlinkSync(this.lockPath);
            } catch (e: any) {
              if (e.code !== 'ENOENT') {
                // Ignore
              }
            }
            continue;
          }

          const start = Date.now();
          while (Date.now() - start < retryDelayMs) {}
        } else {
          throw new FactIntegrityError(`Failed to acquire lock: ${err.message}`);
        }
      }
    }

    if (!acquired) {
      throw new FactIntegrityError(`Storage lock acquisition timeout for '${this.filePath}'`);
    }

    try {
      return fn(token);
    } finally {
      if (acquired) {
        try {
          if (fs.existsSync(this.lockPath)) {
            const content = fs.readFileSync(this.lockPath, 'utf-8');
            if (content) {
              const lockData = JSON.parse(content);
              if (lockData.pid === process.pid && lockData.token === token) {
                fs.unlinkSync(this.lockPath);
              }
            } else {
              // Should not happen with the new protocol, but for safety:
              fs.unlinkSync(this.lockPath);
            }
          }
        } catch {}
      }
    }
  }

  public save(fact: Fact): void {
    this.withLock((lockToken) => {
      // 1. Integridade: Validação de Invariantes INV-6.1
      this.validateFactIntegrity(fact);

      // 2. Isolamento Estrutural (Boundary de Ownership do Repositório)
      const isolatedFact = structuredClone(fact);

      // 3. Imutabilização controlada exclusivamente na representação do Repositório
      const frozenFact = deepFreeze(isolatedFact);

      // 4. Transação Atômica: Carregar estado atual sob trava
      const state = this.loadState();

      // 5. Regra de No-Overwrite (INV-6.1-04) & Imutabilidade Factual (INV-6.1.22)
      if (state.facts[frozenFact.fact_id]) {
        const existing = state.facts[frozenFact.fact_id];
        if (canonicalStringify(existing) === canonicalStringify(frozenFact)) {
          // Operação Idempotente
          return;
        }
        throw new FactOverwriteForbiddenError(frozenFact.fact_id);
      }

      // 6. Superseding Governance Atômico & State Machine (INV-6.1.18, INV-6.1.19)
      const newFacts = { ...state.facts };
      const existingFactIds = state.semanticIndex[frozenFact.semantic_hash] || [];

      for (const fid of existingFactIds) {
        const prev = newFacts[fid];
        if (prev) {
          if (prev.lifecycle_status === 'SUPERSEDED') {
            // Já suplantado: permanece SUPERSEDED
            continue;
          }

          if (prev.lifecycle_status !== 'VALID') {
            throw new FactStateTransitionForbiddenError(prev.fact_id, prev.lifecycle_status, 'SUPERSEDED');
          }

          // Transição governada VALID -> SUPERSEDED mantendo campos fáticos imutáveis
          const supersededFact: Fact = deepFreeze({
            ...prev,
            lifecycle_status: 'SUPERSEDED' as const,
          });

          this.assertFactualImmutability(prev, supersededFact);
          newFacts[fid] = supersededFact;
        }
      }

      // 7. Novo Fato adicionado ao novo estado
      newFacts[frozenFact.fact_id] = frozenFact;

      const newInsertionOrder = [...state.insertionOrder, frozenFact.fact_id];

      const newSemanticIndex = { ...state.semanticIndex };
      const semList = newSemanticIndex[frozenFact.semantic_hash]
        ? [...newSemanticIndex[frozenFact.semantic_hash], frozenFact.fact_id]
        : [frozenFact.fact_id];
      newSemanticIndex[frozenFact.semantic_hash] = semList;

      const newInputIndex = { ...state.inputIndex };
      const inpList = newInputIndex[frozenFact.input_hash]
        ? [...newInputIndex[frozenFact.input_hash], frozenFact.fact_id]
        : [frozenFact.fact_id];
      newInputIndex[frozenFact.input_hash] = inpList;

      const newState: PersistedState = {
        version: FACT_SCHEMA_VERSION_1_0,
        facts: newFacts,
        semanticIndex: newSemanticIndex,
        inputIndex: newInputIndex,
        insertionOrder: newInsertionOrder,
      };

      // 8. Escrita Atômica + fsync em Disco (INV-6.1-01, INV-6.1-07, INV-6.1.17)
      this.atomicWriteState(newState, lockToken);
    });
  }

  public getById(factId: string): Fact | null {
    const state = this.loadState();
    const fact = state.facts[factId];
    return fact ? deepFreeze({ ...fact }) : null;
  }

  public findBySemanticHash(semanticHash: string): readonly Fact[] {
    const state = this.loadState();
    const ids = state.semanticIndex[semanticHash] || [];
    return deepFreeze(ids.map((id) => state.facts[id]).filter(Boolean));
  }

  public findByInputHash(inputHash: string): readonly Fact[] {
    const state = this.loadState();
    const ids = state.inputIndex[inputHash] || [];
    return deepFreeze(ids.map((id) => state.facts[id]).filter(Boolean));
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
    const state = this.loadState();
    return deepFreeze(state.insertionOrder.map((id) => state.facts[id]).filter(Boolean));
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadState(): PersistedState {
    if (!fs.existsSync(this.filePath)) {
      return {
        version: FACT_SCHEMA_VERSION_1_0,
        facts: {},
        semanticIndex: {},
        inputIndex: {},
        insertionOrder: [],
      };
    }

    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const state = JSON.parse(raw) as PersistedState;

      if (!state || typeof state !== 'object' || !state.facts) {
        throw new FactCorruptedError('Invalid state structure in storage file');
      }

      // Validação de corrupção nos fatos lidos
      for (const factId of Object.keys(state.facts)) {
        const fact = state.facts[factId];
        this.validateFactCorruption(fact);
      }

      return state;
    } catch (err: any) {
      if (err instanceof FactIntegrityError) {
        throw new FactCorruptedError(err.message);
      }
      throw new FactCorruptedError(`Failed to load durable storage: ${err.message}`);
    }
  }

  protected beforeAtomicRenameHook(): void {}
  protected beforeAtomicRenameMicroscopicHook(): void {}

  private verifyOwnershipStrict(token: string): void {
    try {
      const content = fs.readFileSync(this.lockPath, 'utf-8');
      const lockData = JSON.parse(content);
      if (lockData.pid !== process.pid || lockData.token !== token) {
        throw new FactIntegrityError('Ownership lost before commit (Preemption or external removal).');
      }
    } catch (err: any) {
      if (err instanceof FactIntegrityError) throw err;
      throw new FactIntegrityError('Ownership lost before commit: ' + err.message);
    }
  }

  private atomicWriteState(newState: PersistedState, lockToken: string): void {
    const tmpPath = `${this.filePath}.tmp_${crypto.randomBytes(6).toString('hex')}`;
    const content = canonicalStringify(newState);

    try {
      let fd: number | undefined;
      let writeError: any = null;
      try {
        fd = fs.openSync(tmpPath, 'w');
        fs.writeFileSync(fd, content, 'utf-8');
        fs.fsyncSync(fd); // Força escrita física nos setores do disco (Durabilidade contra crash)
      } catch (err: any) {
        writeError = err;
      } finally {
        if (fd !== undefined) {
          try { fs.closeSync(fd); } catch (closeErr) {
            if (!writeError) writeError = closeErr;
          }
        }
      }
      if (writeError) throw writeError;
      
      this.beforeAtomicRenameHook();
      
      this.verifyOwnershipStrict(lockToken); // Pre-commit double check (Phase 6.1.4 fix)
      
      this.beforeAtomicRenameMicroscopicHook(); // TOCTOU Microscopic Gap
      
      fs.renameSync(tmpPath, this.filePath); // Substituição atômica no diretório (Atomicidade)
    } catch (err: any) {
      if (fs.existsSync(tmpPath)) {
        try {
          fs.unlinkSync(tmpPath);
        } catch {
          // Ignora limpeza se arquivo temporário sumiu
        }
      }
      throw new FactIntegrityError(`Atomic write transaction failed: ${err.message}`);
    }
  }

  private validateFactIntegrity(fact: Fact): void {
    if (!fact || typeof fact !== 'object') {
      throw new FactIntegrityError('INV-6.1-03: Fact must be a non-null object');
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
        throw new FactIntegrityError(`INV-6.1-03: Fact missing required field '${field}'`);
      }
    }

    // INV-6.1-10: evidence_ids não pode ser vazio
    if (!Array.isArray(fact.evidence_ids) || fact.evidence_ids.length === 0) {
      throw new FactIntegrityError('INV-6.1-10: Fact evidence_ids array must not be empty');
    }

    // INV-6.1-10: input_hash formato SHA-256
    if (typeof fact.input_hash !== 'string' || !/^[a-f0-9]{64}$/i.test(fact.input_hash)) {
      throw new FactIntegrityError('INV-6.1-10: Fact input_hash must be a valid 64-character SHA-256 hex string');
    }

    // INV-6.1-10: semantic_hash formato SHA-256
    if (typeof fact.semantic_hash !== 'string' || !/^[a-f0-9]{64}$/i.test(fact.semantic_hash)) {
      throw new FactIntegrityError('INV-6.1-10: Fact semantic_hash must be a valid 64-character SHA-256 hex string');
    }

    // INV-6.1-11: schema_version = FACT_SCHEMA_VERSION_1_0 ("1.0")
    if (fact.schema_version !== FACT_SCHEMA_VERSION_1_0) {
      throw new FactIntegrityError(`INV-6.1-11: Fact schema_version '${fact.schema_version}' is invalid. Expected '${FACT_SCHEMA_VERSION_1_0}'`);
    }

    if (fact.lifecycle_status !== 'VALID' && fact.lifecycle_status !== 'SUPERSEDED') {
      throw new FactIntegrityError(`INV-6.1-03: Fact lifecycle_status '${fact.lifecycle_status}' is invalid`);
    }
  }

  private validateFactCorruption(fact: Fact): void {
    this.validateFactIntegrity(fact);

    if (fact.lifecycle_status !== 'VALID' && fact.lifecycle_status !== 'SUPERSEDED') {
      throw new FactCorruptedError(`Invalid lifecycle_status '${fact.lifecycle_status}'`);
    }

    // Re-validação do semantic_hash contra o payload serializado canonicamente
    const expectedSemanticHash = canonicalHash(fact.payload);
    if (fact.semantic_hash !== expectedSemanticHash) {
      throw new FactCorruptedError(`Semantic hash mismatch for Fact '${fact.fact_id}'. Stored: ${fact.semantic_hash}, Expected: ${expectedSemanticHash}`);
    }
  }

  private assertFactualImmutability(before: Fact, after: Fact): void {
    const immutableKeys: (keyof Fact)[] = [
      'fact_id',
      'schema_version',
      'fact_type',
      'provider_id',
      'provider_version',
      'evidence_ids',
      'input_hash',
      'semantic_hash',
      'payload',
      'composite_confidence',
      'created_at',
    ];

    for (const key of immutableKeys) {
      if (canonicalStringify(before[key]) !== canonicalStringify(after[key])) {
        throw new FactIntegrityError(`INV-6.1.22: Illegal mutation of factual field '${key}' for Fact '${before.fact_id}'`);
      }
    }
  }
}

// Alias export para clareza de intenção durável
export const DurableFactRepository = FileFactRepository;
