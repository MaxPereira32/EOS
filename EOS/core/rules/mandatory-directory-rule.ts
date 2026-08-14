import * as crypto from 'crypto';
import { Fact, RuleEvaluationResult, Finding, AuditTarget } from '../domain/types';

export class MandatoryDirectoryRule {
  public static readonly ruleId = 'ARCH-RULE-001-MANDATORY-DOMAIN-DIR';
  public static readonly ruleVersion = '3.0.0';

  public evaluate(facts: readonly Fact[], target: AuditTarget): { evaluation: RuleEvaluationResult; finding?: Finding } {
    const fsFacts = facts.filter(f => f.payload.fact_type === 'FILE_STRUCTURE');

    if (fsFacts.length === 0) {
      const evaluation: RuleEvaluationResult = {
        rule_id: MandatoryDirectoryRule.ruleId,
        rule_version: MandatoryDirectoryRule.ruleVersion,
        status: 'INSUFFICIENT_EVIDENCE',
        rationale: 'Nenhum Fato de estrutura de arquivos foi fornecido para avaliação.',
        facts_used: [],
      };
      return { evaluation };
    }

    const domainFact = fsFacts.find(f => f.payload.fact_type === 'FILE_STRUCTURE' && f.payload.directory === 'src/domain') || fsFacts[0];
    if (domainFact.payload.fact_type !== 'FILE_STRUCTURE') {
      return {
        evaluation: {
          rule_id: MandatoryDirectoryRule.ruleId,
          rule_version: MandatoryDirectoryRule.ruleVersion,
          status: 'INSUFFICIENT_EVIDENCE',
          rationale: 'Nenhum Fato de estrutura de arquivos válido foi encontrado.',
          facts_used: [],
        },
      };
    }

    const payload = domainFact.payload;

    if (payload.status === 'INSUFFICIENT_EVIDENCE') {
      const evaluation: RuleEvaluationResult = {
        rule_id: MandatoryDirectoryRule.ruleId,
        rule_version: MandatoryDirectoryRule.ruleVersion,
        status: 'INSUFFICIENT_EVIDENCE',
        rationale: `Fato de estrutura para '${payload.directory}' foi reportado com Evidências Insuficientes.`,
        facts_used: [domainFact.fact_id],
      };
      return { evaluation };
    }

    if (payload.status === 'ABSENCE_VERIFIED') {
      const evaluation: RuleEvaluationResult = {
        rule_id: MandatoryDirectoryRule.ruleId,
        rule_version: MandatoryDirectoryRule.ruleVersion,
        status: 'FAIL',
        rationale: `Violação Arquitetural: O diretório obrigatório de domínio '${payload.directory}' não existe no repositório auditado.`,
        facts_used: [domainFact.fact_id],
      };

      const findingId = `FND-ARCH-${crypto.createHash('md5').update(`${target.target_id}:${domainFact.fact_id}`).digest('hex').slice(0, 10)}`;
      const finding: Finding = {
        finding_id: findingId,
        rule_id: MandatoryDirectoryRule.ruleId,
        rule_version: MandatoryDirectoryRule.ruleVersion,
        fact_ids: [domainFact.fact_id],
        evidence_ids: [...domainFact.evidence_ids],
        target_id: target.target_id,
        location: payload.directory,
        title: `Diretório Crítico de Domínio Ausente (${payload.directory})`,
        description: `Conforme a convenção Clean Architecture, o projeto DEVE possuir a camada de domínio isolada na pasta '${payload.directory}'.`,
        severity: 'HIGH',
        confidence: 1.0,
        status: 'OPEN',
        timestamp: new Date().toISOString(),
      };

      return { evaluation, finding };
    }

    // Status === 'PRESENT'
    const evaluation: RuleEvaluationResult = {
      rule_id: MandatoryDirectoryRule.ruleId,
      rule_version: MandatoryDirectoryRule.ruleVersion,
      status: 'PASS',
      rationale: `Conformidade Arquitetural: O diretório de domínio '${payload.directory}' foi verificado e está presente.`,
      facts_used: [domainFact.fact_id],
    };

    return { evaluation };
  }
}
