import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { env } from "./env";

/**
 * wagmi + RainbowKit configuration. ProofChain runs LIVE on Ethereum Sepolia;
 * the network guard prompts users to switch if they are connected elsewhere.
 *
 * A placeholder WalletConnect project id keeps `getDefaultConfig` from throwing
 * during build when the env var is unset; the UI surfaces the misconfiguration
 * via the config banner. No secrets are embedded here.
 */

export const appChain = sepolia;
export const APP_CHAIN_ID = sepolia.id;

export const wagmiConfig = getDefaultConfig({
  appName: "ProofChain",
  appDescription: "AI-verified supply-chain provenance with on-chain settlement",
  projectId: env.walletConnectId || "proofchain-missing-wc-id",
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(env.rpcUrl),
  },
  ssr: true,
});
