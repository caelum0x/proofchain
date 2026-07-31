import type { TimelineItem, TimelineKind } from "@/lib/types";
import { formatTimestamp } from "@/lib/format";
import { TxLink } from "./ui/TxLink";

const DOT: Record<TimelineKind, string> = {
  registered: "bg-brand",
  checkpoint: "bg-success",
  funded: "bg-brand",
  attested: "bg-warn",
  released: "bg-success",
  disputed: "bg-danger",
  refunded: "bg-warn",
};

export function Timeline({ items }: { items: readonly TimelineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">No events yet.</p>;
  }
  return (
    <ol className="relative space-y-5 border-l border-border pl-6">
      {items.map((item, i) => (
        <li key={`${item.kind}-${i}`} className="relative">
          <span
            className={`absolute -left-[1.65rem] top-1 h-3 w-3 rounded-full ring-4 ring-bg ${DOT[item.kind]}`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{item.title}</p>
            {item.txHash ? <TxLink hash={item.txHash} /> : null}
          </div>
          {item.description ? <p className="text-xs text-muted">{item.description}</p> : null}
          {item.timestamp ? (
            <p className="text-[11px] text-muted">{formatTimestamp(item.timestamp)}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
