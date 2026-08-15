/**
 * EOS CONTINUOUS ARCHITECTURE - CANONICAL IDs CONTRACT (v1.0.0)
 * 
 * Centralized Identity Governance for the EOS Domain.
 * Uses TypeScript Branded Types to ensure IDs cannot be mixed up accidentally 
 * (e.g., passing a FactId to a function expecting a FindingId).
 * 
 * Currently enforces generic non-empty string policies since historical 
 * EOS artifacts do not yet follow strict uniform regexes (like FIN-* or EVI-*).
 */

export type TargetId = string & { readonly __brand: 'TargetId' };
export type ExecutionId = string & { readonly __brand: 'ExecutionId' };
export type ArtifactId = string & { readonly __brand: 'ArtifactId' };
export type EvidenceId = string & { readonly __brand: 'EvidenceId' };
export type FactId = string & { readonly __brand: 'FactId' };
export type FindingId = string & { readonly __brand: 'FindingId' };

function assertValidIdString(val: unknown, entity: string): string {
  if (typeof val !== 'string') {
    throw new Error(`Invalid ${entity}: must be a string.`);
  }
  const trimmed = val.trim();
  if (trimmed === '') {
    throw new Error(`Invalid ${entity}: cannot be empty.`);
  }
  return trimmed;
}

// TargetId
export function parseTargetId(val: unknown): TargetId {
  return assertValidIdString(val, 'TargetId') as TargetId;
}
export function isTargetId(val: unknown): val is TargetId {
  return typeof val === 'string' && val.trim() !== '';
}

// ExecutionId
export function parseExecutionId(val: unknown): ExecutionId {
  return assertValidIdString(val, 'ExecutionId') as ExecutionId;
}
export function isExecutionId(val: unknown): val is ExecutionId {
  return typeof val === 'string' && val.trim() !== '';
}

// ArtifactId
export function parseArtifactId(val: unknown): ArtifactId {
  return assertValidIdString(val, 'ArtifactId') as ArtifactId;
}
export function isArtifactId(val: unknown): val is ArtifactId {
  return typeof val === 'string' && val.trim() !== '';
}

// EvidenceId
export function parseEvidenceId(val: unknown): EvidenceId {
  return assertValidIdString(val, 'EvidenceId') as EvidenceId;
}
export function isEvidenceId(val: unknown): val is EvidenceId {
  return typeof val === 'string' && val.trim() !== '';
}

// FactId
export function parseFactId(val: unknown): FactId {
  return assertValidIdString(val, 'FactId') as FactId;
}
export function isFactId(val: unknown): val is FactId {
  return typeof val === 'string' && val.trim() !== '';
}

// FindingId
export function parseFindingId(val: unknown): FindingId {
  return assertValidIdString(val, 'FindingId') as FindingId;
}
export function isFindingId(val: unknown): val is FindingId {
  return typeof val === 'string' && val.trim() !== '';
}
