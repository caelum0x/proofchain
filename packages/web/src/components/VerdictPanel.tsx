import { Badge } from "./ui/Badge";
import { FindingsList } from "./FindingsList";
import { formatBps, ipfsToHttp } from "@/lib/format";
import type { Verdict } from "@/lib/agent-api";

/** Renders an agent verdict: score, pass/fail, findings, and verdict link. */
export function VerdictPanel({ verdict }: { verdict: Verdict }) {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Attestation score</p>
          <p className="text-2xl font-semibold">{formatBps(verdict.score)}</p>
        </div>
        <Badge tone={verdict.passed ? "success" : "danger"}>
          {verdict.passed ? "PASS" : "FAIL"} · threshold {formatBps(verdict.threshold)}
        </Badge>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          Findings <span className="text-muted">({verdict.findings.length})</span>
        </p>
        <FindingsList findings={verdict.findings} />
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs text-muted">
        <div>
          <dt>Model</dt>
          <dd className="text-fg">{verdict.model}</dd>
        </div>
        <div>
          <dt>Documents</dt>
          <dd className="text-fg">{verdict.documentHashes.length}</dd>
        </div>
      </dl>

      {verdict.verdictURI ? (
        <a
          href={ipfsToHttp(verdict.verdictURI)}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-block text-sm text-brand hover:underline"
        >
          View full verdict ↗
        </a>
      ) : null}
    </div>
  );
}
