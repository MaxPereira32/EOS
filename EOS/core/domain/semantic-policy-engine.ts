/**
 * EOS CORE DOMAIN — SEMANTIC POLICY ENGINE & OPERATIONAL RESILIENCE
 * Phase 1.4: Semantic Authorization, Idempotency, TOCTOU Defense, Conflict Detection, and Persistent Crash State Machine.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ActionPlan } from './action-plan';
import { ApprovalRecord } from './approval-record';

export type ExecutionStepState = 'NOT_STARTED' | 'IN_PROGRESS' | 'APPLIED' | 'FAILED' | 'REVALIDATED';

export interface ExecutionJournal {
  readonly planId: string;
  readonly planHash: string;
  readonly stepState: ExecutionStepState;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly appliedPatches: readonly { readonly targetFilePath: string; readonly patchHash: string }[];
  readonly errorDetails?: string;
}

export class FileExecutionJournalService {
  private readonly journalDir: string;

  constructor(customJournalDir?: string) {
    this.journalDir = customJournalDir || path.join(process.cwd(), '.eos', 'execution_journals');
    if (!fs.existsSync(this.journalDir)) {
      fs.mkdirSync(this.journalDir, { recursive: true });
    }
  }

  public getJournalPath(planId: string): string {
    return path.join(this.journalDir, `${planId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
  }

  public startJournal(plan: ActionPlan): ExecutionJournal {
    const journalPath = this.getJournalPath(plan.planId);
    const now = new Date().toISOString();

    const journal: ExecutionJournal = {
      planId: plan.planId,
      planHash: plan.planHash,
      stepState: 'IN_PROGRESS',
      startedAt: now,
      updatedAt: now,
      appliedPatches: []
    };

    this.persistJournalSync(journalPath, journal);
    return journal;
  }

  public updateJournalState(planId: string, stepState: ExecutionStepState, patch?: { targetFilePath: string; patchHash: string }, errorDetails?: string): ExecutionJournal {
    const journalPath = this.getJournalPath(planId);
    const existing = this.readJournal(planId);

    const now = new Date().toISOString();
    const updatedPatches = patch ? [...(existing?.appliedPatches || []), patch] : (existing?.appliedPatches || []);

    const updatedJournal: ExecutionJournal = {
      planId,
      planHash: existing?.planHash || 'unknown',
      stepState,
      startedAt: existing?.startedAt || now,
      updatedAt: now,
      appliedPatches: updatedPatches,
      errorDetails: errorDetails || existing?.errorDetails
    };

    this.persistJournalSync(journalPath, updatedJournal);
    return updatedJournal;
  }

  public readJournal(planId: string): ExecutionJournal | null {
    const journalPath = this.getJournalPath(planId);
    if (!fs.existsSync(journalPath)) return null;

    try {
      const content = fs.readFileSync(journalPath, 'utf8');
      return JSON.parse(content) as ExecutionJournal;
    } catch {
      return null;
    }
  }

  public recoverPendingExecution(planId: string): { isInterrupted: boolean; stepState: ExecutionStepState } {
    const journal = this.readJournal(planId);
    if (!journal) {
      return { isInterrupted: false, stepState: 'NOT_STARTED' };
    }

    if (journal.stepState === 'IN_PROGRESS') {
      // Estado interrompido por crash do processo durante a execução no disco
      return { isInterrupted: true, stepState: 'IN_PROGRESS' };
    }

    return { isInterrupted: false, stepState: journal.stepState };
  }

  private persistJournalSync(journalPath: string, journal: ExecutionJournal): void {
    const content = JSON.stringify(journal, null, 2);
    const fd = fs.openSync(journalPath, 'w');
    try {
      fs.writeFileSync(fd, content, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  }
}

export class SemanticPolicyEngine {
  private static readonly FORBIDDEN_TARGET_PATTERNS = [
    /^\.git\//,
    /^\.eos\/rules\//,
    /^\.eos\/credentials\.enc\.json/,
    /^\.eos\/governor\.hash/,
    /^node_modules\//,
    /\.pem$/,
    /\.key$/
  ];

  /**
   * AUTORIZAÇÃO SEMÂNTICA: Valida se o plano respeita os limites de segurança política.
   */
  public static validateSemanticPolicy(plan: ActionPlan): void {
    for (const change of plan.proposedChanges) {
      const normalizedPath = change.targetFilePath.replace(/\\/g, '/');

      for (const pattern of this.FORBIDDEN_TARGET_PATTERNS) {
        if (pattern.test(normalizedPath)) {
          throw new Error(`SEMANTIC_POLICY_VIOLATION: O ActionPlan tenta modificar o caminho proibido '${change.targetFilePath}'. Acesso negado pela política.`);
        }
      }
    }
  }

  /**
   * IDEMPOTÊNCIA DE EXECUÇÃO: Verifica se o patch já foi aplicado no disco.
   */
  public static isPlanAlreadyApplied(plan: ActionPlan, repositoryRoot: string): boolean {
    for (const change of plan.proposedChanges) {
      const fullPath = path.join(repositoryRoot, change.targetFilePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(change.patchDiff)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * DEFESA TOCTOU ATÔMICA (Time-of-Check to Time-of-Use):
   * Executa a checagem do hash e a gravação mantendo trava atômica no arquivo durante todo o ciclo.
   */
  public static validateTOCTOUAndExecute(filePath: string, expectedSourceHash: string, writeFn: () => void): void {
    const lockPath = `${filePath}.lock`;
    let lockFd: number | undefined;

    try {
      // Adquire trava atômica antes do TOCTOU check
      lockFd = fs.openSync(lockPath, 'wx');

      if (!fs.existsSync(filePath)) {
        throw new Error(`TOCTOU_VIOLATION_FILE_NOT_FOUND: O arquivo '${filePath}' foi removido entre a verificação e a gravação.`);
      }

      const currentContent = fs.readFileSync(filePath, 'utf8');
      const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');

      if (currentHash !== expectedSourceHash) {
        throw new Error(`TOCTOU_VIOLATION_FILE_MODIFIED: O arquivo '${filePath}' sofreu mutação no milissegundo antes da gravação.`);
      }

      // Executa a escrita atômica mantendo a trava
      writeFn();
    } finally {
      if (lockFd !== undefined) {
        try { fs.closeSync(lockFd); } catch {}
        try { if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath); } catch {}
      }
    }
  }

  public static validateTOCTOU(filePath: string, expectedSourceHash: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`TOCTOU_VIOLATION_FILE_NOT_FOUND: O arquivo '${filePath}' foi removido entre a verificação e a gravação.`);
    }
    const currentContent = fs.readFileSync(filePath, 'utf8');
    const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');

    if (currentHash !== expectedSourceHash) {
      throw new Error(`TOCTOU_VIOLATION_FILE_MODIFIED: O arquivo '${filePath}' sofreu mutação no milissegundo antes da gravação.`);
    }
  }

  /**
   * DETECÇÃO DE CONFLITO DE REMEDIAÇÃO:
   */
  public static detectRemediationConflict(planA: ActionPlan, planB: ActionPlan): void {
    if (planA.planId === planB.planId) return;

    const pathsA = new Set(planA.proposedChanges.map(c => c.targetFilePath));
    for (const changeB of planB.proposedChanges) {
      if (pathsA.has(changeB.targetFilePath)) {
        throw new Error(`REMEDIATION_CONFLICT_OVERLAPPING_PATCH: Conflito detectado! Planos '${planA.planId}' e '${planB.planId}' tentam alterar o mesmo arquivo '${changeB.targetFilePath}'.`);
      }
    }
  }
}
