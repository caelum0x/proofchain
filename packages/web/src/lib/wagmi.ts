import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { env } from "./env";

/**
 * wagmi + RainbowKit configuration. ProofChain targets Base Sepolia only; the
 * network guard prompts users to switch if they are connected elsewhere.
 *
 * A placeholder WalletConnect project id keeps `getDefaultConfig` from throwing
 * during build when the env var is unset; the UI surfaces the misconfiguration
 * via the config banner. No secrets are embedded here.
 */

export const appChain = baseSepolia;
export const APP_CHAIN_ID = baseSepolia.id;

export const wagmiConfig = getDefaultConfig({
  appName: "ProofChain",
  appDescription: "AI-verified supply-chain provenance with on-chain settlement",
  projectId: env.walletConnectId || "proofchain-missing-wc-id",
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(env.rpcUrl),
  },
  ssr: true,
});
