/**
 * EOS CORE REPORTERS — JSON AUDIT EXPORTER
 * Exports clean derivative JSON and Markdown reports from sovereign AuditArtifacts.
 * NO SYMLINKS POLICY: Explicit exporter view for backward compatibility.
 */

import * as fs from 'fs';
import * as path from 'path';
import { AuditArtifact } from '../storage/audit-history-repository';

export class JsonAuditExporter {
  public static exportAuditReport(artifact: AuditArtifact, outputDir?: string): { jsonPath: string; mdPath: string } {
    const targetDir = outputDir || path.join(process.cwd(), '.eos');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const exportPayload = {
      $schema: 'https://eos.architecture/schemas/v2/stage05-trend-knowledge.json',
      exporterVersion: '2.5.0',
      exportedAt: new Date().toISOString(),
      artifactId: artifact.artifactId,
      artifactHash: artifact.artifactHash,
      auditRunId: artifact.auditRunId,
      projectId: artifact.projectId,
      summary: {
        sourceSnapshot: artifact.sourceSnapshot,
        findingCount: artifact.finding ? 1 : 0,
        evidenceCount: artifact.evidences?.length || 0,
        status: artifact.revalidationProof?.isResolved ? 'RESOLVED' : 'OBSERVED'
      }
    };

    const jsonPath = path.join(targetDir, 'auditoria.json');
    const mdPath = path.join(targetDir, 'acf-auditoria.md');

    fs.writeFileSync(jsonPath, JSON.stringify(exportPayload, null, 2), 'utf8');

    const markdownContent = `# Relatório Exportado de Auditoria EOS v2.5.0

- **Audit Run ID:** \`${artifact.auditRunId}\`
- **Projeto:** \`${artifact.projectId}\`
- **Artifact Hash:** \`${artifact.artifactHash}\`
- **Status:** \`${artifact.revalidationProof?.isResolved ? 'RESOLVED' : 'OBSERVED'}\`
- **Timestamp:** \`${artifact.createdAt}\`
`;
    fs.writeFileSync(mdPath, markdownContent, 'utf8');

    return { jsonPath, mdPath };
  }
}
