"use client";

import type { ReactNode } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import { EmptyState } from "./ui/States";
import { Button } from "./ui/Button";

/**
 * Gates interactive content behind a connected wallet on the correct network.
 * Renders a connect prompt or network-switch prompt as appropriate.
 */
export function RequireWallet({ children }: { children: ReactNode }) {
  const { isConnected, wrongNetwork, promptSwitch, isSwitching, targetChainName } =
    useNetworkGuard();

  if (!isConnected) {
    return (
      <EmptyState
        title="Connect your wallet"
        description="Connect a wallet to interact with ProofChain contracts on Ethereum Sepolia."
        action={<ConnectButton />}
      />
    );
  }

  if (wrongNetwork) {
    return (
      <EmptyState
        title={`Switch to ${targetChainName}`}
        description="Your wallet is connected to a different network."
        action={
          <Button loading={isSwitching} onClick={promptSwitch}>
            Switch network
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
