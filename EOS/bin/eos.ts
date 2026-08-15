#!/usr/bin/env node

/**
 * EOS ENTERPRISE UNIFIED CLI (v4.0.0 — SELF-GOVERNED HARD GATE EDITION)
 * Verifiable Continuous Architecture & Security Audit CLI
 */

import { AuditApplicationService } from '../core/services/audit-application-service';

function printBanner() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║    EOS v4.0 Self-Governed Continuous Security Audit CLI      ║');
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

      console.log('\n======================================================');
      console.log(`  🔍 EOS GOVERNANCE AUDIT SUMMARY (${report.audit_run_id})`);
      console.log('======================================================\n');
      console.log(`  - Target ID:            ${report.target.target_id}`);
      console.log(`  - Arquivos Analisados:  ${report.coverage.files_analyzed} / ${report.coverage.files_discovered}`);
      console.log(`  - Quality Gates:        ${report.rule_results.length}`);
      console.log(`  - Security Claims:       ${report.security_claims?.length || 0}`);
      console.log(`  - Achados (Findings):   ${report.findings.length}`);
      console.log(`  - OVERALL PHASE STATUS:  [ ${report.overall_phase_status || 'UNKNOWN'} ]`);

      if (report.security_claims && report.security_claims.length > 0) {
        console.log('\n--- EVALUATION DE SECURITY CLAIMS & CAUSALIDADE ---');
        report.security_claims.forEach(c => {
          console.log(`\n• Claim: ${c.claim_id} (${c.claim_type})`);
          console.log(`  - Target Artifact:   ${c.target_artifact}`);
          console.log(`  - Evidence Category: ${c.evidence.category}`);
          console.log(`  - Is Simulation Only:${c.evidence.is_simulation_only}`);
          console.log(`  - Causality Status:  ${c.evidence.causality_status}`);
          console.log(`  - PROVEN:            ${c.proven}`);
          console.log(`  - Phase Status:      ${c.phase_status}`);

          if (c.blocking_reasons.length > 0) {
            console.log('  - Blocking Reasons:');
            c.blocking_reasons.forEach(br => console.log(`    ❌ ${br}`));
          }
        });
      }

      console.log('\nRelatórios gerados em:');
      console.log('  - .eos/auditoria.json');
      console.log('  - .eos/acf-auditoria.md\n');

      const isBlockedOrRed = report.overall_phase_status === 'BLOCKED' || report.overall_phase_status === 'RED';
      const hasRuleFailures = report.rule_results.some(r => r.status === 'FAIL');

      if (isBlockedOrRed || hasRuleFailures) {
        console.error(`💥 AUDITORIA REPROVADA / TRAVADA! Status: ${report.overall_phase_status}`);
        process.exitCode = 1;
      } else {
        console.log('✅ AUDITORIA CONCLUÍDA COM SUCESSO: Todos os Hard Gates e Controles Cautelares Aprovados!');
      }
      break;
    }

    case 'orchestrate': {
      printBanner();
      const findingId = args[1];
      if (!findingId) {
        console.error('[-] Uso: eos orchestrate <finding_id>');
        process.exitCode = 1;
        break;
      }
      console.log(`[EOS Orchestrator] Iniciando Native Multi-Agent Protocol para o Finding: '${findingId}'...`);
      
      // Carregamento dinâmico local para evitar acoplamento se não chamado
      const { MultiAgentOrchestrationEngine } = require('../core/engines/multi-agent-orchestration-engine');
      const { MockAgentExecutor } = require('../core/orchestration/agent-executors');

      // Setup do Mock determinístico (apenas para o EXPERIMENT-0002)
      const mockExecutor = new MockAgentExecutor();
      mockExecutor.registerMock('IMPLEMENTER', { 
        run_id: 'CLI', agent_id: 'CLI-IMP', role: 'IMPLEMENTER', status: 'SUCCESS' 
      });
      mockExecutor.registerMock('REVIEWER', { 
        run_id: 'CLI', agent_id: 'CLI-REV', role: 'REVIEWER', status: 'SUCCESS' 
      });
      mockExecutor.registerMock('EVIDENCE_AUDITOR', { 
        run_id: 'CLI', agent_id: 'CLI-EVI', role: 'EVIDENCE_AUDITOR', status: 'SUCCESS', evidence_ids: ['EVI-123'] 
      });
      
      const engine = new MultiAgentOrchestrationEngine(findingId, 'TGT-SYS', mockExecutor);
      
      const verdict = await engine.executeFullPipeline();
      const trace = engine.getRunState();

      console.log('\n======================================================');
      console.log(`  🤖 EOS ORCHESTRATION RESULT (${trace.run_id})`);
      console.log('======================================================\n');
      console.log(`  - Finding ID:       ${trace.finding_id}`);
      console.log(`  - Final State:      ${verdict.final_state}`);
      console.log(`  - Transitions:      ${trace.transitions.length}`);
      console.log(`  - Agent Runs:       ${trace.agent_runs.length}`);
      console.log(`  - Rationale:        ${verdict.rationale}`);
      console.log(`  - VERDICT:          [ ${verdict.status} ]`);

      if (verdict.status === 'VERIFIED') {
        console.log('\n✅ ORQUESTRAÇÃO CONCLUÍDA COM SUCESSO: O EOS atestou a restauração da propriedade.');
      } else {
        console.error(`\n💥 ORQUESTRAÇÃO BLOQUEADA OU REJEITADA! Status Final: ${verdict.status}`);
        process.exitCode = 1;
      }
      
      // Dump trace for EXPERIMENT-0002
      const fs = require('fs');
      const path = require('path');
      fs.writeFileSync(path.join(process.cwd(), 'EOS-EXPERIMENT-0002-EXECUTION-TRACE.json'), JSON.stringify(trace, null, 2));
      console.log('📄 Trace gerado em: EOS-EXPERIMENT-0002-EXECUTION-TRACE.json');

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
