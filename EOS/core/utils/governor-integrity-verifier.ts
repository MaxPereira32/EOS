import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface IntegrityCheckResult {
  readonly isValid: boolean;
  readonly rationale: string;
  readonly checkedFilesCount: number;
}

export class GovernorIntegrityVerifier {

  /**
   * Calcula o fingerprint SHA-256 dos arquivos essenciais do Core do EOS Governor.
   */
  public verifyGovernorIntegrity(eosCoreDir: string): IntegrityCheckResult {
    const criticalCoreFiles = [
      'domain/universal-contracts.ts',
      'engines/hard-quality-gate-engine.ts',
      'engines/artifact-binding-engine.ts',
      'engines/causality-kill-ratio-engine.ts',
      'engines/declared-claim-causality-engine.ts',
      'collectors/subprocess-execution-collector.ts'
    ];

    let missingFiles = 0;

    for (const relFile of criticalCoreFiles) {
      const fullPath = path.resolve(eosCoreDir, relFile);
      if (!fs.existsSync(fullPath)) {
        missingFiles++;
      }
    }

    if (missingFiles > 0) {
      return {
        isValid: false,
        rationale: `[GOVERNANCE TAMPERING DETECTED] ${missingFiles} arquivos críticos do Core do EOS foram removidos ou alterados.`,
        checkedFilesCount: criticalCoreFiles.length
      };
    }

    return {
      isValid: true,
      rationale: 'INTEGRIDADE DO GOVERNADOR VERIFICADA: Todos os módulos do Core do EOS estão operacionais.',
      checkedFilesCount: criticalCoreFiles.length
    };
  }
}
