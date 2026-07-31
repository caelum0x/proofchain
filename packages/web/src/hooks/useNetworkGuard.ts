"use client";

import { useCallback } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { APP_CHAIN_ID, appChain } from "@/lib/wagmi";

/**
 * Base Sepolia network guard. Reports whether the connected wallet is on the
 * wrong chain and exposes a one-click switch prompt.
 */
export function useNetworkGuard() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();

  // Guard against the SSR/hydration window where `isConnected` is true but the
  // wallet has not yet reported a chainId — `undefined !== APP_CHAIN_ID` would
  // otherwise flash a spurious wrong-network prompt.
  const wrongNetwork =
    isConnected && chainId !== undefined && chainId !== APP_CHAIN_ID;

  const promptSwitch = useCallback(() => {
    switchChain({ chainId: APP_CHAIN_ID });
  }, [switchChain]);

  return {
    isConnected,
    chainId,
    wrongNetwork,
    isSwitching: isPending,
    switchError: error,
    promptSwitch,
    targetChainId: APP_CHAIN_ID,
    targetChainName: appChain.name,
  };
}
