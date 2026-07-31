/**
 * Environment loading + validation for the infra package.
 *
 * Every var this package consumes is OPTIONAL by design: the Supabase client
 * no-ops when `SUPABASE_URL` is unset, and IPFS falls back to a local mock when
 * `PINATA_JWT` is unset. We still VALIDATE the shape of whatever IS provided so
 * misconfiguration fails fast and loudly (e.g. a malformed URL) instead of at
 * the first request. No secrets are ever hardcoded — everything is read here.
 */
import { z } from "zod";

const EnvSchema = z.object({
  // Supabase — both required together to enable persistence.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  // IPFS — Pinata JWT enables real pinning; absent → local mock fallback.
  PINATA_JWT: z.string().min(1).optional(),
  // Optional overrides (sensible defaults applied downstream).
  PINATA_API_URL: z.string().url().optional(),
  IPFS_GATEWAY_URL: z.string().url().optional(),
  // S3 / R2-compatible object storage — all three of bucket + key id + secret
  // required together to enable the S3 adapter; absent → local blob fallback.
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_PUBLIC_URL: z.string().url().optional(),
});

export type InfraEnv = z.infer<typeof EnvSchema>;

export interface InfraConfig {
  readonly supabase:
    | { readonly configured: true; readonly url: string; readonly serviceRoleKey: string }
    | { readonly configured: false };
  readonly ipfs: {
    readonly configured: boolean;
    readonly jwt?: string;
    readonly apiUrl: string;
    readonly gatewayUrl: string;
  };
  readonly s3:
    | {
        readonly configured: true;
        readonly bucket: string;
        readonly accessKeyId: string;
        readonly secretAccessKey: string;
        readonly region: string;
        readonly endpoint: string;
        readonly publicUrl?: string;
      }
    | { readonly configured: false };
}

const DEFAULT_PINATA_API_URL = "https://api.pinata.cloud";
const DEFAULT_IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";
const DEFAULT_S3_REGION = "auto";

/**
 * Parse + validate an environment source (defaults to `process.env`).
 * Throws a `ZodError` only when a provided value is malformed — absence is fine.
 */
export function loadInfraConfig(
  source: NodeJS.ProcessEnv = process.env,
): InfraConfig {
  const env: InfraEnv = EnvSchema.parse({
    SUPABASE_URL: emptyToUndefined(source.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: emptyToUndefined(source.SUPABASE_SERVICE_ROLE_KEY),
    PINATA_JWT: emptyToUndefined(source.PINATA_JWT),
    PINATA_API_URL: emptyToUndefined(source.PINATA_API_URL),
    IPFS_GATEWAY_URL: emptyToUndefined(source.IPFS_GATEWAY_URL),
    S3_BUCKET: emptyToUndefined(source.S3_BUCKET),
    S3_ACCESS_KEY_ID: emptyToUndefined(source.S3_ACCESS_KEY_ID),
    S3_SECRET_ACCESS_KEY: emptyToUndefined(source.S3_SECRET_ACCESS_KEY),
    S3_REGION: emptyToUndefined(source.S3_REGION),
    S3_ENDPOINT: emptyToUndefined(source.S3_ENDPOINT),
    S3_PUBLIC_URL: emptyToUndefined(source.S3_PUBLIC_URL),
  });

  const supabaseConfigured =
    env.SUPABASE_URL !== undefined && env.SUPABASE_SERVICE_ROLE_KEY !== undefined;

  const s3Configured =
    env.S3_BUCKET !== undefined &&
    env.S3_ACCESS_KEY_ID !== undefined &&
    env.S3_SECRET_ACCESS_KEY !== undefined;

  return {
    supabase: supabaseConfigured
      ? {
          configured: true,
          url: env.SUPABASE_URL as string,
          serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY as string,
        }
      : { configured: false },
    ipfs: {
      configured: env.PINATA_JWT !== undefined,
      ...(env.PINATA_JWT !== undefined ? { jwt: env.PINATA_JWT } : {}),
      apiUrl: stripTrailingSlash(env.PINATA_API_URL ?? DEFAULT_PINATA_API_URL),
      gatewayUrl: stripTrailingSlash(env.IPFS_GATEWAY_URL ?? DEFAULT_IPFS_GATEWAY),
    },
    s3: s3Configured
      ? {
          configured: true,
          bucket: env.S3_BUCKET as string,
          accessKeyId: env.S3_ACCESS_KEY_ID as string,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
          region: env.S3_REGION ?? DEFAULT_S3_REGION,
          endpoint: stripTrailingSlash(
            env.S3_ENDPOINT ?? defaultS3Endpoint(env.S3_REGION ?? DEFAULT_S3_REGION),
          ),
          ...(env.S3_PUBLIC_URL !== undefined
            ? { publicUrl: stripTrailingSlash(env.S3_PUBLIC_URL) }
            : {}),
        }
      : { configured: false },
  };
}

/** AWS S3 virtual-host-agnostic path-style endpoint for a region. */
function defaultS3Endpoint(region: string): string {
  return region === "auto" || region === "us-east-1"
    ? "https://s3.amazonaws.com"
    : `https://s3.${region}.amazonaws.com`;
}

/** Treat empty / whitespace-only env strings as absent. */
function emptyToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
