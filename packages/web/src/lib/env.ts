import { z } from "zod";

/**
 * Client-side environment configuration.
 *
 * Every value here is a `NEXT_PUBLIC_*` variable, inlined at build time by
 * Next.js. We validate at module load with zod so misconfiguration surfaces
 * as a structured, user-facing banner instead of an opaque runtime crash.
 *
 * IMPORTANT: never read secrets here. This module is bundled into the browser.
 */

export const BASE_SEPOLIA_CHAIN_ID = 84532 as const;
export const ETHEREUM_SEPOLIA_CHAIN_ID = 11155111 as const;

/** The network the dApp targets. ProofChain runs LIVE on Ethereum Sepolia. */
export const EXPECTED_CHAIN_ID = ETHEREUM_SEPOLIA_CHAIN_ID;

const bigintishSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "must be a non-negative integer")
  .transform((v) => BigInt(v));

const clientEnvSchema = z.object({
  walletConnectId: z
    .string()
    .trim()
    .min(1, "NEXT_PUBLIC_WALLETCONNECT_ID is required"),
  agentApiUrl: z
    .string()
    .trim()
    .url("NEXT_PUBLIC_AGENT_API_URL must be a valid URL"),
  apiUrl: z
    .string()
    .trim()
    .url("NEXT_PUBLIC_API_URL must be a valid URL"),
  chainId: z.coerce
    .number()
    .int("NEXT_PUBLIC_CHAIN_ID must be an integer")
    .positive("NEXT_PUBLIC_CHAIN_ID must be positive"),
  deployBlock: bigintishSchema.optional(),
  rpcUrl: z
    .string()
    .trim()
    .url("NEXT_PUBLIC_RPC_URL must be a valid URL")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Raw values must be referenced statically (not via a computed key) so the
 * Next.js compiler can inline them.
 */
const rawEnv = {
  walletConnectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID ?? "",
  agentApiUrl: process.env.NEXT_PUBLIC_AGENT_API_URL ?? "http://localhost:8080",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081",
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID ?? String(EXPECTED_CHAIN_ID),
  deployBlock: process.env.NEXT_PUBLIC_DEPLOY_BLOCK || undefined,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || undefined,
};

const parsed = clientEnvSchema.safeParse(rawEnv);

/**
 * A safe, always-defined config. When validation fails we fall back to sane
 * defaults so the build and static pages still render; `envIssues` carries the
 * problems for the UI to display. This is deliberate graceful degradation —
 * we never hard-throw at import time and break `next build`.
 */
export const env: ClientEnv = parsed.success
  ? parsed.data
  : {
      walletConnectId: rawEnv.walletConnectId,
      agentApiUrl: /^https?:\/\//.test(rawEnv.agentApiUrl)
        ? rawEnv.agentApiUrl
        : "http://localhost:8080",
      apiUrl: /^https?:\/\//.test(rawEnv.apiUrl)
        ? rawEnv.apiUrl
        : "http://localhost:8081",
      chainId: Number(rawEnv.chainId) || EXPECTED_CHAIN_ID,
      deployBlock: undefined,
      rpcUrl: undefined,
    };

export interface EnvIssue {
  readonly path: string;
  readonly message: string;
}

export const envIssues: readonly EnvIssue[] = parsed.success
  ? []
  : parsed.error.issues.map((issue) => ({
      path: issue.path.join(".") || "(root)",
      message: issue.message,
    }));

export const isEnvValid = parsed.success;

/** True when the configured chain does not match the expected network. */
export const isUnexpectedChain = env.chainId !== EXPECTED_CHAIN_ID;
