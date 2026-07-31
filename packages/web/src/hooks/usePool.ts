"use client";

import { useCallback } from "react";
import type { Abi, Address } from "viem";
import { useAccount, useReadContract, useWatchContractEvent } from "wagmi";
import { getAbi, mockUsdcAbi } from "@/lib/abis";
import { getResolvedAddress } from "@/lib/shared";
import { navPerShare, utilizationBps } from "@/lib/finance";

const POOL_ABI = getAbi("FinancingPool") as Abi;
const VAULT_ABI = getAbi("LenderVault") as Abi;

export interface PoolView {
  /** Deployed FinancingPool address (the pool "id"). */
  readonly poolAddress?: Address;
  readonly vaultAddress?: Address;
  readonly assetAddress?: Address;
  readonly assetSymbol: string;
  readonly assetDecimals: number;
  readonly shareSymbol: string;
  readonly shareDecimals: number;
  /** Total assets managed by the vault (idle + deployed), in asset base units. */
  readonly totalAssets: bigint;
  readonly totalShares: bigint;
  /** Idle liquidity available to allocate/withdraw. */
  readonly totalLiquidity: bigint;
  /** Principal currently advanced into receivables. */
  readonly deployedAssets: bigint;
  /** Worst risk grade the pool will fund (1 best .. 7 worst). */
  readonly maxGrade: number;
  readonly utilizationBps: number;
  readonly navPerShare: number;
  // connected lender position
  readonly userShares: bigint;
  readonly userAssets: bigint;
  readonly userAssetBalance: bigint;
  /** Asset allowance the lender granted the pool (for deposits). */
  readonly assetAllowance: bigint;
  /** Share allowance the lender granted the pool (for withdrawals). */
  readonly shareAllowance: bigint;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly refetch: () => void;
}

/**
 * Reads the on-chain state of the FinancingPool + its ERC4626 LenderVault, plus
 * the connected lender's position and the approvals needed for deposit/withdraw.
 * A single pool/vault is deployed; `poolAddress` selects it (and validates the
 * routed id). Stays live via Deposit/Withdraw event subscriptions.
 */
export function usePool(poolAddress?: Address): PoolView {
  const { address: account } = useAccount();
  const pool = poolAddress ?? getResolvedAddress("FinancingPool");
  const vault = getResolvedAddress("LenderVault");

  const useRd = (address: Address | undefined, abi: Abi, functionName: string, args?: readonly unknown[], enabled = true) =>
    useReadContract({ address, abi, functionName, args, query: { enabled: Boolean(address) && enabled } });

  const assetQ = useRd(vault, VAULT_ABI, "asset");
  const asset = assetQ.data as Address | undefined;

  const totalAssetsQ = useRd(vault, VAULT_ABI, "totalAssets");
  const totalSharesQ = useRd(vault, VAULT_ABI, "totalSupply");
  const shareDecimalsQ = useRd(vault, VAULT_ABI, "decimals");
  const shareSymbolQ = useRd(vault, VAULT_ABI, "symbol");
  const liquidityQ = useRd(pool, POOL_ABI, "totalLiquidity");
  const deployedQ = useRd(pool, POOL_ABI, "deployedAssets");
  const maxGradeQ = useRd(pool, POOL_ABI, "maxGrade");

  const assetDecimalsQ = useRd(asset, mockUsdcAbi as unknown as Abi, "decimals", undefined, Boolean(asset));
  const assetSymbolQ = useRd(asset, mockUsdcAbi as unknown as Abi, "symbol", undefined, Boolean(asset));

  const userSharesQ = useRd(vault, VAULT_ABI, "balanceOf", account ? [account] : undefined, Boolean(account));
  const userShares = (userSharesQ.data as bigint | undefined) ?? 0n;
  const userAssetsQ = useRd(vault, VAULT_ABI, "convertToAssets", [userShares], userShares > 0n);

  const userBalanceQ = useRd(asset, mockUsdcAbi as unknown as Abi, "balanceOf", account ? [account] : undefined, Boolean(asset && account));
  const assetAllowanceQ = useRd(
    asset,
    mockUsdcAbi as unknown as Abi,
    "allowance",
    account && pool ? [account, pool] : undefined,
    Boolean(asset && account && pool),
  );
  const shareAllowanceQ = useRd(
    vault,
    VAULT_ABI,
    "allowance",
    account && pool ? [account, pool] : undefined,
    Boolean(vault && account && pool),
  );

  const refetch = useCallback(() => {
    void totalAssetsQ.refetch();
    void totalSharesQ.refetch();
    void liquidityQ.refetch();
    void deployedQ.refetch();
    void userSharesQ.refetch();
    void userAssetsQ.refetch();
    void userBalanceQ.refetch();
    void assetAllowanceQ.refetch();
    void shareAllowanceQ.refetch();
  }, [
    totalAssetsQ, totalSharesQ, liquidityQ, deployedQ,
    userSharesQ, userAssetsQ, userBalanceQ, assetAllowanceQ, shareAllowanceQ,
  ]);

  useWatchContractEvent({ address: vault, abi: VAULT_ABI, eventName: "Deposit", enabled: Boolean(vault), onLogs: refetch });
  useWatchContractEvent({ address: vault, abi: VAULT_ABI, eventName: "Withdraw", enabled: Boolean(vault), onLogs: refetch });

  const totalAssets = (totalAssetsQ.data as bigint | undefined) ?? 0n;
  const totalShares = (totalSharesQ.data as bigint | undefined) ?? 0n;
  const totalLiquidity = (liquidityQ.data as bigint | undefined) ?? 0n;
  const deployedAssets = (deployedQ.data as bigint | undefined) ?? 0n;

  return {
    poolAddress: pool,
    vaultAddress: vault,
    assetAddress: asset,
    assetSymbol: (assetSymbolQ.data as string | undefined) ?? "USDC",
    assetDecimals: Number((assetDecimalsQ.data as number | undefined) ?? 6),
    shareSymbol: (shareSymbolQ.data as string | undefined) ?? "pcLP",
    shareDecimals: Number((shareDecimalsQ.data as number | undefined) ?? 6),
    totalAssets,
    totalShares,
    totalLiquidity,
    deployedAssets,
    maxGrade: Number((maxGradeQ.data as number | undefined) ?? 0),
    utilizationBps: utilizationBps(deployedAssets, totalAssets),
    navPerShare: navPerShare(totalAssets, totalShares),
    userShares,
    userAssets: (userAssetsQ.data as bigint | undefined) ?? 0n,
    userAssetBalance: (userBalanceQ.data as bigint | undefined) ?? 0n,
    assetAllowance: (assetAllowanceQ.data as bigint | undefined) ?? 0n,
    shareAllowance: (shareAllowanceQ.data as bigint | undefined) ?? 0n,
    isLoading: totalAssetsQ.isLoading || liquidityQ.isLoading,
    isError: totalAssetsQ.isError || liquidityQ.isError,
    refetch,
  };
}
