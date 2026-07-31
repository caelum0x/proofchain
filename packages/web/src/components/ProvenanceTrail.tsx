import type { BatchView, CheckpointView } from "@/lib/types";
import { formatTimestamp, shortenHex } from "@/lib/format";

/** Ordered provenance trail: registration followed by each checkpoint. */
export function ProvenanceTrail({
  batch,
  checkpoints,
  loading,
}: {
  batch: BatchView | null;
  checkpoints: readonly CheckpointView[];
  loading?: boolean;
}) {
  if (loading && !batch) {
    return <p className="text-sm text-muted">Loading provenance…</p>;
  }
  if (!batch) {
    return <p className="text-sm text-muted">Batch not found on-chain.</p>;
  }

  const ordered = [...checkpoints].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <ol className="space-y-3">
      <li className="flex gap-3">
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />
        <div>
          <p className="text-sm font-medium">Registered</p>
          <p className="text-xs text-muted">{formatTimestamp(batch.createdAt)}</p>
          <p className="mt-0.5 break-all text-xs text-muted">
            origin {shortenHex(batch.originHash)}
          </p>
        </div>
      </li>
      {ordered.map((cp, i) => (
        <li key={`${cp.dataHash}-${i}`} className="flex gap-3">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-success" />
          <div>
            <p className="text-sm font-medium">{cp.location}</p>
            <p className="text-xs text-muted">{formatTimestamp(cp.timestamp)}</p>
            <p className="mt-0.5 break-all text-xs text-muted">data {shortenHex(cp.dataHash)}</p>
          </div>
        </li>
      ))}
      {ordered.length === 0 ? (
        <li className="pl-5 text-xs text-muted">No checkpoints yet.</li>
      ) : null}
    </ol>
  );
}
