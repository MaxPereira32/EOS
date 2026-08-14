import * as crypto from 'crypto';

export class ReportIntegritySigner {
  private static readonly SECRET_SALT = 'EOS_PHASE_4_1_CANONICAL_INTEGRITY_SALT_2026';

  /**
   * Calcula o hash HMAC-SHA256 do relatório canônico
   */
  public static signReportContent(reportJson: object): string {
    const canonicalString = JSON.stringify(reportJson, Object.keys(reportJson).sort());
    return crypto
      .createHmac('sha256', this.SECRET_SALT)
      .update(canonicalString)
      .digest('hex');
  }

  /**
   * Verifica a integridade e autenticidade do relatório em relação à assinatura HMAC
   */
  public static verifyReportContent(reportJson: object, signature: string): boolean {
    if (!signature) return false;
    const computed = this.signReportContent(reportJson);
    return computed === signature;
  }
}
