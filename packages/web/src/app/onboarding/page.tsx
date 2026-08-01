import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/t7/OnboardingFlow";

export const metadata: Metadata = {
  title: "Get started — ProofChain",
  description: "Connect a wallet on Ethereum Sepolia, get testnet funds, and register your first batch.",
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
