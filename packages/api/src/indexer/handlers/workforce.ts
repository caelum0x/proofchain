/**
 * Workforce group handler — the human-centric Industrial 5.0 layer.
 *
 * Owns `src/workforce/*` (soulbound worker credentials, safety training,
 * milestone payroll, skills, labor compliance). Beyond the audit table it
 * projects two read models:
 *   - WorkerCredential → `worker_credentials` (`CredentialIssued` establishes the
 *     row; `CredentialStatusChanged` transitions status).
 *   - MilestonePayroll → `payroll` (`AgreementCreated` establishes the agreement;
 *     `MilestoneReleased`/`AgreementCancelled` transition status).
 */
import type { DecodedEvent, HandlerDeps } from '../types.js';
import { makeHandler, type Projector } from './base.js';
import { asNumber, lower, str } from './util.js';

/** Contracts routed to this handler (feeds the derived contract→group table). */
const CONTRACTS: readonly string[] = [
  'WorkerCredential',
  'SafetyTrainingRegistry',
  'MilestonePayroll',
  'SkillAttestation',
  'LaborComplianceRegistry',
];

type CredentialRow = {
  id: string;
  token_id: string | null;
  worker: string;
  issuer: string | null;
  status: string;
  metadata: Record<string, unknown>;
};

type PayrollRow = {
  id: string;
  worker: string;
  employer: string | null;
  token: string | null;
  amount: string;
  status: string;
  metadata: Record<string, unknown>;
};

/**
 * On-chain `CredentialStatus` enum value → `worker_credentials.status`. Numeric
 * values mirror the Solidity enum order (`None=0, Active=1, Suspended=2, Revoked=3`).
 */
const CREDENTIAL_STATUS_TOKEN: Readonly<Record<number, string>> = Object.freeze({
  1: 'active',
  2: 'suspended',
  3: 'revoked',
});

/** MilestonePayroll event → `payroll.status` (transition-only events). */
const PAYROLL_STATUS_BY_EVENT: Readonly<Record<string, string>> = Object.freeze({
  MilestoneApproved: 'approved',
  MilestoneReleased: 'paid',
  AgreementCancelled: 'cancelled',
});

const projectCredential = async (
  event: DecodedEvent,
  deps: HandlerDeps,
): Promise<void> => {
  const tokenId = str(event.args.tokenId);
  if (tokenId === undefined) {
    deps.logger.warn(
      { event: event.eventName, tx: event.transactionHash },
      'workforce: credential event missing tokenId; skipping projection',
    );
    return;
  }

  if (event.eventName === 'CredentialIssued') {
    const worker = lower(event.args.worker);
    if (worker === undefined) {
      deps.logger.warn(
        { event: event.eventName, tx: event.transactionHash },
        'workforce: CredentialIssued missing worker; skipping projection',
      );
      return;
    }
    await deps.db.upsert<CredentialRow>(
      'worker_credentials',
      {
        id: tokenId,
        token_id: tokenId,
        worker,
        issuer: lower(event.args.issuer) ?? null,
        status: 'active',
        metadata: 'role' in event.args ? { role: event.args.role } : {},
      },
      'id',
    );
    return;
  }

  if (event.eventName === 'CredentialStatusChanged') {
    const nextStatus = CREDENTIAL_STATUS_TOKEN[asNumber(event.args.status) ?? -1];
    if (nextStatus === undefined) return; // status not representable in read model
    const existing = await deps.db.getBy<CredentialRow>('worker_credentials', 'id', tokenId);
    if (existing === null) {
      deps.logger.warn(
        { event: event.eventName, tokenId },
        'workforce: CredentialStatusChanged for unknown credential; audit-only',
      );
      return;
    }
    await deps.db.upsert<CredentialRow>(
      'worker_credentials',
      { ...existing, status: nextStatus },
      'id',
    );
  }
};

const projectPayroll = async (
  event: DecodedEvent,
  deps: HandlerDeps,
): Promise<void> => {
  const agreementId = lower(event.args.agreementId);
  if (agreementId === undefined) {
    deps.logger.warn(
      { event: event.eventName, tx: event.transactionHash },
      'workforce: payroll event missing agreementId; skipping projection',
    );
    return;
  }

  if (event.eventName === 'AgreementCreated') {
    const worker = lower(event.args.worker);
    const amount = str(event.args.totalAmount);
    if (worker === undefined || amount === undefined) {
      deps.logger.warn(
        { event: event.eventName, tx: event.transactionHash },
        'workforce: AgreementCreated missing required fields; skipping projection',
      );
      return;
    }
    await deps.db.upsert<PayrollRow>(
      'payroll',
      {
        id: agreementId,
        worker,
        employer: lower(event.args.employer) ?? null,
        token: lower(event.args.token) ?? null,
        amount,
        status: 'pending',
        metadata: {},
      },
      'id',
    );
    return;
  }

  const nextStatus = PAYROLL_STATUS_BY_EVENT[event.eventName];
  if (nextStatus === undefined) return; // non-lifecycle payroll event — audit only
  const existing = await deps.db.getBy<PayrollRow>('payroll', 'id', agreementId);
  if (existing === null) {
    deps.logger.warn(
      { event: event.eventName, agreementId },
      'workforce: payroll transition for unknown agreement; audit-only',
    );
    return;
  }
  await deps.db.upsert<PayrollRow>(
    'payroll',
    { ...existing, status: nextStatus },
    'id',
  );
};

const projectWorkforce: Projector = async (
  event: DecodedEvent,
  deps: HandlerDeps,
) => {
  if (!deps.db.isConfigured) return;
  const contract: string = event.contract; // widen for sound literal comparison
  if (contract === 'WorkerCredential') {
    await projectCredential(event, deps);
    return;
  }
  if (contract === 'MilestonePayroll') {
    await projectPayroll(event, deps);
  }
};

export default makeHandler('workforce', projectWorkforce, CONTRACTS);
