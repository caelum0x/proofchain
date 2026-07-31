import { cn } from "@/lib/cn";

export interface AvatarProps {
  /** Seed used to derive a deterministic gradient (e.g. an address). */
  readonly seed: string;
  /** Optional label rendered as initials fallback. */
  readonly label?: string;
  readonly size?: number;
  readonly className?: string;
}

/** Hash a string to a hue (0..360) for a deterministic identicon gradient. */
function seedHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

function initials(label?: string): string {
  if (!label) return "";
  const parts = label.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/**
 * Deterministic gradient avatar/identicon derived from a seed (address, id).
 * No network dependency — pure CSS.
 */
export function Avatar({ seed, label, size = 32, className }: AvatarProps) {
  const hue = seedHue(seed);
  const hue2 = (hue + 60) % 360;
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white ring-1 ring-border",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${hue2} 70% 40%))`,
      }}
      aria-hidden={label ? undefined : true}
      title={label}
    >
      {initials(label)}
    </span>
  );
}
