"use client";

import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import { Button } from "./ui/Button";

/**
 * Sticky warning shown when the connected wallet is on the wrong chain.
 * Offers a one-click switch to Ethereum Sepolia.
 */
export function NetworkBanner() {
  const { wrongNetwork, promptSwitch, isSwitching, targetChainName } = useNetworkGuard();

  if (!wrongNetwork) return null;

  return (
    <div className="border-b border-warn/40 bg-warn/10">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-warn">
          You&rsquo;re connected to the wrong network. ProofChain runs on{" "}
          <span className="font-semibold">{targetChainName}</span>.
        </p>
        <Button size="sm" variant="secondary" loading={isSwitching} onClick={promptSwitch}>
          Switch to {targetChainName}
        </Button>
      </div>
    </div>
  );
}
