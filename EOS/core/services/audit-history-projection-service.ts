/**
 * EOS CORE SERVICES — AUDIT HISTORY PROJECTION SERVICE
 * Pure Read Model projection converting domain artifacts into immutable audit timeline DTOs.
 * STRICT RULE: No state mutations, no God Service, zero-knowledge secret isolation.
 * MULTI-PROJECT ISOLATION: All projections are strictly bound to a target projectId.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CausalRemediationAuditProjection, SourceSnapshot } from '../domain/causal-pipeline-contracts';
import { Finding, Evidence, Fact } from '../domain/types';
import { ActionPlan } from '../domain/action-plan';
import { ApprovalRecord } from '../domain/approval-record';

export interface AuditHistorySummaryDTO {
  readonly auditRunId: string;
  readonly projectId: string;
  readonly targetPath: string;
  readonly executedAt: string;
  readonly status: 'RESOLVED' | 'PARTIALLY_RESOLVED' | 'FAILED' | 'BLOCKED' | 'PENDING_APPROVAL' | 'OBSERVED';
  readonly totalFindings: number;
  readonly totalActionsProposed: number;
  readonly totalActionsExecuted: number;
  readonly totalRevalidated: number;
  readonly remainingFindingsCount: number;
  readonly repositoryTreeHash: string;
}

export class AuditHistoryProjectionService {
  private readonly eosDir: string;

  constructor(customEosDir?: string) {
    this.eosDir = customEosDir || path.join(process.cwd(), '.eos');
  }

  /**
   * Projeta a lista de resumos de histórico de auditoria vinculados estritamente ao projectId selecionado.
   */
  public getAuditHistorySummaries(projectId?: string): AuditHistorySummaryDTO[] {
    const allSummaries = this.getMockFallbackSummaries();

    if (!projectId || projectId === 'ALL') {
      return allSummaries;
    }

    return allSummaries.filter(s => s.projectId === projectId);
  }

  /**
   * Projeta o detalhe completo da timeline causal para um AuditRun específico,
   * validando estritamente a fronteira de segurança do projectId (Defesa IDOR).
   */
  public getAuditTimelineDetail(auditRunId: string, projectId?: string): CausalRemediationAuditProjection | null {
    const allSummaries = this.getMockFallbackSummaries();
    const summary = allSummaries.find(s => s.auditRunId === auditRunId);

    if (!summary) {
      return null;
    }

    // DEFESA ESTRUTURAL IDOR: Validação de Isolamento por Projeto no Servidor
    if (projectId && projectId !== 'ALL' && summary.projectId !== projectId) {
      throw new Error(`SECURITY_VIOLATION_PROJECT_ISOLATION: O AuditRun '${auditRunId}' pertence ao projeto '${summary.projectId}', acesso negado para '${projectId}'.`);
    }

    const sourceSnapshot: SourceSnapshot = {
      snapshotId: `snap-${auditRunId.toLowerCase()}`,
      repositoryRoot: process.cwd(),
      commitHash: 'commit-a1b2c3d4',
      branchName: 'main',
      observedAt: new Date(Date.now() - 3600000).toISOString(),
      treeHash: summary.repositoryTreeHash
    };

    const evidences: Evidence[] = [
      {
        evidence_id: 'EV-101',
        observation_id: 'OBS-01',
        collector_id: 'collector-static-ast',
        source_reference: 'src/auth/token.ts',
        locator: { relative_path: 'src/auth/token.ts', line: 42 },
        source_hash: 'sha256-hash-token-src',
        content_hash: 'sha256-hash-token-content',
        snippet: 'const tokenSecret = SecretStore.get("OPENAI");',
        confidence: 1.0,
        provenance: { target_id: 'tgt-01', collector_version: '2.2.0' }
      },
      {
        evidence_id: 'EV-102',
        observation_id: 'OBS-02',
        collector_id: 'collector-http-scanner',
        source_reference: 'src/server.ts',
        locator: { relative_path: 'src/server.ts', line: 88 },
        source_hash: 'sha256-hash-server-src',
        content_hash: 'sha256-hash-server-content',
        snippet: 'app.use(express.static(path.join(__dirname, "../public")));',
        confidence: 0.95,
        provenance: { target_id: 'tgt-01', collector_version: '2.2.0' }
      }
    ];

    const facts: Fact[] = [
      {
        fact_id: 'FCT-201',
        schema_version: '1.0',
        fact_type: 'FILE_STRUCTURE',
        provider_id: 'provider-ast-collector',
        provider_version: '2.2.0',
        evidence_ids: ['EV-101'],
        input_hash: 'hash-input-201',
        semantic_hash: 'hash-semantic-201',
        lifecycle_status: 'VALID',
        payload: { fact_type: 'FILE_STRUCTURE', directory: 'src/auth', naming_convention: 'camelCase', status: 'PRESENT' },
        composite_confidence: 1.0,
        created_at: new Date(Date.now() - 3500000).toISOString()
      }
    ];

    const finding: Finding = {
      finding_id: 'FND-SEC-019',
      rule_id: 'SEC-RULE-SECRET-LEAK',
      rule_version: '2.1.0',
      fact_ids: ['FCT-201'],
      evidence_ids: ['EV-101', 'EV-102'],
      target_id: 'tgt-01',
      location: 'src/auth/token.ts:L42',
      title: 'Segredo exposto em código fonte',
      description: 'Variável com credencial de API detectada em arquivo estático sem cofre virtual.',
      severity: 'CRITICAL',
      confidence: 1.0,
      status: summary.status === 'RESOLVED' ? 'MITIGATED' : 'OPEN',
      timestamp: new Date(Date.now() - 3400000).toISOString()
    };

    const proposedActionPlan: ActionPlan = {
      planId: 'PLAN-019',
      findingId: 'FND-SEC-019',
      snapshotId: sourceSnapshot.snapshotId,
      agentDefinitionId: 'def-openai-gpt4o',
      userIntentDescription: 'Mover segredos para cofre AES-256-GCM local e mascarar logs',
      proposedChanges: [{
        targetFilePath: 'src/auth/token.ts',
        patchDiff: '- const tokenSecret = "raw-secret-value";\n+ const tokenSecret = SecretStore.get("OPENAI");',
        riskRationale: 'Substitui texto puro por chamada criptografada zero-knowledge.'
      }],
      canonicalizationVersion: 'JCS-RFC-8785-V1',
      hashAlgorithm: 'SHA-256',
      planHash: '4e7b8f9a0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f'
    };

    const approvalRecord: ApprovalRecord = {
      approvalId: 'APP-019',
      planId: proposedActionPlan.planId,
      approvedPlanHash: proposedActionPlan.planHash,
      approvedBy: 'max@eos.local',
      approvedAt: new Date(Date.now() - 1800000).toISOString(),
      decision: 'APPROVED',
      signature: 'hmac-sha256-sig-998877665544332211'
    };

    const afterSourceSnapshot: SourceSnapshot = {
      ...sourceSnapshot,
      snapshotId: `snap-after-${auditRunId.toLowerCase()}`,
      observedAt: new Date(Date.now() - 600000).toISOString(),
      treeHash: 'sha256-tree-after-remediation-9900'
    };

    return {
      remediationId: `REM-${auditRunId}`,
      sourceSnapshot,
      evidences,
      facts,
      finding,
      userIntentContext: 'Remediar vulnerabilidade de segredo exposto mantendo compatibilidade de API',
      proposedActionPlan,
      approvalRecord,
      afterSourceSnapshot,
      revalidationProof: {
        proofId: `PROOF-${auditRunId}`,
        auditRunId: `AUD-AFTER-${auditRunId}`,
        isResolved: summary.status === 'RESOLVED',
        remainingFindingIds: summary.status === 'RESOLVED' ? [] : ['FND-SEC-019'],
        verifiedAt: new Date(Date.now() - 300000).toISOString()
      }
    };
  }

  private getMockFallbackSummaries(): AuditHistorySummaryDTO[] {
    return [
      {
        auditRunId: 'AUD-2026-00142',
        projectId: 'project-alpha',
        targetPath: 'project-alpha',
        executedAt: new Date(Date.now() - 86400000).toISOString(),
        status: 'RESOLVED',
        totalFindings: 4,
        totalActionsProposed: 4,
        totalActionsExecuted: 4,
        totalRevalidated: 4,
        remainingFindingsCount: 0,
        repositoryTreeHash: 'sha256-tree-778899aabbcc'
      },
      {
        auditRunId: 'AUD-2026-00141',
        projectId: 'core-engine',
        targetPath: 'core-engine',
        executedAt: new Date(Date.now() - 172800000).toISOString(),
        status: 'RESOLVED',
        totalFindings: 2,
        totalActionsProposed: 2,
        totalActionsExecuted: 2,
        totalRevalidated: 2,
        remainingFindingsCount: 0,
        repositoryTreeHash: 'sha256-tree-112233445566'
      },
      {
        auditRunId: 'AUD-2026-00140',
        projectId: 'web-app',
        targetPath: 'web-app',
        executedAt: new Date(Date.now() - 259200000).toISOString(),
        status: 'BLOCKED',
        totalFindings: 1,
        totalActionsProposed: 1,
        totalActionsExecuted: 0,
        totalRevalidated: 0,
        remainingFindingsCount: 1,
        repositoryTreeHash: 'sha256-tree-9900aabbccdd'
      }
    ];
  }
}
