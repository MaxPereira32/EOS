/**
 * EOS CORE REPORTERS — JSON AUDIT EXPORTER (v3.0.0 SOVEREIGN)
 * Pure, side-effect free exporter deriving clean JSON and Markdown reports from AuditArtifacts.
 * NO SYMLINKS POLICY: Explicit exporter view for backward compatibility.
 * DETERMINISTIC EXPORT POLICY: Repeat exports over the exact same AuditArtifact produce identical bytes.
 */

import * as fs from 'fs';
import * as path from 'path';
import { AuditArtifact } from '../storage/audit-history-repository';
import { CanonicalHashService } from '../services/canonical-hash-service';

export class JsonAuditExporter {
  /**
   * Converte um AuditArtifact em uma estrutura de exportação determinística.
   */
  public static generateExportPayload(artifact: AuditArtifact): any {
    return {
      $schema: 'https://eos.architecture/schemas/v3/stage05-trend-knowledge.json',
      exporterVersion: '3.0.0',
      artifactId: artifact.artifactId,
      artifactHash: artifact.artifactHash,
      auditRunId: artifact.auditRunId,
      projectId: artifact.projectId,
      createdAt: artifact.createdAt,
      sourceSnapshotHash: artifact.sourceSnapshotHash,
      summary: {
        sourceSnapshot: artifact.sourceSnapshot,
        findingCount: artifact.finding ? 1 : 0,
        evidenceCount: artifact.evidences?.length || 0,
        status: artifact.revalidationProof?.isResolved ? 'RESOLVED' : 'OBSERVED'
      }
    };
  }

  public static exportAuditReport(artifact: AuditArtifact, outputDir?: string): { jsonPath: string; mdPath: string; payloadJson: string } {
    const targetDir = outputDir || path.join(process.cwd(), '.eos');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const payload = this.generateExportPayload(artifact);
    const payloadJson = CanonicalHashService.stringify(payload);

    const jsonPath = path.join(targetDir, 'auditoria.json');
    const mdPath = path.join(targetDir, 'acf-auditoria.md');

    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

    const markdownContent = `# Relatório Exportado de Auditoria EOS v3.0.0

- **Audit Run ID:** \`${artifact.auditRunId}\`
- **Projeto:** \`${artifact.projectId}\`
- **Artifact Hash:** \`${artifact.artifactHash}\`
- **Status:** \`${artifact.revalidationProof?.isResolved ? 'RESOLVED' : 'OBSERVED'}\`
- **Timestamp de Criação:** \`${artifact.createdAt}\`
`;
    fs.writeFileSync(mdPath, markdownContent, 'utf8');

    return { jsonPath, mdPath, payloadJson };
  }
}
