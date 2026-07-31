import { Badge } from "./ui/Badge";
import { severityTone } from "@/lib/format";
import type { Finding } from "@/lib/shared";

export function FindingsList({ findings }: { findings: readonly Finding[] }) {
  if (findings.length === 0) {
    return <p className="text-sm text-muted">No findings recorded.</p>;
  }
  return (
    <ul className="space-y-2">
      {findings.map((f, i) => (
        <li
          key={`${f.code}-${i}`}
          className="rounded-lg border border-border bg-surface-2/40 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-fg">{f.code}</span>
            <Badge tone={severityTone(f.severity)}>{f.severity}</Badge>
          </div>
          <p className="mt-1 text-sm text-fg/90">{f.message}</p>
        </li>
      ))}
    </ul>
  );
}
