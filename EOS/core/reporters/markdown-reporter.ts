import * as fs from 'fs';
import * as path from 'path';
import { AuditReport } from '../domain/types';

export class MarkdownReporter {
  public static writeReport(report: AuditReport, outputDir: string = '.eos'): string {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'acf-auditoria.md');

    const mdLines: string[] = [
      `# RELATÓRIO DE AUDITORIA DE ARQUITETURA CONTINUA (EOS v3.0)`,
      ``,
      `**Audit Run ID:** \`${report.audit_run_id}\`  `,
      `**Data / Hora:** \`${report.timestamp}\`  `,
      `**Target ID:** \`${report.target.target_id}\`  `,
      `**Caminho Alvo:** \`${report.target.root_path}\`  `,
      `**Branch / Commit:** \`${report.target.branch || 'N/A'}\` / \`${report.target.commit_hash || 'N/A'}\`  `,
      ``,
      `## 1. MÉTICAS DE COBERTURA DE COLETA`,
      ``,
      `| Métrica | Valor |`,
      `|---|---|`,
      `| Arquivos Descobertos | ${report.coverage.files_discovered} |`,
      `| Arquivos Analisados | ${report.coverage.files_analyzed} |`,
      `| Arquivos Ignorados | ${report.coverage.files_skipped} |`,
      `| Arquivos com Erro | ${report.coverage.files_errored} |`,
      `| Arquivos Inacessíveis | ${report.coverage.files_inaccessible} |`,
      `| Diretórios Descobertos | ${report.coverage.directories_discovered ?? 0} |`,
      `| Diretórios Ignorados | ${report.coverage.directories_skipped ?? 0} |`,
      `| Symlinks Descobertos | ${report.coverage.symlinks_discovered ?? 0} |`,
      `| Symlinks Ignorados | ${report.coverage.symlinks_skipped ?? 0} |`,
      ``,
      `## 2. RESULTADO DOS QUALITY GATES & RULES`,
      ``,
    ];

    for (const res of report.rule_results) {
      const badge = res.status === 'PASS' ? '✅ PASS' : res.status === 'FAIL' ? '❌ FAIL' : '⚠️ ' + res.status;
      mdLines.push(`### Rule: \`${res.rule_id}\` (${badge})`);
      mdLines.push(`- **Versão:** \`${res.rule_version}\``);
      mdLines.push(`- **Justificativa:** ${res.rationale}`);
      mdLines.push(`- **Fatos Utilizados:** ${res.facts_used.map(f => `\`${f}\``).join(', ') || 'Nenhum'}`);
      mdLines.push(``);
    }

    mdLines.push(`## 3. VALIDAÇÕES EXECUTADAS`);
    mdLines.push(``);
    if (!report.execution_evidences || report.execution_evidences.length === 0) {
      mdLines.push(`*Nenhuma validação executável foi registrada.*`);
    } else {
      mdLines.push(`| Comando | Resultado | Código | Duração |`);
      mdLines.push(`|---|---:|---:|---:|`);
      for (const check of report.execution_evidences) {
        mdLines.push(`| \`${check.command_line}\` | ${check.state} | ${check.exit_code} | ${check.duration_ms} ms |`);
      }
    }
    mdLines.push(``);

    mdLines.push(`## 4. ACHADOS (FINDINGS)`);
    mdLines.push(``);

    if (report.findings.length === 0) {
      mdLines.push(`*Nenhum achado ou violação detectado.*`);
    } else {
      for (const finding of report.findings) {
        mdLines.push(`### [${finding.severity}] ${finding.title}`);
        mdLines.push(`- **ID do Achado:** \`${finding.finding_id}\``);
        mdLines.push(`- **Localização:** \`${finding.location}\``);
        mdLines.push(`- **Descrição:** ${finding.description}`);
        mdLines.push(`- **Fatos de Origem:** ${finding.fact_ids.map(f => `\`${f}\``).join(', ')}`);
        mdLines.push(`- **Evidências Rastreáveis:** ${finding.evidence_ids.map(e => `\`${e}\``).join(', ')}`);
        mdLines.push(``);
      }
    }

    mdLines.push(`## 5. PROVENIÊNCIA & RASTREABILIDADE`);
    mdLines.push(``);
    mdLines.push(`Este relatório registra somente evidências coletadas e validações executadas no alvo; ausência de execução é identificada como evidência insuficiente.`);
    mdLines.push(`Todos os achados derivam de Evidências com hashes SHA-256 verificáveis contra o sistema de arquivos real.`);

    fs.writeFileSync(outputPath, mdLines.join('\n'), 'utf-8');
    return outputPath;
  }
}
