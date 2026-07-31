"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export interface FileDropzoneProps {
  readonly onFiles: (files: File[]) => void;
  readonly accept?: string;
  readonly multiple?: boolean;
  /** Max size per file in bytes; oversized files are rejected via `onError`. */
  readonly maxSize?: number;
  readonly onError?: (message: string) => void;
  readonly hint?: string;
  readonly disabled?: boolean;
  readonly className?: string;
}

/** Accessible drag-and-drop file input with click-to-browse fallback. */
export function FileDropzone({
  onFiles,
  accept,
  multiple = false,
  maxSize,
  onError,
  hint,
  disabled = false,
  className,
}: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const files = Array.from(list);
      if (maxSize) {
        const tooBig = files.find((f) => f.size > maxSize);
        if (tooBig) {
          onError?.(`"${tooBig.name}" exceeds the ${(maxSize / 1_000_000).toFixed(1)} MB limit.`);
          return;
        }
      }
      onFiles(multiple ? files : files.slice(0, 1));
    },
    [maxSize, multiple, onError, onFiles],
  );

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handle(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors focus-ring",
        dragging ? "border-brand bg-brand/5" : "border-border bg-surface-2/40 hover:border-brand/50",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <Icon name="download" size={22} className="text-muted" />
      <p className="text-sm text-fg">
        <span className="font-medium text-brand">Click to upload</span> or drag &amp; drop
      </p>
      {hint ? <p className="text-xs text-faint">{hint}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => handle(e.target.files)}
      />
    </div>
  );
}
