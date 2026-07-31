import type { Metadata } from "next";
import { SettingsForm } from "@/components/t7/SettingsForm";

export const metadata: Metadata = {
  title: "Settings — ProofChain",
  description: "Personalise how ProofChain looks and what it notifies you about.",
};

export default function SettingsPage() {
  return <SettingsForm />;
}
