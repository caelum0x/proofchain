import type { Address, Hex } from "viem";
import { explorerAddressUrl, explorerTxUrl, shortenHex } from "@/lib/format";
import { cn } from "@/lib/cn";

export function TxLink({
  hash,
  label,
  className,
}: {
  hash: Hex | string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={explorerTxUrl(hash)}
      target="_blank"
      rel="noreferrer noopener"
      className={cn("font-mono text-xs text-brand hover:underline", className)}
    >
      {label ?? shortenHex(hash)}
    </a>
  );
}

export function AddressLink({
  address,
  className,
}: {
  address: Address | string;
  className?: string;
}) {
  return (
    <a
      href={explorerAddressUrl(address)}
      target="_blank"
      rel="noreferrer noopener"
      className={cn("font-mono text-xs text-brand hover:underline", className)}
    >
      {shortenHex(address)}
    </a>
  );
}
