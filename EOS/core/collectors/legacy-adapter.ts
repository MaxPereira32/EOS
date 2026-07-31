/**
 * EOS LEGACY COLLECTORS ADAPTER BRIDGE (v2.2.0)
 * 
 * Bridges legacy collector outputs (eslint, depcruise, vitest, phpunit)
 * into v2.0 domain graph Observation and Evidence entities.
 */

import { Observation, Evidence } from '../domain-graph';

export interface LegacyEslintOutput {
  filePath: string;
  messages: Array<{
    line: number;
    column: number;
    ruleId: string;
    message: string;
    severity: number;
  }>;
}

export class LegacyCollectorAdapter {
  /**
   * Converte a saída de relatórios ESLint para Observações e Evidências v2.0
   */
  public adaptEslintReport(assetId: string, report: LegacyEslintOutput[]): {
    observations: Observation[];
    evidences: Evidence[];
  } {
    const observations: Observation[] = [];
    const evidences: Evidence[] = [];

    report.forEach((fileReport, fIdx) => {
      const obsId = `OBS-ESLINT-${Date.now()}-${fIdx}`;

      fileReport.messages.forEach((msg, mIdx) => {
        const evId = `EVD-ESLINT-${Date.now()}-${fIdx}-${mIdx}`;
        evidences.push({
          evidence_id: evId,
          observation_id: obsId,
          collector: 'eslint-legacy-collector',
          verification_method: 'AST',
          verification_hash: `sha256:eslint-${fileReport.filePath}:${msg.line}:${msg.ruleId}`,
          source_location: `${fileReport.filePath}:${msg.line}:${msg.column}`,
          snippet: `[${msg.ruleId}] ${msg.message}`,
          confidence: 0.95,
          source_reliability: 0.90,
        });
      });

      observations.push({
        observation_id: obsId,
        asset_id: assetId,
        collector_name: 'static-ast',
        raw_telemetry: fileReport,
        observed_at: new Date().toISOString(),
      });
    });

    return { observations, evidences };
  }
}
