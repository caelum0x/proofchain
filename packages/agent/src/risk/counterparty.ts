/**
 * Counterparty / KYC risk lens.
 *
 * Assesses whether the trading party is identifiable and consistent. Signals:
 * an unset (zero-address) or unregistered on-chain supplier, documents that
 * disagree on the party name (SUPPLIER_MISMATCH), documents that name no party
 * at all (nothing to KYC), and a missing provenance trail (no third-party
 * checkpoints corroborating the counterparty). Deterministic and total.
 */
import { registerRiskModel, riskLevel } from './registry.js';
import type { RiskContext } from './registry.js';
import { ZERO_ADDRESS, clampRiskBps, countByCode } from './util.js';

const SUPPLIER_MISMATCH_CODES = new Set(['SUPPLIER_MISMATCH']);

const UNKNOWN_SUPPLIER_BPS = 4_000;
const MISMATCH_BPS = 3_000;
const NO_NAMED_PARTY_BPS = 1_500;
const NO_TRAIL_BPS = 800;

export const counterpartyRiskModel = registerRiskModel({
  id: 'counterparty',
  description:
    'Counterparty/KYC risk from on-chain supplier identity, party-name consistency and trail depth.',
  assess: (ctx: RiskContext) => {
    const factors: string[] = [];
    let score = 0;

    const supplier = ctx.provenance.supplier.toLowerCase();
    if (!ctx.provenance.exists || supplier === ZERO_ADDRESS) {
      score += UNKNOWN_SUPPLIER_BPS;
      factors.push('unknown_onchain_supplier');
    }

    const mismatches = countByCode(ctx.findings, SUPPLIER_MISMATCH_CODES);
    if (mismatches > 0) {
      score += MISMATCH_BPS;
      factors.push(`supplier_name_mismatch(${mismatches})`);
    }

    const namedParty = ctx.documents.some((doc) => {
      const name = doc.fields.supplierName?.trim();
      return name !== undefined && name.length > 0;
    });
    if (ctx.documents.length > 0 && !namedParty) {
      score += NO_NAMED_PARTY_BPS;
      factors.push('no_named_party');
    }

    if (ctx.provenance.checkpoints.length === 0) {
      score += NO_TRAIL_BPS;
      factors.push('no_provenance_trail');
    }

    const bounded = clampRiskBps(score);
    return {
      model: 'counterparty',
      score: bounded,
      level: riskLevel(bounded),
      factors,
    };
  },
});
