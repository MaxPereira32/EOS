import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { GeneratedAppSecurityEngine } from '../core/engines/generated-app-security-engine';

test('detecta riscos comuns de app gerado por IA com arquivo e linha verificáveis', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-generated-security-'));
  try {
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'app.ts'), [
      "import { createClient } from '@supabase/supabase-js';",
      "const apiKey = 'sk_live_abcdefghijk';",
      "if (user.role === 'admin') window.showAdmin = true;",
      "const row = await prisma.document.findUnique({ where: { id: req.params.id } });",
      'const payload = req.body;',
      'upload.single(\'file\');',
      'const client = createClient(url, key);',
    ].join('\n'));
    const result = new GeneratedAppSecurityEngine().scan(root, 'TARGET-TEST', false);
    const ids = result.findings.map(finding => finding.finding_id.split('-').slice(0, 4).join('-'));
    assert.ok(ids.includes('EOS-GENAI-RLS-001'));
    assert.ok(ids.includes('EOS-GENAI-AUTHZ-001'));
    assert.ok(ids.includes('EOS-GENAI-IDOR-001'));
    assert.ok(ids.includes('EOS-GENAI-SECRET-001'));
    assert.ok(ids.includes('EOS-GENAI-INPUT-001'));
    assert.ok(ids.includes('EOS-GENAI-UPLOAD-001'));
    assert.equal(result.rule.status, 'FAIL');
    const secretFinding = result.findings.find(finding => finding.finding_id.startsWith('EOS-GENAI-SECRET-001'));
    assert.equal(secretFinding?.taxonomy?.cwe_id, 'CWE-798: Use of Hard-coded Credentials');
    assert.match(secretFinding?.taxonomy?.cvss_v4_vector ?? '', /^CVSS:4\.0\//);
    const idorFinding = result.findings.find(finding => finding.finding_id.startsWith('EOS-GENAI-IDOR-001'));
    assert.match(idorFinding?.taxonomy?.cwe_id ?? '', /CWE-639/);
    for (const finding of result.findings) {
      assert.match(finding.location, /^src\/app\.ts:\d+$/);
      if (finding.finding_id.startsWith('EOS-GENAI-RLS-001')) {
        assert.match(finding.description, /não prova ausência de política/i);
      } else {
        assert.match(finding.description, /Risco:.*Correção:/s);
      }
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('integração de dados sem claim RLS causalmente provado permanece inconclusiva', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-generated-rls-evidence-'));
  try {
    fs.mkdirSync(path.join(root, 'supabase'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src.ts'), "import { createClient } from '@supabase/supabase-js';\ncreateClient(url, key);\n");
    fs.writeFileSync(path.join(root, 'supabase', 'policy.sql'), 'ALTER TABLE documents ENABLE ROW LEVEL SECURITY;\nCREATE POLICY tenant ON documents USING (true);\n');
    const insufficient = new GeneratedAppSecurityEngine().scan(root, 'TARGET-TEST', false);
    const proven = new GeneratedAppSecurityEngine().scan(root, 'TARGET-TEST', true);
    assert.equal(insufficient.findings.length, 0);
    assert.equal(insufficient.rule.status, 'INSUFFICIENT_EVIDENCE');
    assert.equal(proven.rule.status, 'PASS');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('detecta segredos literais em TOML, INI, YAML, JSON e .env sem reportar placeholders', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-generated-config-secrets-'));
  try {
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.writeFileSync(path.join(root, 'config', 'config.toml'), [
      "JWT_SECRET_KEY = 'jwt-secret-value-1234567890'",
      "SECRET_KEY = 'flask-secret-value-1234567890'",
    ].join('\n'));
    fs.writeFileSync(path.join(root, 'config', 'mail.ini'), [
      "MAIL_AUTH_PASSWD = 'ini-secret-value-1234567890'",
      "MAIL_RELAY_PASSWD = 'smtpd/relay host password'",
    ].join('\n'));
    fs.writeFileSync(path.join(root, 'config', 'service.yaml'), "service_role_token: 'yaml-secret-value-1234567890'\n");
    fs.writeFileSync(path.join(root, 'config', 'service.json'), '{"public_name":"sample-service","private_api_key":"json-secret-value-1234567890"}\n');
    fs.writeFileSync(path.join(root, '.env'), 'GNCITIZEN_SERVICE_ROLE_KEY=real-env-secret-value-1234567890\n');
    fs.writeFileSync(path.join(root, '.env.example'), [
      'GNCITIZEN_API_TOKEN=replace_me_with_a_real_token',
    ].join('\n'));
    fs.writeFileSync(path.join(root, 'package-lock.json'), '{"service_role_key":"dependency-metadata-is-not-a-secret"}\n');

    const result = new GeneratedAppSecurityEngine().scan(root, 'TARGET-TEST', false);
    const secretFindings = result.findings.filter(finding => finding.finding_id.startsWith('EOS-GENAI-SECRET-001'));
    assert.equal(secretFindings.length, 6);
    assert.deepEqual(new Set(secretFindings.map(finding => finding.location.split(':')[0])), new Set([
      'config/config.toml', 'config/mail.ini', 'config/service.yaml', 'config/service.json', '.env',
    ]));
    assert.ok(secretFindings.every(finding => finding.severity === 'CRITICAL'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('detecta mass-assignment e upload sem autorização observável em rotas Flask', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-generated-flask-routes-'));
  try {
    fs.mkdirSync(path.join(root, 'backend', 'gncitizen', 'core', 'sites'), { recursive: true });
    fs.writeFileSync(path.join(root, 'backend', 'gncitizen', 'core', 'sites', 'routes.py'), [
      '@sites_api.route("/", methods=["POST"])',
      '@json_resp',
      '@jwt_required(optional=True)',
      'def post_site():',
      '    request_data = dict(request.get_json())',
      '    datas2db = {}',
      '    for field in request_data:',
      '        if hasattr(SiteModel, field):',
      '            datas2db[field] = request_data[field]',
      '    newsite = SiteModel(**datas2db)',
      '',
      '@sites_api.route("/<int:site_id>/visits/<int:visit_id>/photos", methods=["POST"])',
      '@json_resp',
      '@jwt_required(optional=True)',
      'def post_photo(site_id, visit_id):',
      '    if request.files:',
      '        return save_upload_files(request.files)',
    ].join('\n'));

    const result = new GeneratedAppSecurityEngine().scan(root, 'TARGET-TEST', false);
    const massAssignment = result.findings.find(finding => finding.finding_id.startsWith('EOS-GENAI-PY-MASSASSIGN-001'));
    const optionalWrite = result.findings.find(finding => finding.finding_id.startsWith('EOS-GENAI-PY-OPTIONAL-WRITE-001'));
    const uploadAuthorization = result.findings.find(finding => finding.finding_id.startsWith('EOS-GENAI-PY-UPLOAD-AUTHZ-001'));
    assert.equal(massAssignment?.location, 'backend/gncitizen/core/sites/routes.py:8');
    assert.equal(optionalWrite?.location, 'backend/gncitizen/core/sites/routes.py:3');
    assert.equal(uploadAuthorization?.location, 'backend/gncitizen/core/sites/routes.py:16');
    assert.equal(massAssignment?.severity, 'HIGH');
    assert.equal(optionalWrite?.severity, 'MEDIUM');
    assert.equal(uploadAuthorization?.severity, 'HIGH');
    assert.match(optionalWrite?.description || '', /não comprova exploração/i);
    assert.match(uploadAuthorization?.description || '', /não comprova exploração/i);
    assert.equal(massAssignment?.taxonomy?.rule_ref, 'EOS-GENAI-PY-MASSASSIGN-001');
    assert.match(massAssignment?.taxonomy?.cwe_id ?? '', /CWE-915/);
    assert.match(uploadAuthorization?.taxonomy?.cwe_id ?? '', /CWE-862/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('usa a integração Supabase do backend como localização e ignora Array.from()', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-generated-supabase-location-'));
  try {
    fs.mkdirSync(path.join(root, 'backend', 'gncitizen', 'utils'), { recursive: true });
    fs.mkdirSync(path.join(root, 'frontend', 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'backend', 'gncitizen', 'utils', 'storage.py'), [
      'url = os.environ.get("GNCITIZEN_SUPABASE_URL")',
      'service_key = os.environ.get("GNCITIZEN_SUPABASE_SERVICE_ROLE_KEY")',
    ].join('\n'));
    fs.writeFileSync(path.join(root, 'frontend', 'src', 'component.ts'), [
      'return Array.from(new Set(values));',
    ].join('\n'));

    const result = new GeneratedAppSecurityEngine().scan(root, 'TARGET-TEST', false);
    const rlsFinding = result.findings.find(finding => finding.finding_id.startsWith('EOS-GENAI-RLS-001'));
    assert.equal(rlsFinding?.location, 'backend/gncitizen/utils/storage.py:1');
    assert.equal(rlsFinding?.severity, 'MEDIUM');
    assert.match(rlsFinding?.description || '', /não prova ausência de política/i);
    assert.equal(result.rule.status, 'INSUFFICIENT_EVIDENCE');

    const runtimeProven = new GeneratedAppSecurityEngine().scan(root, 'TARGET-TEST', true);
    assert.equal(runtimeProven.findings.some(finding => finding.finding_id.startsWith('EOS-GENAI-RLS-001')), false);
    assert.equal(runtimeProven.rule.status, 'PASS');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Array.from() sozinho não é classificado como integração Supabase', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-generated-array-from-'));
  try {
    fs.writeFileSync(path.join(root, 'component.ts'), 'return Array.from(values);\n');
    const result = new GeneratedAppSecurityEngine().scan(root, 'TARGET-TEST', false);
    assert.equal(result.findings.some(finding => finding.finding_id.startsWith('EOS-GENAI-RLS-001')), false);
    assert.equal(result.rule.status, 'PASS');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Array.from() não é classificado como acesso a dados/autorização frontend', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-generated-array-authz-'));
  try {
    fs.writeFileSync(path.join(root, 'component.ts'), [
      "if (user.role === 'admin') window.showAdmin = true;",
      'const values = Array.from(items);',
    ].join('\n'));
    const result = new GeneratedAppSecurityEngine().scan(root, 'TARGET-TEST', false);
    assert.equal(result.findings.some(finding => finding.finding_id.startsWith('EOS-GENAI-AUTHZ-001')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('ignora ambientes virtuais Python ao ampliar a coleta de formatos', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-generated-python-venv-'));
  try {
    const dependencyPath = path.join(root, '.venv', 'Lib', 'site-packages', 'dependency.py');
    fs.mkdirSync(path.dirname(dependencyPath), { recursive: true });
    fs.writeFileSync(dependencyPath, [
      '@api.route("/upload", methods=["POST"])',
      '@jwt_required(optional=True)',
      'def upload():',
      '    return save_upload_files(request.files)',
      "SECRET_KEY = 'third-party-dependency-secret-value'",
    ].join('\n'));
    const result = new GeneratedAppSecurityEngine().scan(root, 'TARGET-TEST', false);
    assert.equal(result.findings.length, 0);
    assert.equal(result.rule.status, 'PASS');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
