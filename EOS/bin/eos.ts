#!/usr/bin/env node

/**
 * EOS ENTERPRISE UNIFIED CLI (v3.0.0)
 * Verifiable Continuous Architecture Audit CLI
 */

import { AuditApplicationService } from '../core/services/audit-application-service';

function printBanner() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           EOS v3.0 Continuous Architecture Audit CLI         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
}

function printUsage() {
  printBanner();
  console.log('Uso: eos <comando> [caminho_alvo]\n');
  console.log('Comandos disponíveis:');
  console.log('  audit <path>  - Executa a esteira real de auditoria no diretório informado');
  console.log('  fix           - (DESABILITADO) Remediação autônoma travada por segurança');
  console.log('\nExemplo: npx tsx EOS/bin/eos.ts audit ./src\n');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] ? args[0].toLowerCase() : 'help';
  const targetPath = args[1] || '.';

  switch (command) {
    case 'audit': {
      printBanner();
      console.log(`[EOS Audit] Iniciando auditoria em modo AUDIT no caminho: '${targetPath}'...`);
      const service = new AuditApplicationService();
      const report = await service.executeAudit(targetPath);

      console.log('\n✔ Auditoria concluída com sucesso!');
      console.log(`  - Audit Run ID: ${report.audit_run_id}`);
      console.log(`  - Target ID:    ${report.target.target_id}`);
      console.log(`  - Arquivos Analisados: ${report.coverage.files_analyzed} / ${report.coverage.files_discovered}`);
      console.log(`  - Quality Gates Avaliados: ${report.rule_results.length}`);
      console.log(`  - Achados (Findings): ${report.findings.length}`);
      console.log('\nRelatórios gerados em:');
      console.log('  - .eos/auditoria.json');
      console.log('  - .eos/acf-auditoria.md\n');
      
      const hasFailures = report.rule_results.some(r => r.status === 'FAIL');
      if (hasFailures) {
        process.exitCode = 1;
      }
      break;
    }

    case 'fix': {
      printBanner();
      console.error('❌ [SEGURANÇA CRÍTICA]: O comando \'eos fix\' foi DESABILITADO nesta versão.');
      console.error('   Motivo: O motor de remediação precisa de validação atômica de Unified Diff e contenção de Path Traversal antes de efetuar gravações no disco.');
      process.exit(1);
      break;
    }

    default:
      printUsage();
      break;
  }
}

main().catch(err => {
  console.error('[-] Erro ao executar EOS CLI:', err.message || err);
  process.exit(1);
});
