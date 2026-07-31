"use client";

import { Suspense, type ReactNode } from "react";
import { LoadingState } from "@/components/ui/States";

/**
 * Wraps page content that reads `useSearchParams()` (via URL-state hooks such as
 * `useT4ListState` or `useTableParams`) in a Suspense boundary. Next 15 requires
 * this so a URL-driven list page can be statically prerendered without bailing
 * the whole route out of static generation.
 */
export function SearchParamsBoundary({ children }: { readonly children: ReactNode }) {
  return <Suspense fallback={<LoadingState label="Loading…" />}>{children}</Suspense>;
}
