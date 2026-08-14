import * as crypto from 'crypto';
import { Evidence, Fact, FACT_SCHEMA_VERSION_1_0, FactPayload } from '../domain/types';
import { canonicalHash } from '../utils/canonical-json';

export class FileStructureFactProvider {
  public static readonly providerId = 'file-structure-fact-provider';
  public static readonly providerVersion = '5.1.0';

  public generateFacts(evidences: readonly Evidence[], requiredDirectory: string = 'src/domain'): Fact[] {
    if (!evidences || evidences.length === 0) {
      const factId = `FCT-FS-${crypto.createHash('sha256').update(`EMPTY:${requiredDirectory}`).digest('hex').slice(0, 12)}`;
      const payload: FactPayload = Object.freeze({
        fact_type: 'FILE_STRUCTURE' as const,
        directory: requiredDirectory,
        naming_convention: 'clean-architecture-domain',
        status: 'INSUFFICIENT_EVIDENCE' as const,
      });
      const semanticHash = canonicalHash(payload);

      return [
        Object.freeze({
          fact_id: factId,
          schema_version: FACT_SCHEMA_VERSION_1_0,
          fact_type: 'FILE_STRUCTURE',
          provider_id: FileStructureFactProvider.providerId,
          provider_version: FileStructureFactProvider.providerVersion,
          evidence_ids: Object.freeze(['EVD-NONE']),
          input_hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
          semantic_hash: semanticHash,
          lifecycle_status: 'VALID',
          payload,
          composite_confidence: 0.0,
          created_at: new Date().toISOString(),
        }),
      ];
    }

    // Ordenação determinística das evidências de entrada para cálculo do input_hash
    const sortedEvidences = [...evidences].sort((a, b) => a.evidence_id.localeCompare(b.evidence_id));
    const inputHashContent = sortedEvidences.map(e => `${e.evidence_id}:${e.content_hash}:${e.source_reference}`).join('|');
    const inputHash = crypto.createHash('sha256').update(inputHashContent).digest('hex');

    const matchingEvidence = sortedEvidences.filter(e => {
      const normalizedPath = e.locator.relative_path.replace(/\\/g, '/');
      const normalizedTarget = requiredDirectory.replace(/\\/g, '/');
      return normalizedPath.startsWith(normalizedTarget + '/') || normalizedPath === normalizedTarget;
    });

    const isPresent = matchingEvidence.length > 0;
    const usedEvidenceIds = Object.freeze(isPresent ? matchingEvidence.map(e => e.evidence_id) : sortedEvidences.slice(0, 10).map(e => e.evidence_id));

    const status: 'PRESENT' | 'ABSENCE_VERIFIED' = isPresent ? 'PRESENT' : 'ABSENCE_VERIFIED';
    const factIdSeed = `${FileStructureFactProvider.providerId}:${requiredDirectory}:${status}:${inputHash}`;
    const factId = `FCT-FS-${crypto.createHash('sha256').update(factIdSeed).digest('hex').slice(0, 12)}`;

    const payload: FactPayload = Object.freeze({
      fact_type: 'FILE_STRUCTURE' as const,
      directory: requiredDirectory,
      naming_convention: 'clean-architecture-domain',
      status,
    });
    const semanticHash = canonicalHash(payload);

    return [
      Object.freeze({
        fact_id: factId,
        schema_version: FACT_SCHEMA_VERSION_1_0,
        fact_type: 'FILE_STRUCTURE',
        provider_id: FileStructureFactProvider.providerId,
        provider_version: FileStructureFactProvider.providerVersion,
        evidence_ids: usedEvidenceIds,
        input_hash: inputHash,
        semantic_hash: semanticHash,
        lifecycle_status: 'VALID',
        payload,
        composite_confidence: 1.0,
        created_at: new Date().toISOString(),
      }),
    ];
  }
}
