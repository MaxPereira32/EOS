/**
 * EOS CORE DOMAIN - APPROVAL RECORD CONTRACTS
 * Immutable governance decision event binding human approval to planHash.
 */

export interface ApprovalRecord {
  readonly approvalId: string;
  readonly planId: string;
  readonly approvedPlanHash: string; // Must match ActionPlan.planHash
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly decision: 'APPROVED' | 'REJECTED';
  readonly signature: string; // Governance HMAC signature
}
