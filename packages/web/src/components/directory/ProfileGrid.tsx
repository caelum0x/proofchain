"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/Field";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/States";
import { getErrorMessage } from "@/lib/errors";
import type { ActorProfileView } from "@/lib/directory";
import { ProfileCard } from "./ProfileCard";

interface ProfileGridProps {
  readonly profiles: readonly ActorProfileView[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error?: unknown;
  readonly notDeployed?: boolean;
  readonly onRetry?: () => void;
  readonly hrefBase?: string;
  readonly roleLabel?: string;
  readonly emptyTitle: string;
  readonly emptyDescription?: string;
  readonly notDeployedLabel: string;
}

/**
 * Searchable grid of actor profiles with built-in loading / error / empty /
 * not-deployed states. Filtering is client-side over the already-fetched set
 * (name or address substring), which is ample for a directory of this size.
 */
export function ProfileGrid({
  profiles,
  isLoading,
  isError,
  error,
  notDeployed = false,
  onRetry,
  hrefBase,
  roleLabel,
  emptyTitle,
  emptyDescription,
  notDeployedLabel,
}: ProfileGridProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.account.toLowerCase().includes(q),
    );
  }, [profiles, search]);

  if (notDeployed) {
    return (
      <EmptyState
        title="Registry not deployed"
        description={notDeployedLabel}
      />
    );
  }
  if (isLoading) return <LoadingState label="Loading directory from chain…" />;
  if (isError) {
    return <ErrorState message={getErrorMessage(error)} onRetry={onRetry} />;
  }
  if (profiles.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or address…"
          className="max-w-xs"
          aria-label="Search directory"
        />
        <p className="text-xs text-muted">
          {filtered.length} of {profiles.length}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matches"
          description="No profiles match your search."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((profile) => (
            <ProfileCard
              key={profile.account}
              profile={profile}
              hrefBase={hrefBase}
              roleLabel={roleLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
