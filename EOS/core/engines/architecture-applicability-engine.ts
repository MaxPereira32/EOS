import * as fs from 'fs';
import * as path from 'path';
import { ArchitectureAssessment, ArchitectureProfile, DomainPolicy } from '../domain/types';

interface DeclaredArchitectureConfig {
  readonly profile: ArchitectureProfile | null;
  readonly domainRequired: boolean | null;
  readonly domainDirectory: string;
}

const DOMAIN_REQUIRED_PROFILES = new Set<ArchitectureProfile>([
  'CLEAN_ARCHITECTURE',
  'HEXAGONAL',
  'DDD',
]);

const DOMAIN_NOT_APPLICABLE_PROFILES = new Set<ArchitectureProfile>([
  'STATIC_FRONTEND',
  'COMPONENT_LIBRARY',
  'CLI_OR_SCRIPT',
  'INFRASTRUCTURE_AS_CODE',
]);

function normalizeProfile(value: string | null): ArchitectureProfile | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[_\s]+/g, '-');
  const map: Record<string, ArchitectureProfile> = {
    'clean': 'CLEAN_ARCHITECTURE',
    'clean-architecture': 'CLEAN_ARCHITECTURE',
    'hexagonal': 'HEXAGONAL',
    'ports-and-adapters': 'HEXAGONAL',
    'ddd': 'DDD',
    'domain-driven-design': 'DDD',
    'modular-monolith': 'MODULAR_MONOLITH',
    'monolito-modular': 'MODULAR_MONOLITH',
    'layered': 'LAYERED_APPLICATION',
    'layered-application': 'LAYERED_APPLICATION',
    'static-frontend': 'STATIC_FRONTEND',
    'frontend-static': 'STATIC_FRONTEND',
    'component-library': 'COMPONENT_LIBRARY',
    'cli': 'CLI_OR_SCRIPT',
    'script': 'CLI_OR_SCRIPT',
    'cli-or-script': 'CLI_OR_SCRIPT',
    'iac': 'INFRASTRUCTURE_AS_CODE',
    'infrastructure-as-code': 'INFRASTRUCTURE_AS_CODE',
    'unknown': 'UNKNOWN',
  };
  return map[normalized] || null;
}

