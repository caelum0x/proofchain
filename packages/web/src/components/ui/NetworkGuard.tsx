"use client";

import type { ReactNode } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import { EmptyState } from "./States";
import { Button } from "./Button";

export interface NetworkGuardProps {
  readonly children: ReactNode;
  /** Require a connected wallet (default true). When false only checks chain. */
  readonly requireConnection?: boolean;
  /** Custom fallback when disconnected. */
  readonly connectFallback?: ReactNode;
}

/**
 * Gates interactive content behind a connected wallet on the app chain (Base
 * Sepolia). Renders a connect prompt or a one-click network-switch prompt.
 */
export function NetworkGuard({ children, requireConnection = true, connectFallback }: NetworkGuardProps) {
  const { isConnected, wrongNetwork, promptSwitch, isSwitching, targetChainName } = useNetworkGuard();

  if (requireConnection && !isConnected) {
    return (
      connectFallback ?? (
        <EmptyState
          title="Connect your wallet"
          description="Connect a wallet to continue on Ethereum Sepolia."
          action={<ConnectButton />}
        />
      )
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
