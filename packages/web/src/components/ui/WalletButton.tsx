"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export interface WalletButtonProps {
  /** Show the account balance next to the address. */
  readonly showBalance?: boolean;
  /** Compact renders address only, no chain switcher label. */
  readonly compact?: boolean;
}

/**
 * The canonical wallet connect/account control. Wraps RainbowKit's
 * `ConnectButton` so pages import a single design-system entrypoint.
 */
export function WalletButton({ showBalance = false, compact = false }: WalletButtonProps) {
  return (
    <ConnectButton
      showBalance={showBalance}
      accountStatus={compact ? "address" : { smallScreen: "avatar", largeScreen: "full" }}
      chainStatus={compact ? "none" : "icon"}
    />
  );
}
