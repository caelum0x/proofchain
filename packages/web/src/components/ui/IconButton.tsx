import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon glyph name. */
  readonly icon: IconName;
  /** Required accessible label (icon-only button). */
  readonly label: string;
  readonly variant?: Variant;
  readonly size?: Size;
  readonly loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-brand-fg hover:bg-brand/90 disabled:bg-brand/50",
  secondary: "bg-surface-2 text-fg border border-border hover:bg-surface-2/70",
  ghost: "bg-transparent text-muted hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger/15 text-danger hover:bg-danger/25",
};

const SIZES: Record<Size, { box: string; icon: number }> = {
  sm: { box: "h-8 w-8", icon: 16 },
  md: { box: "h-10 w-10", icon: 18 },
};

/** Square, icon-only button with a mandatory accessible label. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = "secondary", size = "md", loading = false, className, disabled, ...rest },
  ref,
) {
  const dims = SIZES[size];
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-lg transition-colors focus-ring",
        "disabled:cursor-not-allowed",
        VARIANTS[variant],
        dims.box,
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : <Icon name={icon} size={dims.icon} />}
    </button>
  );
});
