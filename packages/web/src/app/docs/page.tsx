import type { Metadata } from "next";
import { DocsBrowser } from "@/components/t7/DocsBrowser";

export const metadata: Metadata = {
  title: "Docs — ProofChain",
  description: "Protocol model, architecture, contracts, and API reference for ProofChain.",
};

export default function DocsPage() {
  return <DocsBrowser />;
}
