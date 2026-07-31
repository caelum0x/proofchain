"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { normalizeBytes32 } from "@/lib/hashing";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

/** Jump to the live deal-detail timeline for a batch id or reference. */
export function TrackBatch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const batchId = normalizeBytes32(value);
      router.push(`/deals/${batchId}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader title="Track a deal" description="Open the live settlement timeline." />
      <form onSubmit={onSubmit} noValidate className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="Batch id or reference" htmlFor="track-batch" error={error ?? undefined}>
            <Input
              id="track-batch"
              placeholder="0x… or reference"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" className="mb-4" disabled={value.trim() === ""}>
          View deal
        </Button>
      </form>
    </Card>
  );
}
