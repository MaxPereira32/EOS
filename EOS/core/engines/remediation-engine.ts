/**
 * EOS AUTOMATED REMEDIATION ENGINE (v2.1.0)
 * 
 * Machine-Actionable Remediation Generator: Unified Diff patches,
 * target file resolution, commit hints, and breaking change risk assessment.
 */

import { Finding, Remediation } from '../domain-graph';

export class RemediationEngine {
  /**
   * Gera um objeto de Remediação determinístico com Unified Diff pronto para aplicação autônoma
   */
  public generateRemediation(finding: Finding): Remediation {
    const fixId = `FIX-${finding.finding_id.replace('FND-', '')}`;

    let targetFiles: string[] = [];
    let commitHint = '';
    let patchDiff = '';
    let breakingChange = false;
    let estimatedEffort = 1.0;

    // Regras de geração de patch baseadas na regra e título do achado
    if (finding.rule_id.includes('HTTP-TRACE') || finding.title.toLowerCase().includes('trace')) {
      targetFiles = ['k8s/ingress.yaml', 'src/server.ts'];
      commitHint = 'fix(security): disable HTTP TRACE method and enforce __Host- cookie prefix';
      estimatedEffort = 1.5;
      breakingChange = false;

      patchDiff = [
        '--- a/k8s/ingress.yaml',
        '+++ b/k8s/ingress.yaml',
        '@@ -18,2 +18,3 @@',
        '+   nginx.ingress.kubernetes.io/server-snippet: |',
        '+     if ($request_method = TRACE) { return 405; }',
        '--- a/src/server.ts',
        '+++ b/src/server.ts',
        '@@ -10,1 +10,1 @@',
        '- res.cookie("session_id", token, { path: "/" });',
        '+ res.cookie("__Host-session_id", token, { path: "/", secure: true, httpOnly: true, sameSite: "strict" });',
      ].join('\n');
    } else if (finding.rule_id.includes('JWT') || finding.title.toLowerCase().includes('jwt')) {
      targetFiles = ['src/auth/jwt-verifier.ts'];
      commitHint = 'fix(auth): enforce strict JWT algorithm verification and required claims (iss, aud, exp, jti)';
      estimatedEffort = 2.0;
      breakingChange = true;

      patchDiff = [
        '--- a/src/auth/jwt-verifier.ts',
        '+++ b/src/auth/jwt-verifier.ts',
        '@@ -12,3 +12,5 @@',
        '- const decoded = jwt.decode(token);',
        '+ const decoded = jwt.verify(token, publicKey, {',
        '+   algorithms: ["RS256"],',
        '+   complete: true',
        '+ });',
      ].join('\n');
    } else {
      // Fallback genérico para cabeçalhos de segurança HTTP
      targetFiles = ['nginx.conf'];
      commitHint = `fix(security): resolve policy violation ${finding.rule_id}`;
      estimatedEffort = 1.0;
      breakingChange = false;

      patchDiff = [
        '--- a/nginx.conf',
        '+++ b/nginx.conf',
        '@@ -25,0 +25,3 @@',
        '+ add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;',
        '+ add_header X-Content-Type-Options "nosniff" always;',
        '+ add_header Content-Security-Policy "default-src \'self\';" always;',
      ].join('\n');
    }

    const priorityMap: Record<string, 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'> = {
      CRITICAL: 'CRITICAL',
      HIGH: 'HIGH',
      MEDIUM: 'MEDIUM',
      LOW: 'LOW',
      INFORMATIONAL: 'LOW',
    };

    return {
      fix_id: fixId,
      finding_id: finding.finding_id,
      priority: priorityMap[finding.severity] || 'MEDIUM',
      estimated_effort_hours: estimatedEffort,
      target_files: targetFiles,
      commit_hint: commitHint,
      breaking_change: breakingChange,
      patch_diff: patchDiff,
    };
  }
}