function readArchitectureBlock(rootPath: string): DeclaredArchitectureConfig {
  const fallback: DeclaredArchitectureConfig = {
    profile: null,
    domainRequired: null,
    domainDirectory: 'src/domain',
  };

  try {
    const riskPath = path.join(rootPath, 'eos.risk.yml');
    if (!fs.existsSync(riskPath)) return fallback;

    const lines = fs.readFileSync(riskPath, 'utf8').split(/\r?\n/);
    let inArchitecture = false;
    let profile: ArchitectureProfile | null = null;
    let domainRequired: boolean | null = null;
    let domainDirectory = 'src/domain';

    for (const line of lines) {
      if (/^architecture\s*:/.test(line)) {
        inArchitecture = true;
        continue;
      }
      if (!inArchitecture) continue;
      if (/^[^\s#][^:]*\s*:/.test(line)) break;

      const profileMatch = line.match(/^\s+profile\s*:\s*["']?([^"'#]+?)["']?\s*$/);
      if (profileMatch) {
        profile = normalizeProfile(profileMatch[1]);
        continue;
      }

      const requiredMatch = line.match(/^\s+domain_required\s*:\s*(true|false|auto)\s*(?:#.*)?$/i);
      if (requiredMatch) {
        const value = requiredMatch[1].toLowerCase();
        domainRequired = value === 'auto' ? null : value === 'true';
        continue;
      }

      const directoryMatch = line.match(/^\s+domain_directory\s*:\s*["']?([^"'\s#]+)/);
      if (directoryMatch) {
        domainDirectory = directoryMatch[1].trim();
      }
    }

    return { profile, domainRequired, domainDirectory };
  } catch {
    return fallback;
  }
}

function safeReadPackageJson(rootPath: string): Record<string, any> | null {
  try {
    const packagePath = path.join(rootPath, 'package.json');
    if (!fs.existsSync(packagePath)) return null;
    return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch {
    return null;
  }
}

const NESTED_WALK_EXCLUDED = new Set(['node_modules', 'dist', 'build', 'release', 'coverage', 'vendor', '__pycache__', '.venv', 'venv']);

/**
 * Manifestos aninhados (ex.: frontend/package.json) carregam o framework real
 * em monorepos; sem isso a inferência de perfil fica `UNKNOWN` indevidamente.
 */
function collectNestedManifestDependencies(rootPath: string): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  const visit = (directory: string, depth: number): void => {
    if (depth > 3) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || NESTED_WALK_EXCLUDED.has(entry.name)) continue;
      const child = path.join(directory, entry.name);
      const manifestPath = path.join(child, 'package.json');
      try {
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          Object.assign(merged, manifest.dependencies || {}, manifest.devDependencies || {});
        }
      } catch {
        // Manifesto inválido não deve derrubar a inferência.
      }
      visit(child, depth + 1);
    }
  };
  visit(rootPath, 0);
  return merged;
}

const PYTHON_PERSISTENCE_PATTERN = /(sqlalchemy|psycopg2?|asyncpg|django|flask[-_]sqlalchemy|pymongo|alembic|geoalchemy)/i;
const PYTHON_MANIFEST_CANDIDATES = [
  'requirements.txt',
  'requirements-dev.txt',
  'backend/requirements.txt',
  'backend/requirements-dev.txt',
  'pyproject.toml',
  'backend/pyproject.toml',
];

function hasPythonPersistence(rootPath: string): boolean {
  for (const candidate of PYTHON_MANIFEST_CANDIDATES) {
    try {
      const fullPath = path.join(rootPath, candidate);
      if (fs.existsSync(fullPath) && PYTHON_PERSISTENCE_PATTERN.test(fs.readFileSync(fullPath, 'utf8'))) {
        return true;
      }
    } catch {
      // Sinal opcional: erro de leitura não deve transformar heurística em hard failure.
    }
  }
  return exists(rootPath, 'migrations') || exists(rootPath, 'backend/migrations');
}

/** Conta módulos de negócio em layouts Python comuns (`backend/<pacote>/core|modules`). */
function countPythonBusinessModules(rootPath: string): number {
  let total = 0;
  for (const base of ['backend', 'server', 'api']) {
    const basePath = path.join(rootPath, base);
    try {
      if (!fs.existsSync(basePath) || !fs.statSync(basePath).isDirectory()) continue;
      for (const entry of fs.readdirSync(basePath, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === '__pycache__' || entry.name === 'src') continue;
        for (const container of ['core', 'modules', 'modulos']) {
          const containerPath = path.join(basePath, entry.name, container);
          try {
            if (!fs.existsSync(containerPath) || !fs.statSync(containerPath).isDirectory()) continue;
            total += fs.readdirSync(containerPath, { withFileTypes: true })
              .filter(child => child.isDirectory() && !child.name.startsWith('__') && !child.name.startsWith('.'))
              .length;
          } catch {
            // Sinal opcional.
          }
        }
      }
    } catch {
      // Sinal opcional.
    }
  }
  return total;
}

function exists(rootPath: string, relativePath: string): boolean {
  try {
    return fs.existsSync(path.join(rootPath, relativePath));
  } catch {
    return false;
  }
}

function countBusinessModuleDirs(rootPath: string): number {
  const candidates = [
    path.join(rootPath, 'src', 'modules'),
    path.join(rootPath, 'src', 'modulos'),
    path.join(rootPath, 'backend', 'src', 'modules'),
    path.join(rootPath, 'backend', 'src', 'modulos'),
  ];

  let total = 0;
  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      total += fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory()).length;
    } catch {
      // Sinal opcional: erro de leitura não deve transformar heurística em hard failure.
    }
  }
  return total;
}

