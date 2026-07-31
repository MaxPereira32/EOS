/**
 * EOS ENTERPRISE DOMAIN GRAPH CONTRACTS (v2.0.0)
 */

export type CIA_Level = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

// 1. Tipologia de Ativos Expandida (Problema A)
export type AssetType =
  | 'SERVICE' | 'API' | 'DATABASE' | 'SECRET' | 'CREDENTIAL' 
  | 'CERTIFICATE' | 'STORAGE' | 'QUEUE' | 'TOPIC' | 'CACHE' 
  | 'EXTERNAL_PROVIDER' | 'FILE' | 'CONTAINER' | 'PIPELINE' 
  | 'IAC' | 'IDENTITY' | 'NETWORK' | 'HUMAN_OPERATOR';

export interface CiaTriad {
  confidentiality: CIA_Level;
  integrity: CIA_Level;
  availability: CIA_Level;
}

// Impacto Multidimensional (Problema C)
export interface BusinessImpactDimensions {
  financial: number;   // 1.0 - 10.0
  legal: number;       // 1.0 - 10.0 (LGPD/GDPR/SEC)
  operational: number; // 1.0 - 10.0
  reputation: number;  // 1.0 - 10.0
}

export interface Asset {
  asset_id: string;
  name: string;
  type: AssetType;
  criticality: CiaTriad;
  business_impact: BusinessImpactDimensions;
  owner: string;
  tags: string[];
}

// 2. Entidade Observation (Problema H)
export interface Observation {
  observation_id: string;
  asset_id: string;
  collector_name: 'static-ast' | 'runtime-header' | 'runtime-cookie' | 'runtime-jwt' | 'iac-terraform' | 'network-tls';
  raw_telemetry: Record<string, any>;
  observed_at: string;
}

// 3. Entidade Evidence Rastreável & Pontuação Dupla de Confiabilidade (Problemas E, F & G)
export interface Evidence {
  evidence_id: string;
  observation_id: string;
  collector: string; // Ex: "runtime-header-collector"
  verification_method: 'AST' | 'REGEX_PATTERN' | 'HTTP_RESPONSE_INSPECTION' | 'IAC_PARSER' | 'DYNAMIC_BEHAVIOR';
  verification_hash: string; // Hash SHA-256 da amostra para auditoria reproduzível
  source_location: string;   // Ex: nginx.conf:42 ou HTTP Header "Set-Cookie"
  snippet: string;
  confidence: number;         // 0.00 - 1.00 (Precisão da captura)
  source_reliability: number; // 0.00 - 1.00 (Confiabilidade histórica do detector)
}

// 4. Entidade Fact Sustentada por 1:N Evidências (Problema G)
export interface Fact {
  fact_id: string;
  asset_id: string;
  fact_type: string; // Ex: "MISSING_HTTP_SECURITY_HEADER" ou "INSECURE_SESSION_TIMEOUT"
  description: string;
  evidence_ids: string[]; // Relacionamento Fact 1:N Evidence
  is_verified: boolean;
}

// 5. Threat & Finding
export interface Threat {
  threat_id: string;
  asset_id: string;
  fact_ids: string[];
  stride_category: 'SPOOFING' | 'TAMPERING' | 'REPUDIATION' | 'INFO_DISCLOSURE' | 'DOS' | 'ELEVATION_OF_PRIVILEGE';
  attack_vector: string;
}

export interface SecurityTaxonomy {
  owasp_category: string;
  cwe_id: string;
  cve_ids?: string[];
  nist_sp_800_53: string;
  mitre_attack_id: string;
}

export interface Finding {
  finding_id: string;
  asset_id: string;
  fact_ids: string[];
  rule_id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  cvss_v4_score: number;
  cvss_v4_vector: string;
  taxonomy: SecurityTaxonomy;
}

// 6. Remediação Estruturada
export interface Remediation {
  fix_id: string;
  finding_id: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  estimated_effort_hours: number;
  target_files: string[];
  commit_hint: string;
  breaking_change: boolean;
  patch_diff: string;
}
