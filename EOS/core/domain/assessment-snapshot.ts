/**
 * EOS CONTINUOUS ARCHITECTURE - ASSESSMENT SNAPSHOT CONTRACT (v2.0.0)
 * 
 * Contrato genérico e rigoroso de prova de auditoria e remediação.
 * Sela criptograficamente e mecanicamente o estado de um alvo no tempo.
 */

import * as crypto from 'crypto';
import { 
  TargetId, 
  ExecutionId, 
  EvidenceId, 
  FactId, 
  FindingId,
  parseTargetId,
  parseExecutionId,
  parseEvidenceId,
  parseFactId,
  parseFindingId
} from './canonical-ids';

export type VerificationStatus = 'VERIFIED' | 'NOT_VERIFIED' | 'PARTIALLY_VERIFIED' | 'NON_COMPLIANT' | 'NOT_APPLICABLE' | 'UNKNOWN';

export type TargetType = 'SOURCE_CODE' | 'ARTIFACT' | 'RUNTIME' | 'UNKNOWN';

export interface SnapshotProvenance {
  readonly execution_id: ExecutionId;
  readonly executed_at: string; // ISO-8601
  readonly eos_version: string;
  readonly tool_or_collector: string;
  readonly target_type: TargetType;
  readonly git_commit?: string; // Obrigatório para SOURCE_CODE
  readonly target_version?: string;
  readonly artifact_hash?: string; // Obrigatório para ARTIFACT
}

export interface SnapshotComparisonResult {
  readonly target_id_match: boolean;
  readonly temporal_order_valid: boolean;
  readonly execution_changed: boolean;
  readonly stale_evidence_reused: boolean;

  readonly resolved_target_finding_ids: readonly FindingId[];
  readonly persisting_target_finding_ids: readonly FindingId[];
  readonly new_finding_ids: readonly FindingId[];

  readonly overall_resolution_status: 'RESOLVED' | 'PARTIALLY_RESOLVED' | 'NOT_RESOLVED' | 'INVALID_COMPARISON';
}

export class AssessmentSnapshot {
  public readonly snapshot_id: string;
  public readonly snapshot_type: 'BEFORE_REMEDIATION' | 'AFTER_REMEDIATION' | 'BASELINE' | 'ROUTINE';
  public readonly target_id: TargetId;
  
  public readonly evidence_ids: readonly EvidenceId[];
  public readonly fact_ids: readonly FactId[];
  public readonly finding_ids: readonly FindingId[];
  
  public readonly risk_level: string;
  public readonly verification_status: VerificationStatus;
  public readonly provenance: SnapshotProvenance;

  public readonly snapshot_hash: string;

  constructor(data: {
    snapshot_type: 'BEFORE_REMEDIATION' | 'AFTER_REMEDIATION' | 'BASELINE' | 'ROUTINE';
    target_id: string | TargetId;
    evidence_ids: (string | EvidenceId)[];
    fact_ids: (string | FactId)[];
    finding_ids: (string | FindingId)[];
    risk_level: string;
    verification_status: VerificationStatus;
    provenance: {
      execution_id: string | ExecutionId;
      executed_at: string;
      eos_version: string;
      tool_or_collector: string;
      target_type: TargetType;
      git_commit?: string;
      target_version?: string;
      artifact_hash?: string;
    };
  }) {
    this.snapshot_type = data.snapshot_type;
    this.target_id = parseTargetId(data.target_id);
    this.evidence_ids = Object.freeze(data.evidence_ids.map(parseEvidenceId));
    this.fact_ids = Object.freeze(data.fact_ids.map(parseFactId));
    this.finding_ids = Object.freeze(data.finding_ids.map(parseFindingId));
    this.risk_level = data.risk_level;
    this.verification_status = data.verification_status;
    
    // Temporal validation
    const date = new Date(data.provenance.executed_at);
    if (isNaN(date.getTime())) {
      throw new Error('AssessmentSnapshot Error: executed_at deve ser uma data ISO-8601 válida.');
    }

    // Target Provenance Policy
    if (data.provenance.target_type === 'SOURCE_CODE' && (!data.provenance.git_commit || data.provenance.git_commit.trim() === '')) {
      throw new Error('AssessmentSnapshot Error: git_commit is REQUIRED for SOURCE_CODE targets.');
    }
    if (data.provenance.target_type === 'ARTIFACT' && (!data.provenance.artifact_hash || data.provenance.artifact_hash.trim() === '')) {
      throw new Error('AssessmentSnapshot Error: artifact_hash is REQUIRED for ARTIFACT targets.');
    }
    if (data.provenance.target_type === 'UNKNOWN' && data.verification_status !== 'NOT_VERIFIED') {
      throw new Error('AssessmentSnapshot Error: UNKNOWN target_type can only have NOT_VERIFIED status.');
    }

    this.provenance = Object.freeze({
      execution_id: parseExecutionId(data.provenance.execution_id),
      executed_at: date.toISOString(),
      eos_version: data.provenance.eos_version,
      tool_or_collector: data.provenance.tool_or_collector,
      target_type: data.provenance.target_type,
      git_commit: data.provenance.git_commit,
      target_version: data.provenance.target_version,
      artifact_hash: data.provenance.artifact_hash
    });

    this.snapshot_hash = this.generateHash();
    this.snapshot_id = `SNP-${this.snapshot_hash.substring(0, 16)}`;

    Object.freeze(this);
  }

