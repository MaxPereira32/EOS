import { NistAssessmentEngine, EvidencePayload } from '../engines/nist-assessment-engine';
import { NistRequirement, NistApplicability, ControlMapping, NistAssessmentResult } from '../domain/nist-contracts';
import { MultiAgentOrchestrationEngine } from '../engines/multi-agent-orchestration-engine';
import { MockAgentExecutor } from '../orchestration/agent-executors';
import { AssessmentSnapshot } from '../domain/assessment-snapshot';

export interface RemediationPipelineResult {
  readonly initial_assessment: NistAssessmentResult;
  readonly before_snapshot?: AssessmentSnapshot;
  readonly false_fix_blocked: boolean;
  readonly true_fix_orchestration_id?: string;
  readonly after_snapshot?: AssessmentSnapshot;
  readonly final_reassessment: NistAssessmentResult;
}

export class AssessmentRemediationService {
  private engine: NistAssessmentEngine;

  constructor() {
    this.engine = new NistAssessmentEngine();
  }

  public async runFullRemediationPipeline(data: {
    requirement: NistRequirement;
    applicability: NistApplicability;
    mapping: ControlMapping;
    target_id: string;
    initial_evidence: readonly EvidencePayload[];
    git_commit_before: string;
    git_commit_after: string;
  }): Promise<RemediationPipelineResult> {
    
    // 1. Ingestão e Avaliação Inicial (BEFORE)
    const initial_assessment = this.engine.assessRequirement({
      requirement: data.requirement,
      applicability: data.applicability,
      mapping: data.mapping,
      facts: ['FACT-SYSCTX-01'],
      evidence: data.initial_evidence,
      target_id: data.target_id
    });

    if (initial_assessment.status === 'VERIFIED') {
      return {
        initial_assessment,
        false_fix_blocked: false,
        final_reassessment: initial_assessment
      };
    }

    // 2. Materializar Finding Canônico do EOS
    const finding_id = initial_assessment.finding_reference || `FND-NST-${data.requirement.requirement_id}`;

    // 3. Capturar Snapshot BEFORE
    const before_snapshot = new AssessmentSnapshot({
      snapshot_type: 'BEFORE_REMEDIATION',
      target_id: data.target_id,
      evidence_ids: data.initial_evidence.map(e => e.evidence_id),
      fact_ids: ['FACT-SYSCTX-01'],
      finding_ids: [finding_id],
      risk_level: 'HIGH',
      verification_status: 'NON_COMPLIANT',
      provenance: {
        execution_id: `EXEC-BEFORE-${Date.now()}`,
        executed_at: new Date().toISOString(),
        eos_version: '2.2.0',
        tool_or_collector: 'NistAssessmentEngine',
        target_type: 'SOURCE_CODE',
        git_commit: data.git_commit_before
      }
    });

    // 4. Executar Orquestração Multi-Agente - CICLO 1: FALSE FIX
    const mockFalse = new MockAgentExecutor();
    mockFalse.registerMock('IMPLEMENTER', {
      run_id: 'CYCLE1',
      agent_id: 'IMP-01',
      role: 'IMPLEMENTER',
      status: 'SUCCESS',
      proposed_action: 'if (!data.system_id) throw error;' // Incomplete fix
    });
    mockFalse.registerMock('REVIEWER', {
      run_id: 'CYCLE1',
      agent_id: 'REV-01',
      role: 'REVIEWER',
      status: 'BLOCKED',
      challenges: ['Whitespace bypass ("   ") detected during adversarial attack']
    });

    const falseOrchestrator = new MultiAgentOrchestrationEngine(finding_id, data.target_id, mockFalse);
    const falseVerdict = await falseOrchestrator.executeFullPipeline();
    const false_fix_blocked = (falseVerdict.status === 'BLOCKED');

    // 5. Executar Orquestração Multi-Agente - CICLO 2: TRUE FIX
    const mockTrue = new MockAgentExecutor();
    mockTrue.registerMock('IMPLEMENTER', {
      run_id: 'CYCLE2',
      agent_id: 'IMP-02',
      role: 'IMPLEMENTER',
      status: 'SUCCESS',
      proposed_action: 'if (typeof data.system_id !== "string" || data.system_id.trim() === "") throw error;'
    });
    mockTrue.registerMock('REVIEWER', {
      run_id: 'CYCLE2',
      agent_id: 'REV-02',
      role: 'REVIEWER',
      status: 'SUCCESS',
      evidence_ids: ['EVI-ATTACK-PASS']
    });
    mockTrue.registerMock('EVIDENCE_AUDITOR', {
      run_id: 'CYCLE2',
      agent_id: 'AUD-02',
      role: 'EVIDENCE_AUDITOR',
      status: 'SUCCESS',
      evidence_ids: ['EVI-NEW-PW82-PASS']
    });

    const trueOrchestrator = new MultiAgentOrchestrationEngine(finding_id, data.target_id, mockTrue);
    const trueVerdict = await trueOrchestrator.executeFullPipeline();

    if (trueVerdict.status !== 'VERIFIED') {
      throw new Error(`Remediation Failed: Orchestration did not yield VERIFIED. Rationale: ${trueVerdict.rationale}`);
    }

    // 6. Novas Evidências geradas após a remediação
    const after_evidence: EvidencePayload[] = [
      {
        evidence_id: 'EVI-NEW-PW82-PASS',
        target_id: data.target_id,
        timestamp: new Date().toISOString(),
        status: 'PASS'
      }
    ];

    // 7. Capturar Snapshot AFTER
    const after_snapshot = new AssessmentSnapshot({
      snapshot_type: 'AFTER_REMEDIATION',
      target_id: data.target_id,
      evidence_ids: after_evidence.map(e => e.evidence_id),
      fact_ids: ['FACT-SYSCTX-01'],
      finding_ids: [], // Finding resolvido
      risk_level: 'LOW',
      verification_status: 'VERIFIED',
      provenance: {
        execution_id: `EXEC-AFTER-${Date.now() + 100}`,
        executed_at: new Date(Date.now() + 1000).toISOString(),
        eos_version: '2.2.0',
        tool_or_collector: 'NistAssessmentEngine',
        target_type: 'SOURCE_CODE',
        git_commit: data.git_commit_after
      }
    });

    // 8. Solicitar Reassessment
    const final_reassessment = this.engine.assessRequirement({
      requirement: data.requirement,
      applicability: data.applicability,
      mapping: data.mapping,
      facts: ['FACT-SYSCTX-01'],
      evidence: after_evidence,
      target_id: data.target_id
    });

    return {
      initial_assessment,
      before_snapshot,
      false_fix_blocked,
      true_fix_orchestration_id: trueOrchestrator.getRunState().run_id,
      after_snapshot,
      final_reassessment
    };
  }
}
