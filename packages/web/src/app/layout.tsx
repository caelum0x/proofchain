import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";
import { ConfigBanner } from "@/components/ConfigBanner";
import { NetworkBanner } from "@/components/NetworkBanner";

export const metadata: Metadata = {
  title: "ProofChain — AI-verified provenance",
  description:
    "AI-verified supply-chain provenance with autonomous on-chain settlement on Base Sepolia.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <Providers>
          <ConfigBanner />
          <NetworkBanner />
          <Header />
          <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-muted">
            ProofChain · Base Sepolia · Never share private keys. This dApp signs only in your
            wallet.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
