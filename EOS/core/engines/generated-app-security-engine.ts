import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Finding, RuleEvaluationResult } from '../domain/types';

interface SourceFile { readonly absolute: string; readonly relative: string; readonly lines: readonly string[]; }

export interface GeneratedAppSecurityResult {
  readonly findings: readonly Finding[];
  readonly rule: RuleEvaluationResult;
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.sql', '.rules']);
const EXCLUDED_DIRECTORIES = new Set(['.git', '.eos', 'node_modules', 'dist', 'build', 'coverage', '.next', 'vendor']);

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
      const location = `${file.relative}:${line}`;
      const seed = `${ruleId}|${location}|${title}`;
      findings.push({
        finding_id: `${ruleId}-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 12)}`,
        rule_id: 'EOS-GENAI-SECURITY-001', rule_version: '1.0', fact_ids: [],
        evidence_ids: [`EVD-GENAI-${crypto.createHash('sha256').update(location).digest('hex').slice(0, 16)}`],
        target_id: targetId, location, title, description, severity, confidence, status: 'OPEN', timestamp: new Date().toISOString(),
      });
    };

    const text = files.map(file => file.lines.join('\n')).join('\n');
    const supabaseUses = /(?:createClient\s*\(|\.from\s*\(|@supabase\/supabase-js)/i.test(text);
    const firebaseUses = /(?:initializeApp\s*\(|getFirestore\s*\(|firebase\/firestore|firebase\/app)/i.test(text);
    const supabasePolicy = /(?:alter\s+table[\s\S]{0,300}enable\s+row\s+level\s+security|create\s+policy)/i.test(text);
    const firebaseRules = files.some(file => file.relative.endsWith('.rules')
      && /service\s+cloud\.firestore/i.test(file.lines.join('\n')) && /allow\s+(?:read|write)/i.test(file.lines.join('\n')));

    if (supabaseUses && !supabasePolicy) {
      const location = this.firstMatch(files, /(?:createClient\s*\(|\.from\s*\(|@supabase\/supabase-js)/i);
      if (location) add('EOS-GENAI-RLS-001', location.file, location.line, 'Supabase sem política RLS verificável',
        'Risco: o código usa Supabase, mas não há política SQL/RLS estática aplicável no escopo auditado. Correção: habilite RLS, crie policies por operação/tenant e declare um claim RLS com execução contra PostgreSQL descartável.', 'CRITICAL', 0.92);
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
      const dataAccess = /(?:\.from\s*\(|fetch\s*\(|axios\.|prisma\.|find(?:Unique|ById)\s*\()/i.test(content);
      const serverAuthorization = /(?:verify(?:Id)?Token|requireAuth|authenticate|middleware|currentUser\s*\(|getServerSession|request\.auth)/i.test(content);
      if (looksClient && frontendAuthorization && dataAccess && !serverAuthorization) {
        const match = this.firstMatch([file], /(?:\.from\s*\(|fetch\s*\(|axios\.|prisma\.|find(?:Unique|ById)\s*\()/i);
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

        const hardcodedSecret = /\b(?:api[_-]?key|secret|token|password|service[_-]?role(?:[_-]?key)?)\b\s*[:=]\s*['"][^'"]{8,}['"]/i.test(line)
          && !/process\.env|import\.meta\.env|example|placeholder/i.test(line);
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

    const frameworkObserved = supabaseUses || firebaseUses;
    const missingPolicy = findings.some(finding => finding.finding_id.startsWith('EOS-GENAI-RLS-'));
    const hasRuntimeRlsProof = hasProvenRlsClaim;
    const status = findings.length > 0 ? 'FAIL' : frameworkObserved && !hasRuntimeRlsProof ? 'INSUFFICIENT_EVIDENCE' : 'PASS';
    const rationale = findings.length > 0
      ? `${findings.length} risco(s) de segurança detectado(s); cada finding contém arquivo, linha e orientação de correção.`
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
        if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) || /\.(?:test|spec)\.[^.]+$/i.test(entry.name)) continue;
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
}