function inferProfile(rootPath: string): { profile: ArchitectureProfile; confidence: number; signals: string[] } {
  const pkg = safeReadPackageJson(rootPath);
  const nestedDependencies = collectNestedManifestDependencies(rootPath);
  const rootDependencyCount = Object.keys(pkg?.dependencies || {}).length
    + Object.keys(pkg?.devDependencies || {}).length;
  const dependencies = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
    ...nestedDependencies,
  } as Record<string, unknown>;

  const signals: string[] = [];
  if (rootDependencyCount === 0 && Object.keys(nestedDependencies).length > 0) {
    signals.push('dependências de framework lidas de manifesto aninhado');
  }
  const pythonPersistence = hasPythonPersistence(rootPath);
  if (pythonPersistence) signals.push('persistência Python detectada');
  const hasFrontendFramework = Boolean(
    dependencies.react || dependencies['react-dom'] || dependencies.vue ||
    dependencies['@angular/core'] || dependencies.svelte || dependencies.next ||
    dependencies.nuxt
  );
  const hasBackendFramework = Boolean(
    dependencies.fastify || dependencies.express || dependencies.koa ||
    dependencies.hapi || dependencies['@nestjs/core'] || dependencies['@hono/node-server']
  ) || exists(rootPath, 'backend') || exists(rootPath, 'server') || exists(rootPath, 'api');
  const hasPersistence = Boolean(
    dependencies['drizzle-orm'] || dependencies.prisma || dependencies.typeorm ||
    dependencies.sequelize || dependencies.mongoose || dependencies.firebase ||
    dependencies['@supabase/supabase-js'] || dependencies.pg || dependencies.mysql2
  ) || pythonPersistence;
  const hasDomainDir = [
    'src/domain',
    'src/dominio',
    'src/dominios',
    'backend/src/domain',
    'backend/src/dominio',
  ].some(candidate => exists(rootPath, candidate));
  const businessModuleCount = countBusinessModuleDirs(rootPath) + countPythonBusinessModules(rootPath);
  const hasComponentLibrarySignals = Boolean(pkg?.peerDependencies?.react) &&
    (exists(rootPath, 'src/components') || exists(rootPath, 'src/componentes')) &&
    !hasBackendFramework;
  const hasCliSignal = Boolean(pkg?.bin);
  const hasIaC = exists(rootPath, 'main.tf') || exists(rootPath, 'terraform') ||
    exists(rootPath, 'infra') && (
      exists(rootPath, 'infra/main.tf') ||
      exists(rootPath, 'infra/k8s') ||
      exists(rootPath, 'infra/terraform')
    );

  if (hasIaC) {
    signals.push('artefatos de Infrastructure as Code detectados');
    return { profile: 'INFRASTRUCTURE_AS_CODE', confidence: 0.95, signals };
  }

  if (hasComponentLibrarySignals) {
    signals.push('peerDependency de React e diretório de componentes sem backend');
    return { profile: 'COMPONENT_LIBRARY', confidence: 0.9, signals };
  }

  if (hasCliSignal && !hasFrontendFramework && !hasBackendFramework) {
    signals.push('package.json declara bin e não há framework web/backend');
    return { profile: 'CLI_OR_SCRIPT', confidence: 0.9, signals };
  }

  if (hasDomainDir) {
    signals.push('camada de domínio já existe no projeto');
    if (businessModuleCount >= 3) {
      signals.push(`${businessModuleCount} módulos de negócio detectados`);
      return { profile: 'MODULAR_MONOLITH', confidence: 0.9, signals };
    }
    return { profile: 'CLEAN_ARCHITECTURE', confidence: 0.78, signals };
  }

  if (hasBackendFramework && hasPersistence && businessModuleCount >= 3) {
    signals.push('backend detectado');
    signals.push('persistência detectada');
    signals.push(`${businessModuleCount} módulos de negócio detectados`);
    return { profile: 'MODULAR_MONOLITH', confidence: 0.86, signals };
  }

  if (hasBackendFramework && (hasPersistence || businessModuleCount > 0)) {
    signals.push('backend detectado');
    if (hasPersistence) signals.push('persistência detectada');
    if (businessModuleCount > 0) signals.push(`${businessModuleCount} módulo(s) de negócio detectado(s)`);
    return { profile: 'LAYERED_APPLICATION', confidence: 0.75, signals };
  }

  if (hasFrontendFramework && !hasBackendFramework && !hasPersistence) {
    signals.push('framework frontend detectado sem backend ou persistência de aplicação');
    return { profile: 'STATIC_FRONTEND', confidence: 0.82, signals };
  }

  if (hasFrontendFramework) signals.push('framework frontend detectado');
  if (hasBackendFramework) signals.push('backend detectado');
  if (hasPersistence) signals.push('persistência detectada');
  if (businessModuleCount > 0) signals.push(`${businessModuleCount} módulo(s) detectado(s)`);

  return {
    profile: 'UNKNOWN',
    confidence: signals.length > 0 ? 0.45 : 0.25,
    signals,
  };
}

