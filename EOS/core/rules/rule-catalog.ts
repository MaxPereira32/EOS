/**
 * EOS ENTERPRISE RULE CATALOG & TAXONOMY REGISTRY (v2.2.0)
 * 
 * Central registry mapping architectural and security rules to standard taxonomies
 * (OWASP Top 10 2021, CWE, CVE, NIST SP 800-53, MITRE ATT&CK).
 */

import { SecurityTaxonomy } from '../domain-graph';

export interface EnterpriseRule {
  rule_id: string;
  name: string;
  description: string;
  category: 'SECURITY' | 'ARCHITECTURE' | 'COMPLIANCE' | 'CODE_QUALITY';
  default_severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  cvss_v4_vector: string;
  taxonomy: SecurityTaxonomy;
  evaluation_method: 'AST_STATIC' | 'DTI_RUNTIME' | 'IAC_TERRAFORM' | 'DEPENDENCY_ANALYSIS';
  aas_skill_ids?: string[];
}

export class RuleCatalog {
  private static rulesMap: Map<string, EnterpriseRule> = new Map();

  static {
    // 1. HTTP TRACE & Session Cookie Security
    RuleCatalog.registerRule({
      rule_id: 'SEC-RULE-309-HTTP-TRACE-PREFIX',
      name: 'HTTP TRACE Method Enabled & Session Cookie Missing Security Prefix',
      description: 'Permite o método HTTP TRACE expondo cookies de sessão sem prefixos obrigatórios __Host- ou __Secure-.',
      category: 'SECURITY',
      default_severity: 'HIGH',
      cvss_v4_vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:N/VA:N/SC:H/SI:N/SA:N',
      taxonomy: {
        owasp_category: 'A05:2021-Security Misconfiguration',
        cwe_id: 'CWE-693: Protection Mechanism Failure',
        cve_ids: [],
        nist_sp_800_53: 'SC-8 PUBLIC ACCESS PROTECTIONS',
        mitre_attack_id: 'T1539 - Steal Web Session Cookie',
      },
      evaluation_method: 'DTI_RUNTIME',
      aas_skill_ids: ['cloudflare-security-audit', 'security-compliance-compliance-check'],
    });

    // 2. Injeção / JWT Inseguro
    RuleCatalog.registerRule({
      rule_id: 'SEC-RULE-401-JWT-ALG-NONE',
      name: 'Insecure JWT Algorithm (alg: none)',
      description: 'Detecção de assinatura nula ou desabilitada em tokens JWT.',
      category: 'SECURITY',
      default_severity: 'CRITICAL',
      cvss_v4_vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:H/SI:H/SA:H',
      taxonomy: {
        owasp_category: 'A02:2021-Cryptographic Failures',
        cwe_id: 'CWE-347: Improper Verification of Cryptographic Signature',
        cve_ids: [],
        nist_sp_800_53: 'IA-5 AUTHENTICATOR MANAGEMENT',
        mitre_attack_id: 'T1550 - Use Alternate Authentication Material',
      },
      evaluation_method: 'DTI_RUNTIME',
      aas_skill_ids: ['nextjs-supabase-auth', 'security-compliance-compliance-check'],
    });

    // 3. Violações Arquiteturais de Acoplamento
    RuleCatalog.registerRule({
      rule_id: 'ARQ-RULE-101-CIRCULAR-DEPENDENCY',
      name: 'Circular Dependency between Domain Modules',
      description: 'Identifica ciclos de acoplamento proibidos entre módulos de arquitetura.',
      category: 'ARCHITECTURE',
      default_severity: 'MEDIUM',
      cvss_v4_vector: 'CVSS:4.0/AV:L/AC:L/AT:N/PR:N/UI:N/VC:L/VI:L/VA:N',
      taxonomy: {
        owasp_category: 'A06:2021-Vulnerable and Outdated Components',
        cwe_id: 'CWE-1061: Insufficient Encapsulation',
        nist_sp_800_53: 'SA-8 SECURITY ENGINEERING PRINCIPLES',
        mitre_attack_id: 'T1195 - Supply Chain Compromise',
      },
      evaluation_method: 'AST_STATIC',
      aas_skill_ids: ['ecl-harness-engineer', 'trpc-fullstack'],
    });

    // 4. Inoculação de Segredos em Código Fonte
    RuleCatalog.registerRule({
      rule_id: 'SEC-RULE-502-HARDCODED-SECRET',
      name: 'Hardcoded API Keys, Passwords or Credentials in Source Code',
      description: 'Credenciais ou chaves privadas detectadas em texto claro dentro de arquivos de código.',
      category: 'SECURITY',
      default_severity: 'CRITICAL',
      cvss_v4_vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:N/SC:H/SI:N/SA:N',
      taxonomy: {
        owasp_category: 'A07:2021-Identification and Authentication Failures',
        cwe_id: 'CWE-798: Use of Hard-coded Credentials',
        nist_sp_800_53: 'IA-2 IDENTIFICATION AND AUTHENTICATION',
        mitre_attack_id: 'T1552 - Unsecured Credentials',
      },
      evaluation_method: 'AST_STATIC',
      aas_skill_ids: ['security-compliance-compliance-check', 'cloudflare-security-audit'],
    });
  }

  public static registerRule(rule: EnterpriseRule): void {
    RuleCatalog.rulesMap.set(rule.rule_id, rule);
  }

  public static getRule(ruleId: string): EnterpriseRule | undefined {
    return RuleCatalog.rulesMap.get(ruleId);
  }

  public static getAllRules(): EnterpriseRule[] {
    return Array.from(RuleCatalog.rulesMap.values());
  }
}