  private generateHash(): string {
    const seed = [
      this.snapshot_type,
      this.target_id,
      [...this.evidence_ids].sort().join(','),
      [...this.fact_ids].sort().join(','),
      [...this.finding_ids].sort().join(','),
      this.risk_level,
      this.verification_status,
      this.provenance.execution_id,
      this.provenance.executed_at,
      this.provenance.eos_version,
      this.provenance.tool_or_collector,
      this.provenance.target_type,
      this.provenance.git_commit || '',
      this.provenance.target_version || '',
      this.provenance.artifact_hash || ''
    ].join('|');

    return crypto.createHash('sha256').update(seed).digest('hex');
  }

  /**
   * Avalia comparativamente e produz fatos mecânicos de resolução de findings.
   * Não emite juízos de política sobre a gravidade de regressões.
   */
  public static compare(
    before: AssessmentSnapshot, 
    after: AssessmentSnapshot,
    target_finding_ids: readonly FindingId[]
  ): SnapshotComparisonResult {
    
    if (before.snapshot_type !== 'BEFORE_REMEDIATION' && before.snapshot_type !== 'BASELINE') {
      throw new Error('AssessmentSnapshot Error: O primeiro parâmetro deve ser o estado anterior.');
    }
    if (after.snapshot_type !== 'AFTER_REMEDIATION' && after.snapshot_type !== 'ROUTINE') {
      throw new Error('AssessmentSnapshot Error: O segundo parâmetro deve ser o estado posterior.');
    }

    if (target_finding_ids.length === 0) {
      throw new Error('AssessmentSnapshot Error: Escopo de remediação ausente (target_finding_ids vazio).');
    }

    for (const tid of target_finding_ids) {
      if (!before.finding_ids.includes(tid)) {
        throw new Error(`AssessmentSnapshot Error: Finding alvo ${tid} não existe no estado BEFORE.`);
      }
    }

    // Invariantes estritas
    const target_id_match = before.target_id === after.target_id;
    if (!target_id_match) {
      throw new Error('TARGET_MISMATCH: Tentativa de comparar dois alvos distintos.');
    }

    const tBefore = new Date(before.provenance.executed_at).getTime();
    const tAfter = new Date(after.provenance.executed_at).getTime();
    const temporal_order_valid = tAfter > tBefore;

    if (!temporal_order_valid) {
      throw new Error('INVALID_TEMPORAL_ORDER: O snapshot AFTER deve ser estritamente posterior ao BEFORE.');
    }

    const execution_changed = before.provenance.execution_id !== after.provenance.execution_id;
    if (!execution_changed && after.snapshot_type === 'AFTER_REMEDIATION') {
      throw new Error('INVALID_EXECUTION_STATE: Snapshot de remediação exige uma nova execução.');
    }

    // Fact generation
    const resolved_target_finding_ids: FindingId[] = [];
    const persisting_target_finding_ids: FindingId[] = [];
    
    for (const tid of target_finding_ids) {
      if (after.finding_ids.includes(tid)) {
        persisting_target_finding_ids.push(tid);
      } else {
        resolved_target_finding_ids.push(tid);
      }
    }

    const new_finding_ids: FindingId[] = after.finding_ids.filter(id => !before.finding_ids.includes(id));
    
    const stale_evidence_reused = after.evidence_ids.some(id => before.evidence_ids.includes(id));

    let overall_resolution_status: SnapshotComparisonResult['overall_resolution_status'] = 'NOT_RESOLVED';
    
    if (stale_evidence_reused) {
      overall_resolution_status = 'INVALID_COMPARISON';
    } else if (resolved_target_finding_ids.length === target_finding_ids.length) {
      overall_resolution_status = 'RESOLVED';
    } else if (resolved_target_finding_ids.length > 0) {
      overall_resolution_status = 'PARTIALLY_RESOLVED';
    }

    return Object.freeze({
      target_id_match,
      temporal_order_valid,
      execution_changed,
      stale_evidence_reused,
      resolved_target_finding_ids: Object.freeze(resolved_target_finding_ids),
      persisting_target_finding_ids: Object.freeze(persisting_target_finding_ids),
      new_finding_ids: Object.freeze(new_finding_ids),
      overall_resolution_status
    });
  }
}
