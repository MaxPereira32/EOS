/**
 * EOS TEST FIXTURES — SAMPLE PIPELINE FIXTURES
 * Isolated test fixtures for integration tests and demonstration scenarios.
 * MUST NEVER BE IMPORTED BY PRODUCTION CORE CODE.
 */

import { Asset, Fact, Threat, Finding } from '../../core/domain-graph';

export const SAMPLE_TEST_ASSET: Asset = {
  asset_id: 'AST-K8S-INGRESS-01',
  name: 'Public Ingress Gateway',
  type: 'NETWORK',
  criticality: { availability: 'CRITICAL', integrity: 'HIGH', confidentiality: 'HIGH' },
  business_impact: { financial: 8.5, legal: 10.0, operational: 9.0, reputation: 9.0 },
  owner: 'SecOps Team',
  tags: ['ingress', 'k8s', 'public-facing'],
};

export const SAMPLE_TEST_FACT: Fact = {
  fact_id: 'FCT-501',
  asset_id: SAMPLE_TEST_ASSET.asset_id,
  fact_type: 'DANGEROUS_HTTP_METHOD_AND_PREFIX_MISSING',
  description: 'Método TRACE habilitado e cookie de sessão sem prefixo __Host- / __Secure-',
  evidence_ids: ['ev-dti-01'],
  is_verified: true,
};

export const SAMPLE_TEST_THREAT: Threat = {
  threat_id: 'TRT-801',
  asset_id: SAMPLE_TEST_ASSET.asset_id,
  fact_ids: [SAMPLE_TEST_FACT.fact_id],
  stride_category: 'INFO_DISCLOSURE',
  attack_vector: 'Cross-Site Tracing (XST) combinado com roubo de cookie de sessão sem prefixo',
};

export const SAMPLE_TEST_FINDING: Finding = {
  finding_id: 'FND-2026-8801',
  asset_id: SAMPLE_TEST_ASSET.asset_id,
  fact_ids: [SAMPLE_TEST_FACT.fact_id],
  rule_id: 'SEC-RULE-309-HTTP-TRACE-PREFIX',
  severity: 'CRITICAL',
  cvss_v4_score: 9.1,
  cvss_v4_vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:N/VA:N/SC:H/SI:N/SA:N',
  taxonomy: {
    owasp_category: 'A05:2021-Security Misconfiguration',
    cwe_id: 'CWE-693',
    nist_sp_800_53: 'SC-8',
    mitre_attack_id: 'T1190'
  },
  title: 'Cross-Site Tracing (XST) via HTTP TRACE & Cookie Inseguro'
};
