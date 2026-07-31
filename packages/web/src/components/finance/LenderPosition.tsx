"use client";

import { useAccount } from "wagmi";
import { Card, CardHeader } from "@/components/ui/Card";
import { formatTokenAmount } from "@/lib/format";
import { navPerShare } from "@/lib/finance";
import type { PoolView } from "@/hooks/usePool";

/**
 * The connected lender's position in a pool: shares held, current redeemable
 * value, and unrealised gain implied by NAV appreciation over par.
 */
export function LenderPosition({ pool }: { pool: PoolView }) {
  const { isConnected } = useAccount();
  if (!isConnected) return null;

  const nav = navPerShare(pool.totalAssets, pool.totalShares);
  // Par value = shares at 1.0 NAV; gain = current assets − par (only meaningful when appreciated).
  const parValue = pool.userShares;
  const gain = pool.userAssets > parValue ? pool.userAssets - parValue : 0n;
  const poolSharePct =
    pool.totalShares > 0n ? Number((pool.userShares * 10_000n) / pool.totalShares) / 100 : 0;

  return (
    <Card>
      <CardHeader title="Your position" description="Vault shares and their current redeemable value." />
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Shares</dt>
          <dd className="mt-1 font-semibold text-fg">
            {formatTokenAmount(pool.userShares, pool.shareDecimals)} {pool.shareSymbol}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Redeemable value</dt>
          <dd className="mt-1 font-semibold text-fg">
            {formatTokenAmount(pool.userAssets, pool.assetDecimals)} {pool.assetSymbol}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Pool share</dt>
          <dd className="mt-1 font-semibold text-fg">{poolSharePct.toFixed(2)}%</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Unrealised yield</dt>
          <dd className="mt-1 font-semibold text-success">
            {gain > 0n ? "+" : ""}
            {formatTokenAmount(gain, pool.assetDecimals)} {pool.assetSymbol}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted">NAV/share {nav.toFixed(4)} — yield accrues as financed receivables settle.</p>
    </Card>
  );
}
