import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Lightweight, dependency-free SVG charts. Intentionally minimal — enough for
 * dashboards, sparklines, and KPI trends without pulling in a charting runtime.
 * All colors come from `text-*` utility classes on the wrapper (currentColor)
 * so charts respect the active theme and section accent.
 */

export interface SeriesPoint {
  readonly x: number | string;
  readonly y: number;
}

interface BaseChartProps {
  readonly data: readonly SeriesPoint[];
  readonly width?: number;
  readonly height?: number;
  /** Tailwind text color class driving the stroke/fill (currentColor). */
  readonly colorClassName?: string;
  readonly className?: string;
  readonly ariaLabel?: string;
}

function scaleY(values: readonly number[], height: number, pad: number) {
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  return (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
}

function points(data: readonly SeriesPoint[], width: number, height: number, pad = 4) {
  const ys = data.map((d) => d.y);
  const y = scaleY(ys, height, pad);
  const step = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;
  return data.map((d, i) => ({ x: pad + i * step, y: y(d.y) }));
}

/** Compact inline trend line — no axes. */
export function Sparkline({ data, width = 120, height = 32, colorClassName = "text-brand", className, ariaLabel }: BaseChartProps) {
  if (data.length === 0) return <span className={cn("inline-block text-faint", className)}>—</span>;
  const pts = points(data, width, height);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn(colorClassName, className)} role="img" aria-label={ariaLabel ?? "Trend"}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LineChart({ data, width = 320, height = 140, colorClassName = "text-brand", className, ariaLabel }: BaseChartProps) {
  if (data.length === 0) return <ChartEmpty height={height} className={className} />;
  const pts = points(data, width, height, 8);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cn(colorClassName, className)} role="img" aria-label={ariaLabel ?? "Line chart"}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.8} fill="currentColor" />
      ))}
    </svg>
  );
}

export function AreaChart({ data, width = 320, height = 140, colorClassName = "text-brand", className, ariaLabel }: BaseChartProps) {
  const gradId = useId();
  if (data.length === 0) return <ChartEmpty height={height} className={className} />;
  const pts = points(data, width, height, 8);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${height} L${pts[0].x.toFixed(1)},${height} Z`;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cn(colorClassName, className)} role="img" aria-label={ariaLabel ?? "Area chart"}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} stroke="none" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BarChart({ data, width = 320, height = 140, colorClassName = "text-brand", className, ariaLabel }: BaseChartProps) {
  if (data.length === 0) return <ChartEmpty height={height} className={className} />;
  const pad = 8;
  const ys = data.map((d) => d.y);
  const y = scaleY(ys, height, pad);
  const zero = y(0);
  const slot = (width - pad * 2) / data.length;
  const barW = Math.max(2, slot * 0.6);
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cn(colorClassName, className)} role="img" aria-label={ariaLabel ?? "Bar chart"}>
      {data.map((d, i) => {
        const cx = pad + slot * i + slot / 2;
        const top = y(d.y);
        return <rect key={i} x={cx - barW / 2} y={Math.min(top, zero)} width={barW} height={Math.abs(zero - top)} rx={2} fill="currentColor" opacity={0.85} />;
      })}
    </svg>
  );
}

export interface DonutSlice {
  readonly label: string;
  readonly value: number;
  /** Tailwind text color class (currentColor drives the arc). */
  readonly colorClassName: string;
}

export function DonutChart({ slices, size = 140, thickness = 18, className, ariaLabel }: {
  readonly slices: readonly DonutSlice[];
  readonly size?: number;
  readonly thickness?: number;
  readonly className?: string;
  readonly ariaLabel?: string;
}) {
  const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label={ariaLabel ?? "Donut chart"}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="text-surface-2" stroke="currentColor" />
        {total > 0 &&
          slices.map((s, i) => {
            const frac = Math.max(0, s.value) / total;
            const dash = frac * c;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={thickness}
                stroke="currentColor"
                className={s.colorClassName}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
      </g>
    </svg>
  );
}

function ChartEmpty({ height, className }: { height: number; className?: string }) {
  return (
    <div className={cn("grid place-items-center rounded-lg border border-dashed border-border text-xs text-faint", className)} style={{ height }}>
      No data
    </div>
  );
}
