/**
 * EOS CORE STORAGE — AUDIT ARTIFACT MIGRATOR (v3.1.1 SOVEREIGN)
 * Explicit, versioned schema migration for AuditArtifact objects (e.g. v1 legacy -> v3.1.1).
 * ISOLATION POLICY: Legacy singular `finding` conversion occurs EXCLUSIVELY in this migrator.
 */

import { AuditArtifact } from './audit-history-repository';

export class AuditArtifactMigrator {
  public static CURRENT_SCHEMA_VERSION = 2;

  public static migrate(artifactRaw: any): AuditArtifact {
    if (!artifactRaw || typeof artifactRaw !== 'object') {
      throw new Error('AUDIT_MIGRATOR_ERROR: Artefato de auditoria inválido ou nulo.');
    }

    const version = artifactRaw.schemaVersion || 1;

    // Migração explícita de Schema v1 (legacy singular finding) para v3.1.1 (findings array plural)
    if (version === 1) {
      if ('findings' in artifactRaw) {
        throw new Error('AUDIT_MIGRATOR_ERROR: Artefato V1 não deve possuir a propriedade plural findings.');
      }

      let findingsList: any[];
      if (artifactRaw.finding === null) {
        // Semanticamente equivalente a "zero findings"
        findingsList = [];
      } else if (artifactRaw.finding && typeof artifactRaw.finding === 'object') {
        findingsList = [artifactRaw.finding];
      } else {
        throw new Error('AUDIT_MIGRATOR_CAUSAL_ERROR: Campo finding ausente ou ambíguo não equivale a um array vazio.');
      }

      const migrated: AuditArtifact = {
        ...artifactRaw,
        schemaVersion: 2,
        findings: findingsList
      };

      // Oculta a propriedade singular legada após migração explícita
      if ('finding' in (migrated as any)) {
        delete (migrated as any).finding;
      }

      return migrated;
    }

    if (version === 2) {
      if (!Array.isArray(artifactRaw.findings)) {
        throw new Error('AUDIT_MIGRATOR_ERROR: Artefato no schema v2 deve conter o array plural findings.');
      }
      return artifactRaw as AuditArtifact;
    }

    throw new Error(`AUDIT_MIGRATOR_ERROR: Schema version '${version}' não é suportada pelo migrador.`);
  }
}
