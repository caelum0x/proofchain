"use client";

import { Toaster as SonnerToaster } from "sonner";
import { toast } from "sonner";
import { useTheme } from "./theme";

/** Re-export sonner's imperative API as the canonical toast entrypoint. */
export { toast };

/**
 * App-wide toast portal. Wraps sonner's Toaster with the ProofChain theme and
 * defaults so pages only ever call `toast(...)`. Render once near the root.
 */
export function Toaster() {
  const { theme } = useTheme();
  return (
    <SonnerToaster
      position="bottom-right"
      theme={theme}
      richColors
      closeButton
      toastOptions={{ duration: 6000 }}
    />
  );
}
