export type AgentRole = 'IMPLEMENTER' | 'REVIEWER' | 'EVIDENCE_AUDITOR' | 'ORCHESTRATOR';

export type OrchestrationState = 
  | 'CREATED' 
  | 'ANALYZING' 
  | 'PLANNING' 
  | 'IMPLEMENTING' 
  | 'REVIEWING' 
  | 'EVIDENCE_AUDIT' 
  | 'RECONCILING' 
  | 'VERIFIED' 
  | 'BLOCKED' 
  | 'FAILED';

export interface AgentContext {
  readonly run_id: string;
  readonly finding_id: string;
  readonly target_id: string;
  readonly scope: string;
}

export interface AgentRequest {
  readonly run_id: string;
  readonly role: AgentRole;
  readonly context: AgentContext;
  readonly expected_schema: 'AgentResult';
  readonly constraints: readonly string[];
  readonly implementation_artifact?: string; // used by reviewer/auditor
}

export interface AgentResult {
  readonly run_id: string;
  readonly agent_id: string;
  readonly role: AgentRole;
  readonly status: 'SUCCESS' | 'FAILURE' | 'BLOCKED' | 'TIMEOUT' | 'PARTIAL_RESULT';
  readonly proposed_action?: string;
  readonly artifacts?: readonly string[];
  readonly evidence_ids?: readonly string[];
  readonly challenges?: readonly string[];
  readonly verdict_claim?: string; // Worker claim (has NO final authority)
}

export interface OrchestrationTransition {
  readonly timestamp: string;
  readonly from_state: OrchestrationState;
  readonly to_state: OrchestrationState;
  readonly trigger: string;
  readonly agent_id?: string;
}

export interface OrchestrationVerdict {
  readonly status: 'VERIFIED' | 'NOT_VERIFIED' | 'BLOCKED' | 'PROTOCOL_VERIFIED_ORCHESTRATION_PARTIAL';
  readonly rationale: string;
  readonly final_state: OrchestrationState;
}

export interface OrchestrationRun {
  readonly run_id: string;
  readonly finding_id: string;
  readonly target_id: string;
  readonly created_at: string;
  readonly eos_version: string;
  readonly baseline_commit?: string;
  readonly current_commit?: string;
  readonly state: OrchestrationState;
  readonly agent_runs: readonly AgentResult[];
  readonly transitions: readonly OrchestrationTransition[];
  readonly verdict?: OrchestrationVerdict;
}
