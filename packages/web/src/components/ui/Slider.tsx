import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Show the current value to the right of the track. */
  readonly showValue?: boolean;
  /** Formatter for the displayed value. */
  readonly formatValue?: (value: number) => string;
}

/** Styled native range input with an optional live value read-out. */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { showValue = false, formatValue, className, value, ...rest },
  ref,
) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return (
    <div className="flex items-center gap-3">
      <input
        ref={ref}
        type="range"
        value={value}
        className={cn(
          "h-1.5 w-full cursor-pointer appearance-none rounded-pill bg-surface-2 accent-brand",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
          className,
        )}
        {...rest}
      />
      {showValue ? (
        <span className="w-14 shrink-0 text-right font-mono text-xs text-fg">
          {formatValue ? formatValue(numeric) : numeric}
        </span>
      ) : null}
    </div>
  );
});