function recommendationFor(profile: ArchitectureProfile): string {
  switch (profile) {
    case 'MODULAR_MONOLITH':
      return 'Preferir monólito modular orientado a capacidades de negócio, com domain/application/infrastructure dentro de cada módulo quando houver invariantes relevantes.';
    case 'CLEAN_ARCHITECTURE':
      return 'Manter domínio independente de frameworks e infraestrutura, com dependências apontando para dentro e adaptadores nas bordas.';
    case 'HEXAGONAL':
      return 'Organizar o núcleo por casos de uso e portas, mantendo adaptadores de banco, HTTP e integrações fora do domínio.';
    case 'DDD':
      return 'Modelar bounded contexts e invariantes de negócio antes de escolher limites físicos; domínio deve permanecer independente de infraestrutura.';
    case 'LAYERED_APPLICATION':
      return 'Preferir arquitetura em camadas simples; introduzir camada de domínio apenas onde regras de negócio justificarem o custo da abstração.';
    case 'STATIC_FRONTEND':
      return 'Preferir arquitetura por componentes/features e evitar criar camada de domínio artificial sem regras de negócio reais.';
    case 'COMPONENT_LIBRARY':
      return 'Preferir organização por componentes, design tokens e contratos públicos; camada de domínio de negócio normalmente não se aplica.';
    case 'CLI_OR_SCRIPT':
      return 'Preferir estrutura simples por comandos/casos de uso; introduzir domínio somente se a ferramenta passar a carregar regras de negócio complexas.';
    case 'INFRASTRUCTURE_AS_CODE':
      return 'Preferir módulos de infraestrutura, ambientes e políticas; domínio de aplicação não deve ser exigido.';
    default:
      return 'Não há evidência suficiente para impor um estilo. Manter a arquitetura atual e declarar explicitamente o perfil em eos.risk.yml quando a intenção estiver definida.';
  }
}

function domainPolicyFor(
  declared: DeclaredArchitectureConfig,
  effectiveProfile: ArchitectureProfile,
  inferredOnly: boolean,
): DomainPolicy {
  if (declared.domainRequired === true) return 'REQUIRED';
  if (declared.domainRequired === false) return 'NOT_APPLICABLE';
  if (!inferredOnly && DOMAIN_REQUIRED_PROFILES.has(effectiveProfile)) return 'REQUIRED';
  if (!inferredOnly && DOMAIN_NOT_APPLICABLE_PROFILES.has(effectiveProfile)) return 'NOT_APPLICABLE';
  if (inferredOnly && DOMAIN_NOT_APPLICABLE_PROFILES.has(effectiveProfile)) return 'NOT_APPLICABLE';
  return 'OPTIONAL';
}

export class ArchitectureApplicabilityEngine {
  public assess(rootPath: string): ArchitectureAssessment {
    const declared = readArchitectureBlock(rootPath);
    const inferred = inferProfile(rootPath);
    const effectiveProfile = declared.profile || inferred.profile;
    const inferredOnly = declared.profile === null;

    return {
      declared_profile: declared.profile,
      inferred_profile: inferred.profile,
      effective_profile: effectiveProfile,
      domain_policy: domainPolicyFor(declared, effectiveProfile, inferredOnly),
      domain_directory: declared.domainDirectory,
      confidence: declared.profile ? 1.0 : inferred.confidence,
      signals: inferred.signals,
      recommendation: recommendationFor(effectiveProfile),
      source: declared.profile || declared.domainRequired !== null ? 'DECLARED_AND_INFERRED' : 'INFERRED',
    };
  }
}
