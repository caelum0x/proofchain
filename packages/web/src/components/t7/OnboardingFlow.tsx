"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import { env } from "@/lib/env";
import { Stepper, type Step } from "@/components/ui/Stepper";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Icon, type IconName } from "@/components/ui/Icon";

const STEPS: readonly Step[] = [
  { label: "Connect wallet", description: "Sign in with your wallet" },
  { label: "Select network", description: `Base Sepolia (${env.chainId})` },
  { label: "Get testnet funds", description: "Faucet ETH + USDC" },
  { label: "Register & explore", description: "Create batches, settle, finance" },
];

interface GuideCard {
  readonly icon: IconName;
  readonly title: string;
  readonly body: string;
  readonly href: string;
  readonly cta: string;
}

const NEXT_STEPS: readonly GuideCard[] = [
  { icon: "organizations", title: "Register your organization", body: "Create an on-chain identity so counterparties can verify and transact with you.", href: "/organizations", cta: "Open organizations" },
  { icon: "batches", title: "Register a batch", body: "Anchor a shipment's provenance trail and let the AI agent attest it.", href: "/batches", cta: "Open batches" },
  { icon: "finance", title: "Finance a receivable", body: "List an attested invoice and let lenders fund it at a risk-graded discount.", href: "/finance", cta: "Open finance" },
  { icon: "explorer", title: "Explore the network", body: "Browse every batch, attestation, and settlement across the protocol.", href: "/explorer", cta: "Open explorer" },
];

/**
 * Onboarding flow (WD §6, MarketingShell): a live, wallet-aware getting-started
 * guide. The stepper reflects real connection state; each card links into the
 * relevant product route.
 */
export function OnboardingFlow() {
  const { isConnected } = useAccount();
  const { wrongNetwork, promptSwitch, isSwitching, targetChainName } = useNetworkGuard();

  const current = !isConnected ? 0 : wrongNetwork ? 1 : 2;

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <StatusBadge status="brand" dot>
          Get started
        </StatusBadge>
        <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Onboard to ProofChain in four steps
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Connect a wallet on Base Sepolia, grab testnet funds, then register provenance and settle
          on-chain. It takes a couple of minutes.
        </p>
      </header>

      <Card>
        <Stepper steps={STEPS} current={current} />
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-brand">
              <Icon name="wallet" size={20} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-fg">1 · Connect your wallet</h2>
              <p className="text-sm text-muted">ProofChain signs only in your wallet — never share keys.</p>
            </div>
          </div>
          {isConnected ? (
            <Callout tone="success" title="Wallet connected">
              You&apos;re signed in and ready to transact.
            </Callout>
          ) : (
            <ConnectButton />
          )}

          {isConnected && wrongNetwork ? (
            <Callout
              tone="warn"
              title={`Switch to ${targetChainName}`}
              action={
                <Button size="sm" loading={isSwitching} onClick={promptSwitch}>
                  Switch network
                </Button>
              }
            >
              Your wallet is on a different network.
            </Callout>
          ) : null}
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-brand">
              <Icon name="treasury" size={20} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-fg">2 · Get testnet funds</h2>
              <p className="text-sm text-muted">You need a little Base Sepolia ETH for gas, plus test USDC.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="https://www.alchemy.com/faucets/base-sepolia" target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm">
                <Icon name="external" size={16} />
                Base Sepolia ETH faucet
              </Button>
            </a>
            <Link href="/treasury">
              <Button variant="ghost" size="sm">
                Mint test USDC
              </Button>
            </Link>
          </div>
          <Callout tone="info">
            Base Sepolia is a testnet — funds have no real value and are safe to experiment with.
          </Callout>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-fg">3 · Register and explore</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {NEXT_STEPS.map((step) => (
            <Card key={step.href} className="flex h-full flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-brand">
                  <Icon name={step.icon} size={18} />
                </span>
                <h3 className="text-base font-semibold text-fg">{step.title}</h3>
              </div>
              <p className="flex-1 text-sm text-muted">{step.body}</p>
              <Link href={step.href}>
                <Button variant="secondary" size="sm">
                  {step.cta}
                  <Icon name="arrow-right" size={16} />
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <Callout tone="neutral" title="Need the full picture?">
        Read the{" "}
        <Link href="/docs" className="text-brand hover:underline">
          documentation
        </Link>{" "}
        for architecture, contracts, and API details.
      </Callout>
    </div>
  );
}
