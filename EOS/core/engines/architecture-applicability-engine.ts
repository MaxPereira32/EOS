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
  const dependencies = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
  } as Record<string, unknown>;

  const signals: string[] = [];
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
  );
  const hasDomainDir = [
    'src/domain',
    'src/dominio',
    'src/dominios',
    'backend/src/domain',
    'backend/src/dominio',
  ].some(candidate => exists(rootPath, candidate));
  const businessModuleCount = countBusinessModuleDirs(rootPath);
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
