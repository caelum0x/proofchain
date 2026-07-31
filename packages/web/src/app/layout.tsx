import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { ConfigBanner } from "@/components/ConfigBanner";
import { AppFrame } from "@/components/shells";
import { themeInitScript } from "@/components/ui/theme";

export const metadata: Metadata = {
  title: "ProofChain — AI-verified provenance",
  description:
    "AI-verified supply-chain provenance with autonomous on-chain settlement on Base Sepolia.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the persisted theme before first paint (no FOUC). */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans">
        <Providers>
          <ConfigBanner />
          <AppFrame>{children}</AppFrame>
        </Providers>
      </body>
    </html>
  );
}
