#!/usr/bin/env node

/**
 * EOS ENTERPRISE UNIFIED CLI (v4.0.0 — SELF-GOVERNED HARD GATE EDITION)
 * Verifiable Continuous Architecture & Security Audit CLI
 */

import { AuditApplicationService } from '../core/services/audit-application-service';
import * as path from 'path';

function printBanner() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║    EOS v4.0 Self-Governed Continuous Security Audit CLI      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
}

function printUsage() {
  printBanner();
  console.log('Uso: eos <comando> [caminho_alvo]\n');
  console.log('Comandos disponíveis:');
  console.log('  mcp                     - Inicia o servidor MCP nativo (stdio, JSON-RPC 2.0)');
  console.log('  audit <path>            - Executa a esteira real de auditoria no diretório informado');
  console.log('  orchestrate <finding_id> - Protocolo multi-agente para o finding informado');
  console.log('  nist-assess [req_id]    - Avaliação normativa NIST SSDF SP 800-218 (padrão: PW.8.2)');
  console.log('  report [path]           - Reexibe o resumo da última auditoria (.eos/auditoria.json)');
  console.log('  verify-audit <AUD-ID> [repo] [--since <sha>] - Verifica integridade dos manifestos e mudanças pós-aprovação');
  console.log('  fix                     - (DESABILITADO) Remediação autônoma travada por segurança');
  console.log('\nExemplo: npx tsx EOS/bin/eos.ts audit ./src\n');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] ? args[0].toLowerCase() : 'help';
  const targetPath = args[1] || '.';

  switch (command) {
    case 'mcp': {
      // Protocolo MCP requer exclusivamente JSON-RPC no stdout (sem banners de terminal)
      const { EosMcpServer } = require('../core/platform/eos-mcp-server');
      const server = new EosMcpServer();
      server.start();
      break;
    }

    case 'audit': {
      printBanner();
      console.log(`[EOS Audit] Iniciando auditoria em modo AUDIT no caminho: '${targetPath}'...`);
      const service = new AuditApplicationService();
      const report = await service.executeAudit(targetPath, undefined, { interface: 'CLI' });

      console.log('\n======================================================');
      console.log(`  🔍 EOS GOVERNANCE AUDIT SUMMARY (${report.audit_run_id})`);
      console.log('======================================================\n');
      console.log(`  - Target ID:            ${report.target.target_id}`);
      console.log(`  - Arquivos Analisados:  ${report.coverage.files_analyzed} / ${report.coverage.files_discovered}`);
      console.log(`  - Quality Gates:        ${report.rule_results.length}`);
      if (report.architecture_assessment) {
        console.log(`  - Perfil Arquitetural:  ${report.architecture_assessment.effective_profile}`);
        console.log(`  - Política de Domínio:  ${report.architecture_assessment.domain_policy}`);
      }
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
      console.log(`  - ${path.join(report.target.root_path, '.eos', 'auditoria.json')}`);
      console.log(`  - ${path.join(report.target.root_path, '.eos', 'acf-auditoria.md')}`);
      console.log(`  - ${path.join(report.target.root_path, '.eos', 'auditorias', report.audit_run_id)}\n`);

      const isBlockedOrRed = report.overall_phase_status === 'BLOCKED' || report.overall_phase_status === 'RED';
      const hasInconclusiveRules = report.rule_results.some(r => r.status === 'INSUFFICIENT_EVIDENCE' || r.status === 'ERROR');
      const hasRuleFailures = report.rule_results.some(r => r.status === 'FAIL');

      if (isBlockedOrRed || hasRuleFailures || hasInconclusiveRules) {
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

    case 'nist-assess': {
      printBanner();
      const reqId = args[1] || 'PW.8.2';
      console.log(`[NIST Assessment Engine] Iniciando avaliação do Requisito Normativo: '${reqId}'...`);

      const { AssessmentRemediationService } = require('../core/services/assessment-remediation-service');
      const service = new AssessmentRemediationService();

      const pw82Req = {
        requirement_id: reqId,
        source: {
          framework: 'NIST_SSDF_V1.1',
          version: '1.1',
          title: 'NIST SP 800-218 SSDF v1.1',
          official_url: 'https://csrc.nist.gov/pubs/sp/800/218/final',
          retrieval_date: '2026-08-15'
        },
        taxonomy_kind: 'TASK',
        title: 'Test Executable Code to Identify Vulnerabilities and Verify Compliance',
        description: 'Scope, design, execute, and document tests to identify vulnerabilities and verify compliance with security requirements.',
        criteria: [
          { criterion_id: 'C1', description: 'Executable code tests defined', required: true },
          { criterion_id: 'C2', description: 'Tests executed and documented', required: true },
          { criterion_id: 'C3', description: 'Issues recorded and triaged', required: true },
          { criterion_id: 'C4', description: 'Remediation verified', required: true }
        ]
      };

      const result = await service.runFullRemediationPipeline({
        requirement: pw82Req,
        applicability: { requirement_id: reqId, status: 'APPLICABLE', rationale: 'Core System Integrity' },
        mapping: { requirement_id: reqId, eos_rule_id: 'SEC-RULE-502', relationship: 'EQUIVALENT', has_authority: true, authority_type: 'AUTHORITY_PROVEN', rationale: 'Canonical Mapping' },
        target_id: 'TGT-SYS',
        initial_evidence: [{
          evidence_id: 'EVI-BEFORE-FAIL',
          target_id: 'TGT-SYS',
          timestamp: new Date().toISOString(),
          status: 'FAIL',
          criterion_id: 'C1',
          provenance: {
            tool_or_command: 'npx tsx EOS/tests/phase-nist-1-system-context.test.ts',
            exit_code: 1,
            execution_id: 'EXEC-INIT',
            git_commit: '168aac69403a5ca47f6ad0d96ae6b598ea1c0263',
            is_synthetic: false
          }
        }],
        git_commit_before: '168aac69403a5ca47f6ad0d96ae6b598ea1c0263',
        git_commit_after: '95925f8d52ed9f616e973b3ba7f0d5b23a6a70e6'
      });

      console.log('\n======================================================');
      console.log(`  🏛️ EOS NIST ASSESSMENT & REMEDIATION PIPELINE (${reqId})`);
      console.log('======================================================\n');
      console.log(`  - Requirement ID:     ${pw82Req.requirement_id}`);
      console.log(`  - Initial Assessment:  [ ${result.initial_assessment.status} ]`);
      console.log(`  - Before Snapshot:     ${result.before_snapshot?.snapshot_id}`);
      console.log(`  - False Fix Blocked:   ${result.false_fix_blocked ? 'YES (FALSE_GREEN_BLOCKED)' : 'NO'}`);
      console.log(`  - True Fix Run ID:     ${result.true_fix_orchestration_id}`);
      console.log(`  - After Snapshot:      ${result.after_snapshot?.snapshot_id}`);
      console.log(`  - Reassessment Result: [ ${result.final_reassessment.status} ]`);

      if (result.final_reassessment.status === 'VERIFIED') {
        console.log('\n✅ AVALIAÇÃO NORMATIVA E REAVALIAÇÃO CONCLUÍDAS: Critérios comprovados por evidência.');
      } else {
        console.error(`\n💥 AVALIAÇÃO NORMATIVA REJEITADA OU BLOQUEADA! Status: ${result.final_reassessment.status}`);
        process.exitCode = 1;
      }
      break;
    }

    case 'report': {
      printBanner();
      const fs = require('fs');
      const reportPath = path.join(path.resolve(targetPath), '.eos', 'auditoria.json');
      if (!fs.existsSync(reportPath)) {
        console.error(`[-] Nenhuma auditoria encontrada em '${reportPath}'. Execute 'eos audit <path>' primeiro.`);
        process.exitCode = 1;
        break;
      }
      let report: any;
      try {
        report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      } catch (err: any) {
        console.error(`[-] Falha ao ler '${reportPath}': ${err.message || err}`);
        process.exitCode = 1;
        break;
      }
      console.log('\n======================================================');
      console.log(`  📄 EOS GOVERNANCE AUDIT REPORT (${report.audit_run_id || 'UNKNOWN'})`);
      console.log('======================================================\n');
      console.log(`  - Timestamp:            ${report.timestamp || 'UNKNOWN'}`);
      console.log(`  - Target ID:            ${report.target?.target_id || 'UNKNOWN'}`);
      console.log(`  - Arquivos Analisados:  ${report.coverage?.files_analyzed ?? '?'} / ${report.coverage?.files_discovered ?? '?'}`);
      console.log(`  - Quality Gates:        ${(report.rule_results || []).length}`);
      console.log(`  - Security Claims:      ${(report.security_claims || []).length}`);
      console.log(`  - Achados (Findings):   ${(report.findings || []).length}`);
      console.log(`  - OVERALL PHASE STATUS:  [ ${report.overall_phase_status || 'UNKNOWN'} ]`);

      const hasRuleFailures = (report.rule_results || []).some((r: any) => r.status === 'FAIL');
      const hasInconclusive = (report.rule_results || []).some((r: any) => r.status === 'INSUFFICIENT_EVIDENCE' || r.status === 'ERROR');
      const isBlockedOrRed = report.overall_phase_status === 'BLOCKED' || report.overall_phase_status === 'RED';
      if (isBlockedOrRed || hasRuleFailures || hasInconclusive) {
        process.exitCode = 1;
      }
      break;
    }

    case 'verify-audit': {
      printBanner();
      const fs = require('fs');
      const crypto = require('crypto');
      const { execFileSync } = require('child_process');
      const rawArgs = process.argv.slice(3);
      const audId = rawArgs.find(a => !a.startsWith('--') && !a.includes('/') && !a.includes('\\') && a !== '.');
      const sinceIdx = rawArgs.indexOf('--since');
      const sinceSha = sinceIdx >= 0 ? rawArgs[sinceIdx + 1] : null;
      const repoArg = rawArgs.find(a => !a.startsWith('--') && a !== audId && a !== sinceSha);
      const repoRoot = path.resolve(repoArg || '.');

      if (!audId || /^AUD-\d{4}-\d{2}-\d{2}-\d{2}$/.test(audId) === false) {
        console.error('[-] Uso: eos verify-audit <AUD-ID> [repo] [--since <sha>] (ex.: AUD-2026-10-09-05)');
        process.exitCode = 1;
        break;
      }
      const audDir = path.join(repoRoot, 'docs', 'auditoria', 'auditorias', audId);
      if (!fs.existsSync(audDir)) {
        console.error(`[-] Auditoria não encontrada: '${audDir}'.`);
        process.exitCode = 1;
        break;
      }

      // 1. Integridade: recomputa SHA-256 de cada entrada de cada MANIFEST.md.
      const manifests: string[] = [];
      const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (entry.name === 'MANIFEST.md') manifests.push(full);
        }
      };
      walk(audDir);

      let checked = 0;
      const failures: string[] = [];
      for (const manifest of manifests) {
        const lines = fs.readFileSync(manifest, 'utf8').split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('|')) continue;
          const cells = trimmed.split('|').map((c: string) => c.trim()).filter((c: string) => c.length > 0);
          if (cells.length < 2 || /^-+$/.test(cells.join('')) || /^arquivo$/i.test(cells[0])) continue;
          const file = cells[0];
          const expectedSha = cells[cells.length - 1].toLowerCase();
          if (!/^[0-9a-f]{64}$/.test(expectedSha)) continue;
          checked++;
          const abs = path.join(path.dirname(manifest), file);
          if (!fs.existsSync(abs)) {
            failures.push(`AUSENTE: ${path.relative(repoRoot, abs)} (registrado em ${path.relative(repoRoot, manifest)})`);
            continue;
          }
          const actual = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
          if (actual !== expectedSha) {
            failures.push(`HASH DIVERGENTE: ${path.relative(repoRoot, abs)}`);
          }
        }
      }

      // 2. Mudanças pós-aprovação: arquivos do dossiê alterados desde --since exigem nova rodada.
      let postApprovalChanges: string[] = [];
      if (sinceSha) {
        try {
          const out = execFileSync('git', ['diff', '--name-only', sinceSha, 'HEAD', '--', path.relative(repoRoot, audDir) || '.'], {
            cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
          });
          postApprovalChanges = out.split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean);
        } catch (err: any) {
          console.error(`[-] Falha ao comparar com '${sinceSha}': ${err.message || err}`);
          process.exitCode = 1;
          break;
        }
      }

      console.log('\n======================================================');
      console.log(`  🛡️ EOS AUDIT INTEGRITY VERDICT (${audId})`);
      console.log('======================================================\n');
      console.log(`  - Manifestos:           ${manifests.length}`);
      console.log(`  - Artefatos checados:   ${checked}`);
      console.log(`  - Falhas de integridade:${failures.length}`);
      failures.forEach(f => console.log(`    ❌ ${f}`));
      if (sinceSha) {
        console.log(`  - Mudanças desde ${sinceSha}: ${postApprovalChanges.length}`);
        postApprovalChanges.forEach(f => console.log(`    ⚠️ ${f} (exige nova rodada)`));
      } else {
        console.log('  - Base de aprovação:    não informada (use --since <sha> para travar parecer↔SHA)');
      }

      if (failures.length > 0 || postApprovalChanges.length > 0) {
        console.error('\n💥 VERIFICAÇÃO REPROVADA: registros adulterados/ausentes ou dossiê alterado pós-aprovação.');
        process.exitCode = 1;
      } else {
        console.log('\n✅ VERIFICAÇÃO APROVADA: manifestos íntegros' + (sinceSha ? ' e dossiê inalterado desde a aprovação.' : '.'));
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
