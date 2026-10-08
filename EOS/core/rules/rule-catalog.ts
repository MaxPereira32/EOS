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

    // 5. Catálogo do motor estático de apps geradas/backend Python
    // (EOS/core/engines/generated-app-security-engine.ts). Centralizado aqui para
    // que os findings e o MCP `eos_check_rules` compartilhem a mesma taxonomia.
    const generatedAppRules: readonly EnterpriseRule[] = [
      {
        rule_id: 'EOS-GENAI-RLS-001',
        name: 'Supabase Access Policy Not Verifiable Statically',
        description: 'Integração Supabase observada sem política RLS verificável no escopo estático.',
        category: 'SECURITY',
        default_severity: 'MEDIUM',
        cvss_v4_vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N',
        taxonomy: {
          owasp_category: 'A01:2021-Broken Access Control',
          cwe_id: 'CWE-284: Improper Access Control',
          cve_ids: [],
          nist_sp_800_53: 'AC-3 ACCESS ENFORCEMENT',
          mitre_attack_id: 'T1190 - Exploit Public-Facing Application',
        },
        evaluation_method: 'DTI_RUNTIME',
      },
      {
        rule_id: 'EOS-GENAI-RLS-002',
        name: 'Firebase Rules Not Verifiable Statically',
        description: 'Uso de Firebase/Firestore sem regras de acesso verificáveis no escopo auditado.',
        category: 'SECURITY',
        default_severity: 'CRITICAL',
        cvss_v4_vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:N/SC:H/SI:H/SA:N',
        taxonomy: {
          owasp_category: 'A01:2021-Broken Access Control',
          cwe_id: 'CWE-284: Improper Access Control',
          cve_ids: [],
          nist_sp_800_53: 'AC-3 ACCESS ENFORCEMENT',
          mitre_attack_id: 'T1190 - Exploit Public-Facing Application',
        },
        evaluation_method: 'DTI_RUNTIME',
      },
      {
        rule_id: 'EOS-GENAI-AUTHZ-001',
        name: 'Authorization Appears to Exist Only in the Frontend',
        description: 'Decisão de role/tenant no cliente sem enforcement de servidor observável.',
        category: 'SECURITY',
        default_severity: 'HIGH',
        cvss_v4_vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N',
        taxonomy: {
          owasp_category: 'A01:2021-Broken Access Control',
          cwe_id: 'CWE-602: Client-Side Enforcement of Server-Side Security',
          cve_ids: [],
          nist_sp_800_53: 'AC-3 ACCESS ENFORCEMENT',
          mitre_attack_id: 'T1190 - Exploit Public-Facing Application',
        },
        evaluation_method: 'AST_STATIC',
      },
      {
        rule_id: 'EOS-GENAI-IDOR-001',
        name: 'ID Lookup Without Owner or Tenant Binding',
        description: 'Consulta por ID sem vínculo de proprietário/tenant no predicado.',
        category: 'SECURITY',
        default_severity: 'HIGH',
        cvss_v4_vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:N/VA:N/SC:H/SI:N/SA:N',
        taxonomy: {
          owasp_category: 'A01:2021-Broken Access Control',
          cwe_id: 'CWE-639: Authorization Bypass Through User-Controlled Key',
          cve_ids: [],
          nist_sp_800_53: 'AC-3 ACCESS ENFORCEMENT',
          mitre_attack_id: 'T1190 - Exploit Public-Facing Application',
        },
        evaluation_method: 'AST_STATIC',
      },
      {
        rule_id: 'EOS-GENAI-SECRET-001',
        name: 'Possible Embedded Secret or API Key',
        description: 'Segredo literal detectado em código ou arquivo de configuração do escopo auditado.',
        category: 'SECURITY',
        default_severity: 'CRITICAL',
        cvss_v4_vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:N/SC:H/SI:N/SA:N',
        taxonomy: {
          owasp_category: 'A07:2021-Identification and Authentication Failures',
          cwe_id: 'CWE-798: Use of Hard-coded Credentials',
          cve_ids: [],
          nist_sp_800_53: 'IA-5 AUTHENTICATOR MANAGEMENT',
          mitre_attack_id: 'T1552 - Unsecured Credentials',
        },
        evaluation_method: 'AST_STATIC',
      },
      {
        rule_id: 'EOS-GENAI-INPUT-001',
        name: 'User Input Without Observable Validation',
        description: 'Dados controlados pelo usuário entram no fluxo sem contrato de validação observável.',
        category: 'SECURITY',
        default_severity: 'HIGH',
        cvss_v4_vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:H/VA:N/SC:N/SI:N/SA:N',
        taxonomy: {
          owasp_category: 'A03:2021-Injection',
          cwe_id: 'CWE-20: Improper Input Validation',
          cve_ids: [],
          nist_sp_800_53: 'SI-10 INFORMATION INPUT VALIDATION',
          mitre_attack_id: 'T1190 - Exploit Public-Facing Application',
        },
        evaluation_method: 'AST_STATIC',
      },
      {
        rule_id: 'EOS-GENAI-UPLOAD-001',
        name: 'Upload Without Observable Type/Signature/Size Validation',
        description: 'Upload sem validação observável de MIME, assinatura ou limite de tamanho.',
        category: 'SECURITY',
        default_severity: 'HIGH',
        cvss_v4_vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:H/VA:N/SC:N/SI:H/SA:N',
        taxonomy: {
          owasp_category: 'A04:2021-Insecure Design',
          cwe_id: 'CWE-434: Unrestricted Upload of File with Dangerous Type',
          cve_ids: [],
          nist_sp_800_53: 'SI-10 INFORMATION INPUT VALIDATION',
          mitre_attack_id: 'T1190 - Exploit Public-Facing Application',
        },
        evaluation_method: 'AST_STATIC',
      },
      {
        rule_id: 'EOS-GENAI-PY-OPTIONAL-WRITE-001',
        name: 'Write Route Allows Anonymous Session Without Local Authorization',
        description: 'Rota de escrita com @jwt_required(optional=True) sem checagem local de dono/papel.',
        category: 'SECURITY',
        default_severity: 'MEDIUM',
        cvss_v4_vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N',
        taxonomy: {
          owasp_category: 'A01:2021-Broken Access Control',
          cwe_id: 'CWE-306: Missing Authentication for Critical Function',
          cve_ids: [],
          nist_sp_800_53: 'AC-3 ACCESS ENFORCEMENT',
          mitre_attack_id: 'T1190 - Exploit Public-Facing Application',
        },
        evaluation_method: 'AST_STATIC',
      },
      {
        rule_id: 'EOS-GENAI-PY-MASSASSIGN-001',
        name: 'Request-Controlled Mass Assignment',
        description: 'Campos da requisição são aceitos dinamicamente e encaminhados ao construtor do modelo.',
        category: 'SECURITY',
        default_severity: 'HIGH',
        cvss_v4_vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:H/VA:N/SC:N/SI:H/SA:N',
        taxonomy: {
          owasp_category: 'A08:2021-Software and Data Integrity Failures',
          cwe_id: 'CWE-915: Improperly Controlled Modification of Dynamically-Determined Object Attributes',
          cve_ids: [],
          nist_sp_800_53: 'SI-10 INFORMATION INPUT VALIDATION',
          mitre_attack_id: 'T1565 - Data Manipulation',
        },
        evaluation_method: 'AST_STATIC',
      },
      {
        rule_id: 'EOS-GENAI-PY-UPLOAD-AUTHZ-001',
        name: 'Optional-Auth Upload Without Resource Authorization',
        description: 'Upload em rota com autenticação opcional sem verificação local de propriedade/associação.',
        category: 'SECURITY',
        default_severity: 'HIGH',
        cvss_v4_vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:N/VI:H/VA:N/SC:N/SI:N/SA:N',
        taxonomy: {
          owasp_category: 'A01:2021-Broken Access Control',
          cwe_id: 'CWE-862: Missing Authorization',
          cve_ids: [],
          nist_sp_800_53: 'AC-3 ACCESS ENFORCEMENT',
          mitre_attack_id: 'T1190 - Exploit Public-Facing Application',
        },
        evaluation_method: 'AST_STATIC',
      },
    ];
    for (const rule of generatedAppRules) RuleCatalog.registerRule(rule);
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
