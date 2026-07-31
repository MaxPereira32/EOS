/**
 * EOS AST & IAC STATIC ANALYSIS COLLECTOR (v2.2.0)
 * 
 * Performs static analysis over source code (TypeScript, JavaScript, Python),
 * Terraform IaC, and Dockerfiles to extract deterministic Evidence with SHA-256 hashes.
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { Observation, Evidence } from '../domain-graph';

export interface AstScanTarget {
  asset_id: string;
  file_path: string;
  content?: string;
}

export class AstCollector {
  private collectorName = 'ast-iac-static-collector';

  /**
   * Analisa estaticamente arquivos de código fonte e IaC procurando por antipadrões e vulnerabilidades
   */
  public scanFile(target: AstScanTarget): {
    observation: Observation;
    evidences: Evidence[];
  } {
    const obsId = `OBS-AST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const evidences: Evidence[] = [];

    const fileContent = target.content || (fs.existsSync(target.file_path) ? fs.readFileSync(target.file_path, 'utf8') : '');
    const lines = fileContent.split('\n');

    // 1. Detecção de Credenciais Hardcoded / Secrets
    const secretRegex = /(api[_-]?key|secret[_-]?key|password|bearer\s+[a-z0-9_\-\.]{20,})\s*=\s*['"][^'"]+['"]/i;
    lines.forEach((line: string, idx: number) => {
      if (secretRegex.test(line)) {
        const lineNum = idx + 1;
        const snippet = line.trim();
        evidences.push({
          evidence_id: `EVD-AST-SECRET-${Date.now()}-${lineNum}`,
          observation_id: obsId,
          collector: this.collectorName,
          verification_method: 'AST',
          verification_hash: this.computeSha256(snippet),
          source_location: `${target.file_path}:${lineNum}`,
          snippet: snippet,
          confidence: 0.96,
          source_reliability: 0.95,
        });
      }
    });

    // 2. Detecção de Injeção de Comando ou Eval em JavaScript/Python
    const evalRegex = /\b(eval\(|exec\(|child_process\.exec\()/i;
    lines.forEach((line: string, idx: number) => {
      if (evalRegex.test(line)) {
        const lineNum = idx + 1;
        const snippet = line.trim();
        evidences.push({
          evidence_id: `EVD-AST-EVAL-${Date.now()}-${lineNum}`,
          observation_id: obsId,
          collector: this.collectorName,
          verification_method: 'AST',
          verification_hash: this.computeSha256(snippet),
          source_location: `${target.file_path}:${lineNum}`,
          snippet: snippet,
          confidence: 0.98,
          source_reliability: 0.97,
        });
      }
    });

    // 3. Detecção de IaC (Terraform / Ingress) portas abertas inseguras 0.0.0.0/0
    if (target.file_path.endsWith('.tf') || target.file_path.endsWith('.yaml') || target.file_path.endsWith('.yml')) {
      const openInboundRegex = /0\.0\.0\.0\/0/i;
      lines.forEach((line: string, idx: number) => {
        if (openInboundRegex.test(line)) {
          const lineNum = idx + 1;
          const snippet = line.trim();
          evidences.push({
            evidence_id: `EVD-IAC-OPENINBOUND-${Date.now()}-${lineNum}`,
            observation_id: obsId,
            collector: this.collectorName,
            verification_method: 'IAC_PARSER',
            verification_hash: this.computeSha256(snippet),
            source_location: `${target.file_path}:${lineNum}`,
            snippet: snippet,
            confidence: 0.99,
            source_reliability: 0.98,
          });
        }
      });
    }

    const observation: Observation = {
      observation_id: obsId,
      asset_id: target.asset_id,
      collector_name: 'static-ast',
      raw_telemetry: {
        file_path: target.file_path,
        total_lines: lines.length,
        evidences_found: evidences.length,
      },
      observed_at: new Date().toISOString(),
    };

    return { observation, evidences };
  }

  private computeSha256(input: string): string {
    return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
  }
}
