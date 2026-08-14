import * as crypto from 'crypto';
import { Evidence, Fact, FACT_SCHEMA_VERSION_1_0, ResolutionKind, ResolutionStrategy } from '../domain/types';
import { SemanticModuleResolver, TsConfigPathsConfig } from '../resolvers/semantic-module-resolver';
import { canonicalHash } from '../utils/canonical-json';

export class DependencyFactProvider {
  public static readonly providerId = 'dependency-fact-provider';
  public static readonly providerVersion = '5.1.0';

  private readonly resolver: SemanticModuleResolver;
  private readonly tsconfigConfig?: TsConfigPathsConfig;

  constructor(tsconfigConfig?: TsConfigPathsConfig | readonly string[]) {
    this.resolver = new SemanticModuleResolver();
    if (Array.isArray(tsconfigConfig)) {
      this.tsconfigConfig = { knownFiles: tsconfigConfig as readonly string[] };
    } else if (tsconfigConfig) {
      this.tsconfigConfig = tsconfigConfig as TsConfigPathsConfig;
    }
  }

  /**
   * Normalização semântica determinística de módulos via SemanticModuleResolver
   */
  public normalizeTargetModule(sourceModuleRelPath: string, specifier: string): string {
    const resolution = this.resolver.resolve(sourceModuleRelPath, specifier, this.tsconfigConfig);
    return resolution.resolved_module;
  }

  public generateFacts(evidences: readonly Evidence[]): Fact[] {
    if (!evidences || evidences.length === 0) {
      return [];
    }

    // Extrair inventário de arquivos conhecidos a partir das próprias evidências fornecidas em memória (Zero I/O)
    const evidenceFiles = Array.from(new Set(evidences.map(e => e.locator.relative_path).filter(Boolean)));
    const effectiveKnownFiles = (this.tsconfigConfig?.knownFiles && this.tsconfigConfig.knownFiles.length > 0)
      ? this.tsconfigConfig.knownFiles
      : evidenceFiles;

    const effectiveConfig: TsConfigPathsConfig = {
      ...(this.tsconfigConfig || {}),
      knownFiles: effectiveKnownFiles,
    };

    // Filtrar evidências geradas pelo TypescriptAstCollector ou ManifestCollector
    const astEvidences = evidences.filter(e =>
      e.collector_id.includes('typescript-ast-collector') ||
      e.evidence_id.startsWith('EVD-AST-') ||
      e.snippet.includes('IMPORT]') ||
      e.ast_metadata?.kind === 'MODULE_IMPORT'
    );

    if (astEvidences.length === 0) {
      return [];
    }

    // Agrupar evidências por chave única (source_module + target_module + import_type)
    const grouped = new Map<string, {
      source_module: string;
      target_module: string;
      import_type: 'STATIC' | 'DYNAMIC';
      resolution_kind: ResolutionKind;
      resolution_strategy: ResolutionStrategy;
      evidences: Evidence[];
    }>();

    for (const ev of astEvidences) {
      const sourceModule = ev.locator.relative_path.replace(/\\/g, '/');

      let specifier = '';
      let importType: 'STATIC' | 'DYNAMIC' = 'STATIC';

      // 1. Primário: Usar metadados estruturados tipados de AST
      if (ev.ast_metadata && ev.ast_metadata.kind === 'MODULE_IMPORT') {
        specifier = ev.ast_metadata.specifier;
        importType = ev.ast_metadata.import_type;
      }
      // 2. Fallback de compatibilidade
      else {
        if (ev.snippet.includes('[DYNAMIC IMPORT]')) {
          importType = 'DYNAMIC';
        }
        const match = ev.snippet.match(/specifier:\s*"([^"]+)"/);
        specifier = match ? match[1] : '';
      }

      if (!specifier) continue;

      const resolution = this.resolver.resolveDetailed(sourceModule, specifier, effectiveConfig);
      const targetModule = resolution.canonical_module || 'UNRESOLVED';

      const groupKey = `${sourceModule} -> ${targetModule} [${importType}]`;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          source_module: sourceModule,
          target_module: targetModule,
          import_type: importType,
          resolution_kind: resolution.kind,
          resolution_strategy: resolution.strategy,
          evidences: [],
        });
      }

      grouped.get(groupKey)!.evidences.push(ev);
    }

    const facts: Fact[] = [];

    // Gerar fatos determinísticos ordenados por chave
    const sortedKeys = Array.from(grouped.keys()).sort();
    const manifestHash = effectiveConfig.manifestHash || '';

    for (const key of sortedKeys) {
      const group = grouped.get(key)!;
      const sortedEvidences = [...group.evidences].sort((a, b) => a.evidence_id.localeCompare(b.evidence_id));

      const evidenceIds = Object.freeze(sortedEvidences.map(e => e.evidence_id));
      const evidenceSeed = sortedEvidences.map(e => `${e.evidence_id}:${e.content_hash}`).join('|');
      const inputHashSeed = manifestHash ? `${manifestHash}|${evidenceSeed}` : evidenceSeed;
      const inputHash = crypto.createHash('sha256').update(inputHashSeed).digest('hex');

      // Fator semântico canônico
      const semanticPayload = Object.freeze({
        fact_type: 'MODULE_DEPENDENCY' as const,
        source_module: group.source_module,
        target_module: group.target_module,
        import_type: group.import_type,
        resolution_kind: group.resolution_kind,
        resolution_strategy: group.resolution_strategy,
      });
      const semanticHash = canonicalHash(semanticPayload);

      const factSeed = `${group.source_module}:${group.target_module}:${group.import_type}:${inputHash}`;
      const factId = `FCT-DEP-${crypto.createHash('md5').update(factSeed).digest('hex').slice(0, 12)}`;

      const fact: Fact = Object.freeze({
        fact_id: factId,
        schema_version: FACT_SCHEMA_VERSION_1_0,
        fact_type: 'MODULE_DEPENDENCY',
        provider_id: DependencyFactProvider.providerId,
        provider_version: DependencyFactProvider.providerVersion,
        evidence_ids: evidenceIds,
        input_hash: inputHash,
        semantic_hash: semanticHash,
        lifecycle_status: 'VALID',
        payload: semanticPayload,
        composite_confidence: 1.0,
        created_at: new Date().toISOString(),
      });

      facts.push(fact);
    }

    return Object.freeze(facts) as Fact[];
  }
}
