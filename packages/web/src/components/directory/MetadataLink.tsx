import { ipfsToHttp } from "@/lib/format";

/**
 * Render a profile/metadata URI as a safe external link. `ipfs://` URIs are
 * rewritten to an HTTP gateway; anything that is not an http(s)/ipfs URL is shown
 * as plain text (never turned into a clickable link) to avoid unsafe schemes.
 */
export function MetadataLink({
  uri,
  className,
}: {
  uri: string;
  className?: string;
}) {
  const trimmed = uri.trim();
  if (!trimmed) return <span className="text-muted">—</span>;

  const isLinkable = /^(https?|ipfs):\/\//i.test(trimmed);
  if (!isLinkable) {
    return <span className={className}>{trimmed}</span>;
  }

  return (
    <a
      href={ipfsToHttp(trimmed)}
      target="_blank"
      rel="noreferrer noopener"
      className={className ?? "text-brand hover:underline"}
    >
      {trimmed}
    </a>
  );
}
