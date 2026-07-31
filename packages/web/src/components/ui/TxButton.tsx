"use client";

import { useCallback, type ReactNode } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { Hex } from "viem";
import { useAccount } from "wagmi";
import { cn } from "@/lib/cn";
import { useTx } from "@/hooks/useTx";
import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import { Button, type ButtonProps } from "./Button";
import { Icon } from "./Icon";

type WriteArgs = Parameters<ReturnType<typeof useTx>["submit"]>[0];

export interface TxButtonProps {
  /**
   * The wagmi write config, or a callback that returns it (e.g. after building
   * args from form state). Return `null` to abort submission silently.
   */
  readonly write: WriteArgs | (() => WriteArgs | null | Promise<WriteArgs | null>);
  readonly children: ReactNode;
  readonly pendingLabel?: string;
  readonly successLabel?: string;
  readonly onConfirmed?: (hash: Hex) => void;
  readonly variant?: ButtonProps["variant"];
  readonly size?: ButtonProps["size"];
  readonly disabled?: boolean;
  /** Require the wallet on the app chain; prompts connect/switch inline. */
  readonly requireChain?: boolean;
  readonly className?: string;
}

/**
 * The canonical write button (WD §4/§7). Drives a contract write through the
 * full approve→sign→pending→confirmed→error lifecycle with toast feedback via
 * `useTx`, and gates on wallet connection + correct network.
 */
export function TxButton({
  write,
  children,
  pendingLabel,
  successLabel,
  onConfirmed,
  variant = "primary",
  size = "md",
  disabled = false,
  requireChain = true,
  className,
}: TxButtonProps) {
  const { isConnected } = useAccount();
  const { wrongNetwork, promptSwitch, isSwitching, targetChainName } = useNetworkGuard();
  const tx = useTx({ pendingLabel, successLabel, onConfirmed });

  const onClick = useCallback(async () => {
    const args = typeof write === "function" ? await write() : write;
    if (!args) return;
    await tx.submit(args);
  }, [write, tx]);

  if (requireChain && !isConnected) {
    return <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />;
  }

  if (requireChain && wrongNetwork) {
    return (
      <Button variant="secondary" size={size} loading={isSwitching} onClick={promptSwitch} className={className}>
        Switch to {targetChainName}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      loading={tx.isBusy}
      disabled={disabled}
      onClick={onClick}
      className={cn(className)}
    >
      {tx.isConfirmed ? <Icon name="check" size={16} /> : null}
      {children}
    </Button>
  );
}
