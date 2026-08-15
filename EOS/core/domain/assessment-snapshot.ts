/**
 * EOS CONTINUOUS ARCHITECTURE - ASSESSMENT SNAPSHOT CONTRACT (v1.0.0)
 * 
 * Contrato de Domínio genérico para encapsular o estado sistêmico (Auditoria) 
 * de um artefato ou ambiente em um momento específico do tempo.
 * 
 * Fundamental para provar se uma Remediação realmente resolveu uma Vulnerabilidade/Finding,
 * comparando o snapshot BEFORE (com findings e evidências do problema) 
 * contra o snapshot AFTER (com fatos e evidências atestando a correção).
 */

import * as crypto from 'crypto';

export type VerificationStatus = 'VERIFIED' | 'NOT_VERIFIED' | 'PARTIALLY_VERIFIED' | 'NON_COMPLIANT' | 'NOT_APPLICABLE' | 'UNKNOWN';

export interface SnapshotProvenance {
  readonly execution_id: string;
  readonly executed_at: string;
  readonly eos_version: string;
  readonly tool_or_collector: string;
}

export class AssessmentSnapshot {
  public readonly snapshot_id: string;
  public readonly snapshot_type: 'BEFORE_REMEDIATION' | 'AFTER_REMEDIATION' | 'BASELINE' | 'ROUTINE';
  public readonly target_id: string;
  
  // Entidades canônicas do EOS referenciadas por ID tipado
  public readonly evidence_ids: readonly string[];
  public readonly fact_ids: readonly string[];
  public readonly finding_ids: readonly string[];
  
  public readonly risk_level: string;
  public readonly verification_status: VerificationStatus;
  public readonly provenance: SnapshotProvenance;

  public readonly snapshot_hash: string;

  constructor(data: {
    snapshot_type: 'BEFORE_REMEDIATION' | 'AFTER_REMEDIATION' | 'BASELINE' | 'ROUTINE';
    target_id: string;
    evidence_ids: string[];
    fact_ids: string[];
    finding_ids: string[];
    risk_level: string;
    verification_status: VerificationStatus;
    provenance: SnapshotProvenance;
  }) {
    if (!data.target_id || data.target_id.trim() === '') {
      throw new Error('AssessmentSnapshot Error: target_id obrigatório.');
    }
    if (!data.provenance || !data.provenance.execution_id) {
      throw new Error('AssessmentSnapshot Error: Proveniência estrita é obrigatória.');
    }

    this.snapshot_type = data.snapshot_type;
    this.target_id = data.target_id;
    this.evidence_ids = Object.freeze([...data.evidence_ids]);
    this.fact_ids = Object.freeze([...data.fact_ids]);
    this.finding_ids = Object.freeze([...data.finding_ids]);
    this.risk_level = data.risk_level;
    this.verification_status = data.verification_status;
    this.provenance = Object.freeze({ ...data.provenance });

    // Determina integridade unificando os IDs. Garante imutabilidade semântica do estado aferido.
    this.snapshot_hash = this.generateHash();
    
    // IDs como SNP-[HASH]
    this.snapshot_id = `SNP-${this.snapshot_hash.substring(0, 16)}`;

    Object.freeze(this);
  }

  private generateHash(): string {
    const seed = [
      this.snapshot_type,
      this.target_id,
      this.evidence_ids.join(','),
      this.fact_ids.join(','),
      this.finding_ids.join(','),
      this.risk_level,
      this.verification_status,
      this.provenance.execution_id,
      this.provenance.executed_at
    ].join('|');

    return crypto.createHash('sha256').update(seed).digest('hex');
  }

  /**
   * Avalia comparativamente se houve redução do estado de risco e achados entre dois snapshots.
   * Regra de Negócio Central do EOS: BEFORE não pode usar as mesmas Evidências do AFTER.
   */
  public static compare(before: AssessmentSnapshot, after: AssessmentSnapshot): { 
    resolved: boolean; 
    regression: boolean; 
    stale_evidence_reused: boolean;
  } {
    if (before.snapshot_type !== 'BEFORE_REMEDIATION' && before.snapshot_type !== 'BASELINE') {
      throw new Error('AssessmentSnapshot Error: O primeiro parâmetro deve ser estado anterior.');
    }
    if (after.snapshot_type !== 'AFTER_REMEDIATION' && after.snapshot_type !== 'ROUTINE') {
      throw new Error('AssessmentSnapshot Error: O segundo parâmetro deve ser estado posterior.');
    }

    // Regra estrita nº 15 do Prompt Master: "Não reutilizar Evidence antiga como prova pós-correção."
    const staleEvidenceReused = after.evidence_ids.some(id => before.evidence_ids.includes(id));
    
    // Verifica regresso: se há um Finding novo que não existia no Before.
    const regression = after.finding_ids.some(id => !before.finding_ids.includes(id));
    
    // Sucesso: não há findings ativos relacionados ao escopo e não usou evidência antiga
    const resolved = after.finding_ids.length === 0 && !regression && !staleEvidenceReused;

    return { resolved, regression, stale_evidence_reused: staleEvidenceReused };
  }
}
