/**
 * EOS CORE STORAGE — AUDIT ARTIFACT MIGRATOR
 * Handles backward-compatible schema migration for AuditArtifact versions (e.g. v1 -> v2).
 */

import { AuditArtifact } from './audit-history-repository';

export class AuditArtifactMigrator {
  public static CURRENT_SCHEMA_VERSION = 1;

  public static migrate(artifactRaw: any): AuditArtifact {
    if (!artifactRaw || typeof artifactRaw !== 'object') {
      throw new Error('AUDIT_MIGRATOR_ERROR: Artefato inválido ou nulo.');
    }

    const version = artifactRaw.schemaVersion || 1;

    if (version === 1) {
      return artifactRaw as AuditArtifact;
    }

    // Suporte extensível para migração progressiva de schemas futuros
    throw new Error(`AUDIT_MIGRATOR_ERROR: Schema version '${version}' não suportada para migração.`);
  }
}
