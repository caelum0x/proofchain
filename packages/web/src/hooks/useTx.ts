"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Hex } from "viem";
import { toast } from "sonner";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { getErrorMessage } from "@/lib/errors";
import { explorerTxUrl } from "@/lib/format";

export type TxStatus = "idle" | "signing" | "pending" | "confirmed" | "error";

type WriteArgs = Parameters<ReturnType<typeof useWriteContract>["writeContractAsync"]>[0];

interface UseTxOptions {
  readonly pendingLabel?: string;
  readonly successLabel?: string;
  readonly onConfirmed?: (hash: Hex) => void;
}

interface Meta {
  toastId: string | number;
  successLabel: string;
}

/**
 * Drives a single contract write through its full lifecycle — wallet signing,
 * mempool submission, and on-chain confirmation — surfacing each phase as a
 * toast with an explorer link. Errors (including user rejection and reverts)
 * are always reported, never swallowed.
 */
export function useTx(options: UseTxOptions = {}) {
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<TxStatus>("idle");
  const [hash, setHash] = useState<Hex | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const metaRef = useRef<Meta | null>(null);

  const receipt = useWaitForTransactionReceipt({ hash });

  const reset = useCallback(() => {
    setStatus("idle");
    setHash(undefined);
    setError(null);
    metaRef.current = null;
  }, []);

  const submit = useCallback(
    async (args: WriteArgs): Promise<Hex | null> => {
      setError(null);
      setStatus("signing");
      const toastId = toast.loading("Confirm the transaction in your wallet…");
      metaRef.current = {
        toastId,
        successLabel: options.successLabel ?? "Transaction confirmed",
      };

      try {
        const txHash = await writeContractAsync(args);
        setHash(txHash);
        setStatus("pending");
        toast.loading(options.pendingLabel ?? "Transaction submitted, waiting for confirmation…", {
          id: toastId,
          action: {
            label: "View",
            onClick: () => window.open(explorerTxUrl(txHash), "_blank", "noopener"),
          },
        });
        return txHash;
      } catch (cause) {
        const message = getErrorMessage(cause);
        setError(message);
        setStatus("error");
        toast.error(message, { id: toastId });
        metaRef.current = null;
        return null;
      }
    },
    [writeContractAsync, options.pendingLabel, options.successLabel],
  );

  // React to receipt resolution for the in-flight hash.
  useEffect(() => {
    if (!hash || status !== "pending") return;
    const meta = metaRef.current;

    if (receipt.isSuccess && receipt.data) {
      setStatus("confirmed");
      if (meta) {
        toast.success(meta.successLabel, {
          id: meta.toastId,
          action: {
            label: "View",
            onClick: () => window.open(explorerTxUrl(hash), "_blank", "noopener"),
          },
        });
      }
      options.onConfirmed?.(hash);
      metaRef.current = null;
    } else if (receipt.isError) {
      const message = getErrorMessage(receipt.error);
      setStatus("error");
      setError(message);
      if (meta) toast.error(message, { id: meta.toastId });
      metaRef.current = null;
    }
  }, [hash, status, receipt.isSuccess, receipt.isError, receipt.data, receipt.error, options]);

  return {
    submit,
    reset,
    status,
    hash,
    error,
    isSigning: status === "signing",
    isPending: status === "pending",
    isConfirmed: status === "confirmed",
    isBusy: status === "signing" || status === "pending",
  };
}
