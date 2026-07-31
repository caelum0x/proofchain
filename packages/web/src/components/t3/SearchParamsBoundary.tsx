"use client";

import { Suspense, type ReactNode } from "react";
import { LoadingState } from "@/components/ui";

/**
 * Wraps content that reads `useSearchParams()` (via `useT3ListParams`) in a
 * Suspense boundary. Next 15 requires this so a URL-driven list page can be
 * statically prerendered without bailing the whole route out of SSR.
 */
export function SearchParamsBoundary({ children }: { readonly children: ReactNode }) {
  return <Suspense fallback={<LoadingState label="Loading…" />}>{children}</Suspense>;
}
