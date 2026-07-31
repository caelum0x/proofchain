import { cn } from "@/lib/cn";

export interface MapPoint {
  /** Normalised 0..1 coordinates within the preview box. */
  readonly x: number;
  readonly y: number;
  readonly label?: string;
  readonly kind?: "origin" | "checkpoint" | "destination";
}

export interface MapPreviewProps {
  readonly points: readonly MapPoint[];
  readonly height?: number;
  readonly className?: string;
  readonly ariaLabel?: string;
}

const KIND_COLOR: Record<NonNullable<MapPoint["kind"]>, string> = {
  origin: "text-success",
  checkpoint: "text-brand",
  destination: "text-markets",
};

/**
 * A schematic route/checkpoint preview rendered as SVG — no map-tile
 * dependency. Points are normalised (0..1); a polyline connects them in order.
 * Suitable for provenance/logistics summaries; swap for a real map later.
 */
export function MapPreview({ points, height = 200, className, ariaLabel }: MapPreviewProps) {
  const w = 400;
  const h = height;
  const px = points.map((p) => ({ ...p, cx: p.x * w, cy: p.y * h }));
  const path = px.map((p, i) => `${i === 0 ? "M" : "L"}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(" ");
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-surface-2", className)}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel ?? "Route preview"}>
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0V32" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border" />
          </pattern>
        </defs>
        <rect width={w} height={h} fill="url(#grid)" />
        {px.length > 1 ? (
          <path d={path} fill="none" strokeWidth={2} strokeDasharray="5 4" stroke="currentColor" className="text-brand/60" />
        ) : null}
        {px.map((p, i) => (
          <g key={i} className={KIND_COLOR[p.kind ?? "checkpoint"]}>
            <circle cx={p.cx} cy={p.cy} r={5} fill="currentColor" />
            <circle cx={p.cx} cy={p.cy} r={9} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.4} />
          </g>
        ))}
      </svg>
    </div>
  );
}
