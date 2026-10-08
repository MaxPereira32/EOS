import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export type AuditInterface = 'CLI' | 'MCP' | 'API' | 'UNKNOWN';

export interface GateOccurrence {
  readonly fingerprint: string;
  readonly reference: string;
  readonly status: string;
  readonly previous_run_ids: readonly string[];
}

export interface AuditRunIdentification {
  readonly audit_run_id: string;
  readonly project: {
    readonly project_id: string;
    readonly target_id: string;
    readonly root_path: string;
    readonly repository: string | null;
    readonly commit_hash: string | null;
    readonly branch: string | null;
  };
  readonly timestamp: string;
  readonly executor: string;
  readonly interface: AuditInterface;
  readonly eos_version: string;
  readonly scope: string;
  readonly environment: {
    readonly platform: string;
    readonly node_version: string;
  };
  readonly status: string;
  readonly artifacts: {
    readonly auditoria_json: string;
    readonly acf_markdown: string;
    readonly auditoria_json_sha256: string;
  };
  readonly gate_occurrences: readonly GateOccurrence[];
}

const EOS_VERSION = '2.2.0';

export class AuditRegistryService {
  public static computeProjectId(rootPath: string): string {
    const normalized = process.platform === 'win32' ? rootPath.toLowerCase() : rootPath;
    return `PRJ-${crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16)}`;
  }

  public static computeGateFingerprint(reference: string, location?: string): string {
    return crypto.createHash('sha256').update(`${reference}|${location || ''}`).digest('hex').slice(0, 16);
  }

  public static auditsRoot(outputDir: string): string {
    return path.join(outputDir, 'auditorias');
  }

  public static listAudits(outputDir: string): AuditRunIdentification[] {
    const root = AuditRegistryService.auditsRoot(outputDir);
    if (!fs.existsSync(root)) return [];
    const runs: AuditRunIdentification[] = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const identificationPath = path.join(root, entry.name, 'identificacao.json');
      try {
        const parsed = JSON.parse(fs.readFileSync(identificationPath, 'utf8')) as AuditRunIdentification;
        if (parsed && typeof parsed.audit_run_id === 'string' && parsed.audit_run_id.length > 0) {
          runs.push(parsed);
        }
      } catch {
        // Execucao sem identificacao valida nao entra no historico consultavel.
      }
    }
    return runs.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  }

  public static computeOccurrences(
    outputDir: string,
    runId: string,
    gates: ReadonlyArray<{ readonly reference: string; readonly location?: string; readonly status: string }>,
  ): GateOccurrence[] {
    const previousRuns = AuditRegistryService.listAudits(outputDir)
      .filter(run => run.audit_run_id !== runId);
    return gates.map(gate => {
      const fingerprint = AuditRegistryService.computeGateFingerprint(gate.reference, gate.location);
      const previousRunIds = previousRuns
        .filter(run => (run.gate_occurrences || []).some(occurrence => occurrence.fingerprint === fingerprint))
        .map(run => run.audit_run_id);
      return {
        fingerprint,
        reference: gate.reference,
        status: gate.status,
        previous_run_ids: previousRunIds,
      };
    });
  }

  public static writeIdentification(archiveDir: string, identification: AuditRunIdentification): string {
    fs.mkdirSync(archiveDir, { recursive: true });
    const identificationPath = path.join(archiveDir, 'identificacao.json');
    fs.writeFileSync(identificationPath, JSON.stringify(identification, null, 2), 'utf8');
    return identificationPath;
  }

  public static rebuildIndex(outputDir: string): string {
    const runs = AuditRegistryService.listAudits(outputDir);
    const indexPath = path.join(outputDir, 'indice-auditorias.json');
    const payload = {
      eos_version: EOS_VERSION,
      generated_at: new Date().toISOString(),
      note: 'Indice derivado das pastas de execucao; a verdade esta em auditorias/<run_id>/identificacao.json.',
      runs: runs.map(run => ({
        audit_run_id: run.audit_run_id,
        timestamp: run.timestamp,
        status: run.status,
        interface: run.interface,
        project_id: run.project.project_id,
        root_path: run.project.root_path,
        commit_hash: run.project.commit_hash,
      })),
    };
    const temporaryPath = `${indexPath}.tmp-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    fs.writeFileSync(temporaryPath, JSON.stringify(payload, null, 2), 'utf8');
    try {
      fs.renameSync(temporaryPath, indexPath);
    } catch {
      fs.rmSync(indexPath, { force: true });
      fs.renameSync(temporaryPath, indexPath);
    }
    return indexPath;
  }
}
