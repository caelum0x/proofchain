"use client";

import { useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { verifyRequestSchema, validateDocumentFile, type VerifyRequestInput } from "@/lib/schemas";
import {
  fileToBase64,
  requestVerification,
  type AgentDocumentInput,
  type VerifyResult,
} from "@/lib/agent-api";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";
import { VerdictPanel } from "@/components/VerdictPanel";
import { TxLink } from "@/components/ui/TxLink";

/**
 * Upload shipment documents and request AI verification from the agent API.
 * The agent parses documents, cross-checks provenance, attests on-chain, and
 * returns the verdict. No signing happens here — the agent uses its own signer.
 */
export function VerifyForm({ defaultBatchId }: { defaultBatchId?: string }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyRequestInput>({
    resolver: zodResolver(verifyRequestSchema),
    defaultValues: { batchId: defaultBatchId ?? "" },
  });

  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    const problems: string[] = [];
    const accepted: File[] = [];
    for (const file of list) {
      const issue = validateDocumentFile(file);
      if (issue) problems.push(issue);
      else accepted.push(file);
    }
    setFiles(accepted);
    setFileErrors(problems);
  };

  const onValid = async (values: VerifyRequestInput) => {
    setApiError(null);
    setResult(null);
    if (files.length === 0) {
      setFileErrors(["Attach at least one document."]);
      return;
    }
    setSubmitting(true);
    try {
      const documents: AgentDocumentInput[] = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          mimeType: file.type,
          dataBase64: await fileToBase64(file),
        })),
      );
      const res = await requestVerification(values.batchId, documents);
      setResult(res);
      toast.success(res.verdict.passed ? "Verification passed" : "Verification flagged findings");
    } catch (error) {
      const message = getErrorMessage(error);
      setApiError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Request verification"
        description="Send documents to the AI agent. It attests on-chain with its own signer."
      />
      <form onSubmit={handleSubmit(onValid)} noValidate>
        <Field
          label="Batch id (bytes32)"
          htmlFor="v-batch"
          hint="The registered batch to verify."
          error={errors.batchId?.message}
        >
          <Input id="v-batch" placeholder="0x…" {...register("batchId")} />
        </Field>

        <Field
          label="Documents"
          htmlFor="v-files"
          hint="PDF, PNG, JPEG, or WEBP. Max 15 MB each."
          error={fileErrors.length === 1 ? fileErrors[0] : undefined}
        >
          <input
            id="v-files"
            type="file"
            multiple
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={onFiles}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:text-fg hover:file:bg-surface-2/70"
          />
        </Field>

        {files.length > 0 ? (
          <ul className="mb-4 space-y-1 text-xs text-muted">
            {files.map((f) => (
              <li key={f.name}>
                {f.name} · {(f.size / 1024).toFixed(0)} KB
              </li>
            ))}
          </ul>
        ) : null}

        {fileErrors.length > 1 ? (
          <ul className="mb-3 list-disc pl-5 text-xs text-danger">
            {fileErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}

        <Button type="submit" loading={submitting}>
          {submitting ? "Verifying…" : "Request verification"}
        </Button>
      </form>

      {apiError ? (
        <div className="mt-4">
          <ErrorState message={apiError} />
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-3">
          <VerdictPanel verdict={result.verdict} />
          {result.txHash ? (
            <p className="text-xs text-muted">
              Attestation tx: <TxLink hash={result.txHash} />
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
