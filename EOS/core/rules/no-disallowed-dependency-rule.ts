import { Fact, AuditTarget, RuleEvaluationResult, Finding } from '../domain/types';

/**
 * Normalização semântica da identidade de módulo para avaliação de regras arquiteturais.
 * Resiliência a casing no Windows sem alterar caminhos físicos originais.
 */
export function normalizeModuleIdentity(modulePath: string): string {
  if (!modulePath) return '';
  let normalized = modulePath.replace(/\\/g, '/');
  normalized = normalized.replace(/\/+/g, '/');
  return normalized.toLowerCase();
}

export class NoDisallowedDependencyRule {
  public static readonly ruleId = 'ARCH-RULE-002-NO-DOMAIN-TO-INFRA-DEPENDENCY';
  public static readonly ruleVersion = '4.6.0';

  public evaluate(facts: readonly Fact[], target: AuditTarget): { evaluation: RuleEvaluationResult; findings: Finding[] } {
    const depFacts = facts.filter(f => f.payload.fact_type === 'MODULE_DEPENDENCY');

    if (depFacts.length === 0) {
      return {
        evaluation: {
          rule_id: NoDisallowedDependencyRule.ruleId,
          rule_version: NoDisallowedDependencyRule.ruleVersion,
          status: 'PASS',
          rationale: 'Nenhuma dependência proibida entre módulos foi detectada.',
          facts_used: [],
        },
        findings: [],
      };
    }

    const violations: Fact[] = [];
    const uncertainFacts: Fact[] = [];

    for (const fact of depFacts) {
      if (fact.payload.fact_type !== 'MODULE_DEPENDENCY') continue;
      const { source_module, target_module, resolution_kind } = fact.payload;

      // Preservação da Incerteza: UNRESOLVED / AMBIGUOUS não pode gerar PASS
      if (resolution_kind === 'UNRESOLVED' || resolution_kind === 'AMBIGUOUS') {
        uncertainFacts.push(fact);
        continue;
      }

      const canonicalSource = normalizeModuleIdentity(source_module);
      const canonicalTarget = normalizeModuleIdentity(target_module);

      // Clean Architecture: Domínio (src/domain/...) NUNCA pode depender de Infraestrutura (src/infrastructure/..., src/infra/..., src/collectors/...)
      const isSourceDomain = canonicalSource.includes('/domain/') || canonicalSource.startsWith('domain/') || canonicalSource.startsWith('src/domain/');
      const isTargetInfra = (
        canonicalTarget.includes('/infrastructure/') ||
        canonicalTarget.includes('/infra/') ||
        canonicalTarget.includes('/collectors/') ||
        canonicalTarget.startsWith('infrastructure/') ||
        canonicalTarget.startsWith('infra/') ||
        canonicalTarget.startsWith('collectors/') ||
        canonicalTarget.startsWith('src/infrastructure/') ||
        canonicalTarget.startsWith('src/infra/') ||
        canonicalTarget.startsWith('src/collectors/')
      );

      if (isSourceDomain && isTargetInfra) {
        violations.push(fact);
      }
    }

    if (violations.length > 0) {
      const findings: Finding[] = violations.map(v => {
        const payload = v.payload as Extract<Fact['payload'], { fact_type: 'MODULE_DEPENDENCY' }>;
        return {
          finding_id: `FND-DEP-${v.fact_id.slice(-8)}`,
          rule_id: NoDisallowedDependencyRule.ruleId,
          rule_version: NoDisallowedDependencyRule.ruleVersion,
          fact_ids: [v.fact_id],
          evidence_ids: [...v.evidence_ids],
          target_id: target.target_id,
          location: payload.source_module,
          title: `Violação de Camada: Domínio depende de Infraestrutura (${payload.source_module} -> ${payload.target_module})`,
          description: `A Clean Architecture proíbe que a camada de Domínio (${payload.source_module}) dependa de detalhes de Infraestrutura (${payload.target_module}).`,
          severity: 'HIGH',
          confidence: 1.0,
          status: 'OPEN',
          timestamp: new Date().toISOString(),
        };
      });

      return {
        evaluation: {
          rule_id: NoDisallowedDependencyRule.ruleId,
          rule_version: NoDisallowedDependencyRule.ruleVersion,
          status: 'FAIL',
          rationale: `Violação Arquitetural: ${violations.length} dependência(s) proibida(s) de Domínio para Infraestrutura foram encontradas.`,
          facts_used: violations.map(v => v.fact_id),
        },
        findings: findings,
      };
    }

    // Se houver fatos incertos (UNRESOLVED ou AMBIGUOUS) e nenhuma violação explícita, retorne INSUFFICIENT_EVIDENCE
    if (uncertainFacts.length > 0) {
      return {
        evaluation: {
          rule_id: NoDisallowedDependencyRule.ruleId,
          rule_version: NoDisallowedDependencyRule.ruleVersion,
          status: 'INSUFFICIENT_EVIDENCE',
          rationale: `Evidência Insuficiente: Existem ${uncertainFacts.length} dependência(s) com resolução incerta (UNRESOLVED ou AMBIGUOUS) que não puderam ser verificadas com certeza semântica.`,
          facts_used: uncertainFacts.map(f => f.fact_id),
        },
        findings: [],
      };
    }

    return {
      evaluation: {
        rule_id: NoDisallowedDependencyRule.ruleId,
        rule_version: NoDisallowedDependencyRule.ruleVersion,
        status: 'PASS',
        rationale: 'Conformidade de Camadas: Nenhuma dependência indevida de Domínio para Infraestrutura foi encontrada.',
        facts_used: depFacts.map(f => f.fact_id),
      },
      findings: [],
    };
  }
}
