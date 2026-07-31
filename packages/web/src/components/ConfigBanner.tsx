"use client";

import { envIssues, isEnvValid } from "@/lib/env";
import { areCoreContractsDeployed } from "@/lib/shared";

/**
 * Surfaces environment / deployment misconfiguration to the operator instead of
 * failing silently. Rendered at the top of the app.
 */
export function ConfigBanner() {
  const problems: string[] = [];

  if (!isEnvValid) {
    for (const issue of envIssues) {
      problems.push(`${issue.path}: ${issue.message}`);
    }
  }
  if (!areCoreContractsDeployed) {
    problems.push(
      "Core contracts are not configured for this chain. Deploy @proofchain/contracts and update the shared address map.",
    );
  }

  if (problems.length === 0) return null;

  return (
    <div className="border-b border-danger/40 bg-danger/10">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <p className="text-sm font-semibold text-danger">Configuration required</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-fg/80">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
