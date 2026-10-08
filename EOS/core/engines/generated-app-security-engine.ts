import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Finding, RuleEvaluationResult } from '../domain/types';
import { RuleCatalog } from '../rules/rule-catalog';

interface SourceFile { readonly absolute: string; readonly relative: string; readonly lines: readonly string[]; }

export interface GeneratedAppSecurityResult {
  readonly findings: readonly Finding[];
  readonly rule: RuleEvaluationResult;
}

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.sql', '.rules',
  '.toml', '.yml', '.yaml', '.ini', '.json',
]);
const EXCLUDED_DIRECTORIES = new Set([
  '.git', '.eos', 'node_modules', 'dist', 'build', 'coverage', '.next', 'vendor',
  '.venv', 'venv', '.tox', '.poetry', 'site-packages',
]);
const EXCLUDED_FILENAMES = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'poetry.lock', 'pipfile.lock', 'cargo.lock']);
const SECRET_KEY_PATTERN = /\b(?:[A-Za-z_][\w.-]*?)?(?:api[_-]?key|secret|token|password|passwd|salt|service[_-]?role(?:[_-]?key)?)[\w.-]*\b/i;
const PLACEHOLDER_SECRET_PATTERN = /(?:process\.env|import\.meta\.env|os\.environ|example|placeholder|changeme|change[_-]?me|replace[_-]?me|your[_-]|smtpd?|relay\s+host|host\s+(?:password|username)|\$\{|<[^>]+>)/i;

/**
 * Static fail-closed review for high-frequency defects in generated web apps.
 * It reports observable risk; it deliberately does not infer a secure runtime
 * from source code alone.
 */
export class GeneratedAppSecurityEngine {
  public scan(rootPath: string, targetId: string, hasProvenRlsClaim: boolean): GeneratedAppSecurityResult {
    const files = this.collectSourceFiles(rootPath);
    const findings: Finding[] = [];
    const add = (ruleId: string, file: SourceFile, line: number, title: string, description: string,
      severity: Finding['severity'], confidence: number): void => {
      findings.push(this.createFinding(ruleId, file, line, title, description, severity, confidence, targetId));
    };

    const text = files.map(file => file.lines.join('\n')).join('\n');
    const supabasePattern = /(?:@supabase\/supabase-js|createClient\s*\(|\bsupabase\s*[._]|SUPABASE_(?:URL|SERVICE_ROLE_KEY|STORAGE_BUCKET))/i;
    const supabaseUses = supabasePattern.test(text);
    const firebaseUses = /(?:initializeApp\s*\(|getFirestore\s*\(|firebase\/firestore|firebase\/app)/i.test(text);
    const supabasePolicy = /(?:alter\s+table[\s\S]{0,300}enable\s+row\s+level\s+security|create\s+policy)/i.test(text);
    const firebaseRules = files.some(file => file.relative.endsWith('.rules')
      && /service\s+cloud\.firestore/i.test(file.lines.join('\n')) && /allow\s+(?:read|write)/i.test(file.lines.join('\n')));

    if (supabaseUses && !supabasePolicy && !hasProvenRlsClaim) {
      const location = this.findSupabaseIntegration(files, supabasePattern);
      if (location) add('EOS-GENAI-RLS-001', location.file, location.line, 'Política de acesso Supabase não verificável no escopo estático',
        'A integração Supabase foi observada, mas suas políticas podem ser gerenciadas fora deste repositório. Isso não prova ausência de política nem vulnerabilidade explorável. Declare um claim RLS e valide as permissões reais do recurso em runtime.', 'MEDIUM', 0.65);
    }
    if (firebaseUses && !firebaseRules) {
      const location = this.firstMatch(files, /(?:initializeApp\s*\(|getFirestore\s*\(|firebase\/firestore|firebase\/app)/i);
      if (location) add('EOS-GENAI-RLS-002', location.file, location.line, 'Firebase sem regras de acesso verificáveis',
        'Risco: o código usa Firebase/Firestore sem firestore.rules aplicável no escopo auditado. Correção: mantenha default deny, regras vinculadas a request.auth/tenant e teste-as no emulador real.', 'CRITICAL', 0.92);
    }

    for (const file of files) {
      const content = file.lines.join('\n');
      const looksClient = /(?:use client|window\.|document\.|useState\s*\(|onAuthStateChanged|supabase\.auth)/i.test(content);
      const frontendAuthorization = /(?:user|session|profile)\s*\?\.?\s*(?:role|isAdmin|tenant|organization)|if\s*\([^\n]*(?:role|isAdmin|tenant)/i.test(content);
      const dataAccess = /(?:\bsupabase\s*\.\s*from\s*\(|fetch\s*\(|axios\.|prisma\.|find(?:Unique|ById)\s*\()/i.test(content);
      const serverAuthorization = /(?:verify(?:Id)?Token|requireAuth|authenticate|middleware|currentUser\s*\(|getServerSession|request\.auth)/i.test(content);
      if (looksClient && frontendAuthorization && dataAccess && !serverAuthorization) {
        const match = this.firstMatch([file], /(?:\bsupabase\s*\.\s*from\s*\(|fetch\s*\(|axios\.|prisma\.|find(?:Unique|ById)\s*\()/i);
        if (match) add('EOS-GENAI-AUTHZ-001', file, match.line, 'Autorização aparenta existir apenas no frontend',
          'Risco: a decisão de role/tenant no cliente pode ser burlada por chamada direta à API. Correção: imponha autenticação e autorização no servidor/banco, vinculando a consulta à identidade e ao tenant da sessão.', 'HIGH', 0.78);
      }

      file.lines.forEach((line, index) => {
        const nearby = file.lines.slice(Math.max(0, index - 12), Math.min(file.lines.length, index + 13)).join('\n');
        const idor = /(?:findById\s*\([^)]*(?:params|req\.)|findUnique\s*\(\s*\{\s*where\s*:\s*\{\s*id\s*:|\.eq\s*\(\s*['"]id['"])/i.test(line);
        const tenantBound = /(?:tenant_?id|owner_?id|user_?id|organization_?id|workspace_?id)/i.test(nearby);
        if (idor && !tenantBound) {
          add('EOS-GENAI-IDOR-001', file, index + 1, 'Consulta por ID sem vínculo de proprietário ou tenant',
            'Risco: padrão compatível com IDOR; um atacante pode trocar o ID e acessar recurso de outro usuário/tenant. Correção: derive a identidade da sessão e inclua owner_id/tenant_id no predicado da consulta e da mutação.', 'HIGH', 0.84);
        }

        const hardcodedSecret = this.isHardcodedSecret(line, file);
        if (hardcodedSecret) {
          add('EOS-GENAI-SECRET-001', file, index + 1, 'Possível segredo ou chave de API embutido',
            'Risco: segredo no código pode chegar ao repositório ou bundle do cliente. Correção: revogue/rotacione o valor, mova-o para gerenciamento de segredos e mantenha chaves privilegiadas somente no servidor.', 'CRITICAL', 0.91);
        }

        const userInput = /(?:req(?:uest)?\.body|req\.query|req\.params|formData\s*\(|searchParams)/i.test(line);
        const validated = /(?:safeParse|\.parse\s*\(|validate\s*\(|zod|joi|yup|class-validator|sanitize|normaliz)/i.test(nearby);
        if (userInput && !validated) {
          add('EOS-GENAI-INPUT-001', file, index + 1, 'Entrada do usuário sem validação ou normalização observável',
            'Risco: dados controlados pelo usuário entram no fluxo sem contrato verificável. Correção: valide tipo, tamanho, formato e normalização no boundary do servidor antes de persistir ou consultar.', 'HIGH', 0.76);
        }

        const upload = /(?:upload\.single\s*\(|upload\.array\s*\(|req\.file\b|req\.files\b|input[^\n]{0,80}type\s*=\s*['"]file)/i.test(line);
        const uploadValidated = /(?:fileFilter|mimetype|magic(?:Number|Bytes)?|file-type|limits\s*:|size\s*[<=>])/i.test(nearby);
        if (upload && !uploadValidated) {
          add('EOS-GENAI-UPLOAD-001', file, index + 1, 'Upload sem validação observável de tipo, assinatura ou tamanho',
            'Risco: upload aceita conteúdo inesperado ou excessivo. Correção: valide MIME e assinatura/magic bytes no servidor, imponha limite de tamanho e armazene fora da área executável.', 'HIGH', 0.82);
        }
      });
    }

    findings.push(...this.scanPythonRoutes(files, targetId));

    const frameworkObserved = supabaseUses || firebaseUses;
    const missingPolicy = findings.some(finding => finding.finding_id.startsWith('EOS-GENAI-RLS-'));
    const unverifiedSupabasePolicy = findings.some(finding => finding.finding_id.startsWith('EOS-GENAI-RLS-001'));
    const actionableFindings = findings.filter(finding => !finding.finding_id.startsWith('EOS-GENAI-RLS-001'));
    const hasRuntimeRlsProof = hasProvenRlsClaim;
    const status = actionableFindings.length > 0 ? 'FAIL' : unverifiedSupabasePolicy || (frameworkObserved && !hasRuntimeRlsProof)
      ? 'INSUFFICIENT_EVIDENCE' : 'PASS';
    const rationale = actionableFindings.length > 0
      ? `${actionableFindings.length} risco(s) estático(s) coberto(s) detectado(s); achados heurísticos exigem validação no boundary/runtime.`
      : unverifiedSupabasePolicy
        ? 'Integração Supabase observada, mas a política de acesso não é verificável neste escopo estático; ausência de arquivo local não prova vulnerabilidade remota.'
      : frameworkObserved && !hasRuntimeRlsProof
        ? 'Integração de dados observada sem claim RLS causalmente provado; evidência estática não autoriza aprovação.'
        : frameworkObserved
          ? 'Nenhum padrão estático coberto foi detectado e o claim RLS declarado foi causalmente provado; isto não atesta estado remoto fora do escopo.'
          : 'Nenhum marcador de integração Supabase/Firebase ou padrão de risco coberto foi observado no escopo estático.';
    return { findings, rule: { rule_id: 'EOS-GENAI-SECURITY-001', rule_version: '1.0', status, rationale,
      facts_used: missingPolicy ? [] : hasRuntimeRlsProof ? ['RLS_CAUSAL_PROOF'] : [] } };
  }

  private collectSourceFiles(rootPath: string): SourceFile[] {
    const result: SourceFile[] = [];
    const visit = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!EXCLUDED_DIRECTORIES.has(entry.name)) visit(path.join(directory, entry.name));
          continue;
        }
        const isEnvFile = /^\.env(?:\.|$)/i.test(entry.name);
        if (!entry.isFile() || EXCLUDED_FILENAMES.has(entry.name.toLowerCase())
          || (!SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && !isEnvFile)
          || /\.(?:test|spec)\.[^.]+$/i.test(entry.name)) continue;
        const absolute = path.join(directory, entry.name);
        try {
          const stat = fs.statSync(absolute);
          if (stat.size > 1_000_000) continue;
          const relative = path.relative(rootPath, absolute).replace(/\\/g, '/');
          // O próprio analisador contém assinaturas de detecção como texto; não
          // deve denunciar a si mesmo ao auditar o repositório EOS.
          if (relative.endsWith('core/engines/generated-app-security-engine.ts')) continue;
          result.push({ absolute, relative, lines: fs.readFileSync(absolute, 'utf8').split(/\r?\n/) });
        } catch { /* a cobertura principal já sinaliza arquivos inacessíveis */ }
      }
    };
    visit(rootPath);
    return result;
  }

  private firstMatch(files: readonly SourceFile[], expression: RegExp): { file: SourceFile; line: number } | null {
    for (const file of files) {
      for (let index = 0; index < file.lines.length; index++) if (expression.test(file.lines[index])) return { file, line: index + 1 };
    }
    return null;
  }

  private findSupabaseIntegration(files: readonly SourceFile[], expression: RegExp): { file: SourceFile; line: number } | null {
    const sourceFiles = files.filter(file => ['.py', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(path.extname(file.relative).toLowerCase()));
    const backendPython = sourceFiles.filter(file => file.relative.includes('/backend/') && file.relative.endsWith('.py'));
    return this.firstMatch([...backendPython, ...sourceFiles.filter(file => !backendPython.includes(file))], expression);
  }

  private isHardcodedSecret(line: string, file: SourceFile): boolean {
    const sourceAssignment = new RegExp(`(?:\\b(?:const|let|var)\\s+)?${SECRET_KEY_PATTERN.source}\\s*[:=]\\s*(['"])([^'"\\n]{8,})\\1`, 'i');
    const sourceMatch = line.match(sourceAssignment);
    if (sourceMatch && !PLACEHOLDER_SECRET_PATTERN.test(line)) return true;

    const extension = path.extname(file.relative).toLowerCase();
    const isEnvironmentFile = /^\.env(?:\.|$)/i.test(path.basename(file.relative));
    if (!isEnvironmentFile && !['.toml', '.ini', '.yml', '.yaml', '.json'].includes(extension)) return false;

    if (extension === '.json') {
      for (const jsonAssignment of line.matchAll(/["']([A-Za-z_][\w.-]*)["']\s*:\s*["']([^"']{8,})["']/g)) {
        if (SECRET_KEY_PATTERN.test(jsonAssignment[1]) && !PLACEHOLDER_SECRET_PATTERN.test(jsonAssignment[2])) return true;
      }
      return false;
    }

    const assignment = line.match(/^\s*["']?([A-Za-z_][\w.-]*)["']?\s*[:=]\s*(.*?)\s*,?\s*$/);
    if (!assignment || !SECRET_KEY_PATTERN.test(assignment[1]) || PLACEHOLDER_SECRET_PATTERN.test(assignment[2])) return false;

    let value = assignment[2].trim();
    if (extension !== '.json' && !isEnvironmentFile) value = value.replace(/\s+#.*$/, '').trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    } else if (!isEnvironmentFile || !/^[A-Za-z0-9+/=_-]{16,}$/.test(value)) {
      return false;
    }

    return value.length >= 8 && !PLACEHOLDER_SECRET_PATTERN.test(value);
  }

  private createFinding(ruleRef: string, file: SourceFile, line: number, title: string, description: string,
    severity: Finding['severity'], confidence: number, targetId: string): Finding {
    const location = `${file.relative}:${line}`;
    const seed = `${ruleRef}|${location}|${title}`;
    const catalogRule = RuleCatalog.getRule(ruleRef);
    return {
      finding_id: `${ruleRef}-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 12)}`,
      rule_id: 'EOS-GENAI-SECURITY-001', rule_version: '1.0', fact_ids: [],
      evidence_ids: [`EVD-GENAI-${crypto.createHash('sha256').update(location).digest('hex').slice(0, 16)}`],
      target_id: targetId, location, title, description, severity, confidence, status: 'OPEN', timestamp: new Date().toISOString(),
      ...(catalogRule ? {
        taxonomy: {
          rule_ref: ruleRef,
          owasp_category: catalogRule.taxonomy.owasp_category,
          cwe_id: catalogRule.taxonomy.cwe_id,
          cvss_v4_vector: catalogRule.cvss_v4_vector,
          nist_sp_800_53: catalogRule.taxonomy.nist_sp_800_53,
          mitre_attack_id: catalogRule.taxonomy.mitre_attack_id,
        },
      } : {}),
    };
  }

  private scanPythonRoutes(files: readonly SourceFile[], targetId: string): Finding[] {
    const findings: Finding[] = [];
    const add = (ruleId: string, file: SourceFile, line: number, title: string, description: string,
      severity: Finding['severity'], confidence: number): void => {
      findings.push(this.createFinding(ruleId, file, line, title, description, severity, confidence, targetId));
    };

    for (const file of files.filter(candidate => candidate.relative.endsWith('.py'))) {
      for (let routeIndex = 0; routeIndex < file.lines.length; routeIndex++) {
        if (!/^\s*@\w+(?:\.\w+)*\.route\s*\(/.test(file.lines[routeIndex])) continue;
        let functionIndex = routeIndex + 1;
        while (functionIndex < file.lines.length && !/^\s*def\s+\w+\s*\(/.test(file.lines[functionIndex])) functionIndex++;
        if (functionIndex >= file.lines.length) continue;

        let endIndex = functionIndex + 1;
        while (endIndex < file.lines.length && (/^\s*$/.test(file.lines[endIndex]) || /^\s+/.test(file.lines[endIndex]))) endIndex++;
        const body = file.lines.slice(functionIndex, endIndex);
        const block = file.lines.slice(routeIndex, endIndex);
        const methodsMatch = file.lines[routeIndex].match(/methods\s*=\s*\[([^\]]+)\]/i);
        const methods = methodsMatch?.[1].match(/['"](POST|PUT|PATCH|DELETE)['"]/gi) || [];
        if (methods.length === 0) continue;

        const optionalAuthIndex = block.findIndex(line => /@jwt_required\s*\(\s*optional\s*=\s*True\s*\)/i.test(line));
        const hasLocalAuthorization = /(?:get_user_if_exists|get_jwt_identity|current_user|owner|authorization|permission)/i.test(body.join('\n'));
        const uploadIndex = body.findIndex(line => /(?:request\.files|save_upload_files\s*\()/i.test(line));
        if (optionalAuthIndex >= 0 && !hasLocalAuthorization && uploadIndex < 0) {
          add('EOS-GENAI-PY-OPTIONAL-WRITE-001', file, routeIndex + optionalAuthIndex + 1,
            'Rota de escrita permite sessão anônima sem autorização local observável',
            'Sinal estático: a rota aceita ausência de JWT e altera dados sem checagem local observável de proprietário/papel. Contribuição anônima pode ser uma política intencional; confirme-a e imponha whitelist, rate limit e validação de identidade/recurso conforme aplicável. Isto não comprova exploração.',
            'MEDIUM', 0.72);
        }
        if (optionalAuthIndex >= 0 && uploadIndex >= 0 && !hasLocalAuthorization) {
          add('EOS-GENAI-PY-UPLOAD-AUTHZ-001', file, functionIndex + uploadIndex + 1,
            'Upload em rota com autenticação opcional sem autorização de recurso observável',
            'Sinal estático: a rota permite sessão ausente e processa upload sem checagem local observável de propriedade ou associação entre os recursos. Confirme a política de contribuição anônima e valide no servidor o vínculo site/visita/usuário; isto não comprova exploração.',
            'HIGH', 0.86);
        }

        const massAssignmentIndex = body.findIndex(line => /hasattr\s*\(\s*[A-Za-z_]\w*\s*,\s*field\s*\)/i.test(line));
        if (massAssignmentIndex >= 0 && /request(?:\.get_json\s*\(|_data\b)/i.test(body.join('\n')) && /\*\*\s*\w+/.test(body.join('\n'))) {
          add('EOS-GENAI-PY-MASSASSIGN-001', file, functionIndex + massAssignmentIndex + 1,
            'Mass-assignment baseado em campos controlados pela requisição',
            'Sinal estático: nomes de campos da requisição são aceitos dinamicamente e encaminhados ao construtor do modelo. Use uma whitelist explícita de campos graváveis e derive identidade/IDs privilegiados da sessão; confirme com teste HTTP adversarial.',
            'HIGH', 0.9);
        }
      }
    }
    return findings;
  }
}
