import { 
  AgentRole, 
  OrchestrationState, 
  OrchestrationRun, 
  OrchestrationTransition, 
  AgentResult, 
  AgentRequest,
  OrchestrationVerdict
} from '../domain/orchestration-contracts';
import { IAgentExecutor } from '../orchestration/agent-executors';

export class MultiAgentOrchestrationEngine {
  private run: OrchestrationRun;
  private executor: IAgentExecutor;

  constructor(finding_id: string, target_id: string, executor: IAgentExecutor) {
    this.executor = executor;
    this.run = {
      run_id: `ORC-${Date.now()}`,
      finding_id,
      target_id,
      created_at: new Date().toISOString(),
      eos_version: '2.2.0',
      state: 'CREATED',
      agent_runs: [],
      transitions: []
    };
  }

  public getRunState(): OrchestrationRun {
    return this.run;
  }

  private transitionTo(newState: OrchestrationState, trigger: string, agent_id?: string) {
    const validTransitions: Record<OrchestrationState, OrchestrationState[]> = {
      'CREATED': ['ANALYZING', 'BLOCKED', 'FAILED'],
      'ANALYZING': ['PLANNING', 'BLOCKED', 'FAILED'],
      'PLANNING': ['IMPLEMENTING', 'BLOCKED', 'FAILED'],
      'IMPLEMENTING': ['REVIEWING', 'BLOCKED', 'FAILED'],
      'REVIEWING': ['EVIDENCE_AUDIT', 'BLOCKED', 'FAILED'],
      'EVIDENCE_AUDIT': ['RECONCILING', 'BLOCKED', 'FAILED'],
      'RECONCILING': ['VERIFIED', 'BLOCKED', 'FAILED'],
      'VERIFIED': [],
      'BLOCKED': [],
      'FAILED': []
    };

    const allowed = validTransitions[this.run.state];
    if (!allowed || !allowed.includes(newState)) {
      throw new Error(`[Orchestration Engine] INVALID_STATE_TRANSITION: Cannot transition from ${this.run.state} to ${newState}`);
    }

    const transition: OrchestrationTransition = {
      timestamp: new Date().toISOString(),
      from_state: this.run.state,
      to_state: newState,
      trigger,
      agent_id
    };

    this.run = {
      ...this.run,
      state: newState,
      transitions: [...this.run.transitions, transition]
    };
  }

  private async dispatch(role: AgentRole): Promise<AgentResult> {
    const request: AgentRequest = {
      run_id: this.run.run_id,
      role,
      context: {
        run_id: this.run.run_id,
        finding_id: this.run.finding_id,
        target_id: this.run.target_id,
        scope: 'Full'
      },
      expected_schema: 'AgentResult',
      constraints: ['Must produce verifiable artifacts']
    };

    try {
      const result = await this.executor.execute(request);
      
      this.run = {
        ...this.run,
        agent_runs: [...this.run.agent_runs, result]
      };

      if (result.status === 'FAILURE' || result.status === 'TIMEOUT') {
        this.transitionTo('BLOCKED', 'WORKER_EXECUTION_FAILURE', result.agent_id);
        return result;
      }

      if (result.status === 'BLOCKED' || (result.challenges && result.challenges.length > 0)) {
        this.transitionTo('BLOCKED', 'BLOCKING_CHALLENGE', result.agent_id);
      }

      return result;
    } catch (e: any) {
      this.transitionTo('FAILED', 'EXECUTOR_EXCEPTION');
      throw e;
    }
  }

  public async executeFullPipeline(): Promise<OrchestrationVerdict> {
    try {
      // 1. Implementation
      this.transitionTo('ANALYZING', 'Start Analysis');
      this.transitionTo('PLANNING', 'Start Planning');
      this.transitionTo('IMPLEMENTING', 'Dispatch Implementer');
      const implResult = await this.dispatch('IMPLEMENTER');
      
      if ((this.run.state as OrchestrationState) === 'BLOCKED' || (this.run.state as OrchestrationState) === 'FAILED') {
        return this.finishWithVerdict('BLOCKED', 'IMPLEMENTATION FAILED OR BLOCKED');
      }

      // 2. Review
      this.transitionTo('REVIEWING', 'Dispatch Reviewer');
      const revResult = await this.dispatch('REVIEWER');
      
      if ((this.run.state as OrchestrationState) === 'BLOCKED') {
        return this.finishWithVerdict('BLOCKED', 'REVIEWER REJECTED IMPLEMENTATION (FALSE_GREEN_BLOCKED)');
      }

      // 3. Evidence Audit
      this.transitionTo('EVIDENCE_AUDIT', 'Dispatch Evidence Auditor');
      const auditResult = await this.dispatch('EVIDENCE_AUDITOR');

      if ((this.run.state as OrchestrationState) === 'BLOCKED') {
        return this.finishWithVerdict('BLOCKED', 'EVIDENCE AUDITOR REJECTED EVIDENCE');
      }

      // 4. Reconciliation
      this.transitionTo('RECONCILING', 'Reconciliation Engine Started');
      return this.reconcile(implResult, revResult, auditResult);

    } catch (e: any) {
      if (this.run.state !== 'FAILED' && this.run.state !== 'BLOCKED') {
        this.transitionTo('FAILED', 'UNHANDLED EXCEPTION');
      }
      return this.finishWithVerdict('BLOCKED', e.message);
    }
  }

  private reconcile(impl: AgentResult, rev: AgentResult, aud: AgentResult): OrchestrationVerdict {
    // 1. Worker claim authority check: Worker claims VERIFIED without evidence -> Blocked.
    const allRuns = [impl, rev, aud];
    for (const res of allRuns) {
      if (res.verdict_claim === 'VERIFIED') {
        if (!res.evidence_ids || res.evidence_ids.length === 0) {
          this.transitionTo('BLOCKED', 'FALSE VERDICT INJECTION DETECTED: Agent claimed VERIFIED with no evidence');
          return this.finishWithVerdict('BLOCKED', 'AUTHORITY_VIOLATION: Agent lacks authority to declare VERIFIED without evidence');
        }
      }
    }

    // 2. Strict Evidence Gate: SUCCESS requires valid evidence from the Auditor
    if (aud.status === 'SUCCESS' && (!aud.evidence_ids || aud.evidence_ids.length === 0)) {
      this.transitionTo('BLOCKED', 'INSUFFICIENT EVIDENCE: Evidence Auditor returned SUCCESS without evidence payload');
      return this.finishWithVerdict('BLOCKED', 'EVIDENCE_GATE_FAILED: Missing or empty evidence_ids');
    }

    // 3. Structural Conflict check: 
    if (impl.status !== 'SUCCESS' || rev.status !== 'SUCCESS' || aud.status !== 'SUCCESS') {
      this.transitionTo('BLOCKED', 'CONFLICT OR FAILED WORKER IN RECONCILIATION');
      return this.finishWithVerdict('BLOCKED', 'AGENTS NOT IN CONSENSUS');
    }

    // 4. If all good -> Verified
    this.transitionTo('VERIFIED', 'All Agents SUCCEEDED and Evidence Validated');
    return this.finishWithVerdict('VERIFIED', 'EOS ORCHESTRATION VERIFIED');
  }

  private finishWithVerdict(status: OrchestrationVerdict['status'], rationale: string): OrchestrationVerdict {
    const verdict: OrchestrationVerdict = {
      status,
      rationale,
      final_state: this.run.state
    };
    this.run = { ...this.run, verdict };
    return verdict;
  }
}
