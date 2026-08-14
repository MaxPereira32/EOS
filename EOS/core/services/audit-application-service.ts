import * as crypto from 'crypto';
import { TargetResolver } from '../domain/target-resolver';
import { FilesystemCollector } from '../collectors/filesystem-collector';
import { TypescriptAstCollector } from '../collectors/typescript-ast-collector';
import { FileStructureFactProvider } from '../fact-providers/file-structure-fact-provider';
import { DependencyFactProvider } from '../fact-providers/dependency-fact-provider';
import { MandatoryDirectoryRule } from '../rules/mandatory-directory-rule';
import { NoDisallowedDependencyRule } from '../rules/no-disallowed-dependency-rule';
import { JsonReporter } from '../reporters/json-reporter';
import { MarkdownReporter } from '../reporters/markdown-reporter';
import { AuditReport, Finding, RuleEvaluationResult, Evidence, Fact } from '../domain/types';

export class AuditApplicationService {
  public async executeAudit(targetPath: string, outputDir: string = '.eos'): Promise<AuditReport> {
    // 1. Resolver Target
    const target = TargetResolver.resolve(targetPath);

    // 2. Coletar do Filesystem Real
    const fsCollector = new FilesystemCollector();
    const fsCollectionResult = await fsCollector.collect(target);

    // 3. Coletar AST TypeScript Real
    const astCollector = new TypescriptAstCollector();
    const astEvidences = await astCollector.collectFromArtifacts(target, fsCollectionResult.artifacts);

    // Evidências agregadas
    const allEvidences: Evidence[] = [...fsCollectionResult.evidences, ...astEvidences];

    // 4. Provedores de Fatos Semânticos
    const fsFactProvider = new FileStructureFactProvider();
    const fsFacts = fsFactProvider.generateFacts(fsCollectionResult.evidences, 'src/domain');

    const depFactProvider = new DependencyFactProvider();
    const depFacts = depFactProvider.generateFacts(allEvidences);

    const allFacts: Fact[] = [...fsFacts, ...depFacts];

    // 5. Avaliação de Regras Arquiteturais
    const ruleResults: RuleEvaluationResult[] = [];
    const findings: Finding[] = [];

    // Rule 1: Estrutura de Diretórios Obrigatória
    const mandatoryDirRule = new MandatoryDirectoryRule();
    const res1 = mandatoryDirRule.evaluate(fsFacts, target);
    ruleResults.push(res1.evaluation);
    if (res1.finding) findings.push(res1.finding);

    // Rule 2: Dependências Proibidas de Módulos (Domain -> Infra)
    const noDisallowedDepRule = new NoDisallowedDependencyRule();
    const res2 = noDisallowedDepRule.evaluate(depFacts, target);
    ruleResults.push(res2.evaluation);
    if (res2.findings && res2.findings.length > 0) {
      findings.push(...res2.findings);
    }

    // 6. Montar Relatório Final Verificável
    const runIdSeed = `${target.target_id}:${fsCollectionResult.coverage.files_analyzed}:${allFacts.length}:${new Date().toISOString()}`;
    const auditRunId = `RUN-${crypto.createHash('sha256').update(runIdSeed).digest('hex').slice(0, 12)}`;

    const report: AuditReport = {
      audit_run_id: auditRunId,
      timestamp: new Date().toISOString(),
      target,
      coverage: fsCollectionResult.coverage,
      findings,
      rule_results: ruleResults,
      facts: allFacts,
      evidences: allEvidences,
    };

    // 7. Persistir Artefatos
    JsonReporter.writeReport(report, outputDir);
    MarkdownReporter.writeReport(report, outputDir);

    return report;
  }
}
