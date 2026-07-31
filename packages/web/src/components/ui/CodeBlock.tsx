import { cn } from "@/lib/cn";
import { CopyButton } from "./CopyButton";

export interface CodeBlockProps {
  readonly code: string;
  /** Optional caption shown in the header bar. */
  readonly title?: string;
  readonly language?: string;
  readonly copyable?: boolean;
  readonly className?: string;
}

/** A monospace code panel with an optional header and copy affordance. */
export function CodeBlock({ code, title, language, copyable = true, className }: CodeBlockProps) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-surface-2", className)}>
      {(title || copyable) && (
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <span className="font-mono text-xs text-faint">{title ?? language ?? "code"}</span>
          {copyable ? <CopyButton value={code} /> : null}
        </div>
      )}
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code className="font-mono text-fg/90">{code}</code>
      </pre>
    </div>
  );
}
