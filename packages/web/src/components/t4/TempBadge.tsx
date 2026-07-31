import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCelsius, tempTone, type TempWindow, DEFAULT_TEMP_MIN_C, DEFAULT_TEMP_MAX_C } from "./temp";

export interface TempBadgeProps {
  readonly temp: bigint;
  readonly window?: TempWindow;
}

const DEFAULT_WINDOW: TempWindow = { minC: DEFAULT_TEMP_MIN_C, maxC: DEFAULT_TEMP_MAX_C };

/** Cold-chain temperature reading with a semantic tone relative to the safe window. */
export function TempBadge({ temp, window = DEFAULT_WINDOW }: TempBadgeProps) {
  return <StatusBadge status={tempTone(temp, window)}>{formatCelsius(temp)}</StatusBadge>;
}
