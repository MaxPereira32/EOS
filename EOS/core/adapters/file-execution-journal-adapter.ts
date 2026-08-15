import * as fs from 'fs';
import * as path from 'path';
import { ActionPlan } from '../domain/action-plan';
import { ExecutionJournal, ExecutionJournalService, ExecutionStepState } from '../domain/semantic-policy-engine';

export class FileExecutionJournalAdapter implements ExecutionJournalService {
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
