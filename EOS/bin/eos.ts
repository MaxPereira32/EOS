#!/usr/bin/env node

/**
 * EOS ENTERPRISE UNIFIED CLI (v2.2.0)
 * 
 * Subcommands:
 *   eos audit   - Executa o pipeline de auditoria em 5 estágios
 *   eos graph   - Exporta a topologia do Grafo de Domínio e análise de Blast Radius
 *   eos fix     - Aplica automaticamente as remediações unificadas no repositório
 *   eos report  - Exporta relatórios de governança arquitetural
 */

import { EosPlatformV2 } from '../core/eos-platform';
import { DomainGraphEngine } from '../core/engines/domain-graph-engine';
import { RemediationEngine } from '../core/engines/remediation-engine';
import { PatchApplierEngine } from '../core/engines/patch-applier';
import { RuleCatalog } from '../core/rules/rule-catalog';
import { Asset, Finding } from '../core/domain-graph';
import { EosMcpServer } from '../core/platform/eos-mcp-server';

function printBanner() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           EOS v2.2 Enterprise Architecture Governance CLI      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
}

function printUsage() {
  printBanner();
  console.log('Uso: eos <comando> [opções]\n');
  console.log('Comandos disponíveis:');
  console.log('  audit   - Executa a esteira completa de auditoria (5 estágios)');
  console.log('  graph   - Analisa o Grafo de Domínio, Caminhos de Ataque e Blast Radius');
  console.log('  fix     - Aplica remediações em Unified Diff no repositório');
  console.log('  report  - Exibe o resumo do catálogo de regras e relatórios');
  console.log('  mcp     - Inicializa o Servidor MCP (Model Context Protocol via stdio)');
  console.log('\nExemplo: npx tsx EOS/bin/eos.ts mcp\n');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] ? args[0].toLowerCase() : 'help';

  switch (command) {
    case 'mcp':
      const mcpServer = new EosMcpServer();
      mcpServer.start();
      break;

    case 'audit':
      const platform = new EosPlatformV2();
      platform.runPipeline();
      break;

    case 'graph':
      printBanner();
      console.log('[EOS Graph] Inicializando Grafo de Domínio e Cálculo de Blast Radius...');
      const graph = new DomainGraphEngine();
      
      const sampleAsset: Asset = {
        asset_id: 'AST-K8S-INGRESS-01',
        name: 'Public Ingress Gateway',
        type: 'NETWORK',
        criticality: { availability: 'CRITICAL', integrity: 'HIGH', confidentiality: 'HIGH' },
        business_impact: { financial: 8.5, legal: 10.0, operational: 9.0, reputation: 9.0 },
        owner: 'SecOps Team',
        tags: ['ingress', 'k8s'],
      };
      graph.addAsset(sampleAsset);

      const blast = graph.calculateBlastRadius(sampleAsset.asset_id);
      console.log(`\n✔ Ativo Raiz: ${blast.root_asset_id}`);
      console.log(`✔ Score de Blast Radius Calculado: ${blast.total_blast_score}`);
      console.log(`✔ Estatísticas do Grafo:`, graph.getStats());
      break;

    case 'fix':
      printBanner();
      console.log('[EOS Fix] Gerando e aplicando patches de remediação autônoma...');
      const remediationEngine = new RemediationEngine();
      const patchApplier = new PatchApplierEngine();

      const sampleFinding: Finding = {
        finding_id: 'FND-2026-8801',
        asset_id: 'AST-K8S-INGRESS-01',
        fact_ids: ['FCT-501'],
        rule_id: 'SEC-RULE-309-HTTP-TRACE-PREFIX',
        title: 'HTTP TRACE Method Enabled',
        severity: 'HIGH',
        cvss_v4_score: 7.5,
        cvss_v4_vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:N/VA:N',
        taxonomy: {
          owasp_category: 'A05:2021-Security Misconfiguration',
          cwe_id: 'CWE-693',
          nist_sp_800_53: 'SC-8',
          mitre_attack_id: 'T1539',
        },
      };

      const rem = remediationEngine.generateRemediation(sampleFinding);
      const applyResult = patchApplier.applyPatch(rem);

      console.log(`✔ Remediação ${rem.fix_id}: ${applyResult.message}`);
      break;

    case 'report':
      printBanner();
      console.log('[EOS Report] Catálogo de Regras Enterprise Ativas:\n');
      RuleCatalog.getAllRules().forEach(r => {
        console.log(` • [${r.rule_id}] ${r.name} (${r.default_severity}) -> ${r.taxonomy.owasp_category}`);
      });
      break;

    default:
      printUsage();
      break;
  }
}

main().catch(err => {
  console.error('[-] Erro ao executar EOS CLI:', err);
  process.exit(1);
});
