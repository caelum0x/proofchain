"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { ThemeProvider, useTheme } from "@/components/ui/theme";
import { Toaster } from "@/components/ui/Toast";

/**
 * Client provider tree: theme → wagmi (chain/account state) → react-query
 * (async cache wagmi depends on) → RainbowKit (wallet UI) → app. A single
 * QueryClient is memoised per browser session. RainbowKit + toasts follow the
 * active theme.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <ThemedRainbowKit>
            {children}
            <Toaster />
          </ThemedRainbowKit>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}

/** RainbowKit provider whose visual theme tracks the app theme. */
function ThemedRainbowKit({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const rainbowTheme =
    theme === "light"
      ? lightTheme({ accentColor: "#3B82F6", borderRadius: "medium", overlayBlur: "small" })
      : darkTheme({ accentColor: "#3B82F6", borderRadius: "medium", overlayBlur: "small" });
  return <RainbowKitProvider theme={rainbowTheme}>{children}</RainbowKitProvider>;
}
