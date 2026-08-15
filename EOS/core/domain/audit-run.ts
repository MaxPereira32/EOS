import { Finding, Evidence, RuleEvaluationResult, AuditTarget } from './types';
import { AgentProvider, AgentProviderType, AgentProviderStatus } from './agent-provider';

export type ExecutionType = 'FULL_AUDIT' | 'RULE_AUDIT' | 'RULE_SET_AUDIT';
export type AuditRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface AuditRun {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly executionType: ExecutionType;
  readonly status: AuditRunStatus;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly durationMs: number;
  readonly branch: string;
  readonly commitHash?: string;
  readonly rulesExecuted: number;
  readonly findingsCount: number;
  readonly highestSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  readonly riskScore: number;
  readonly riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  readonly findings: readonly Finding[];
  readonly evidenceList: readonly Evidence[];
  readonly ruleResults: readonly RuleEvaluationResult[];
  readonly target: AuditTarget;
  readonly metadata?: Record<string, any>;
}

export type { AgentProvider, AgentProviderType, AgentProviderStatus };

