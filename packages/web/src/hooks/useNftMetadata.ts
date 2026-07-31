"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ipfsToHttp } from "@/lib/format";

/** Minimal, permissive ERC721 metadata shape — we render only what we recognise. */
const metadataSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    attributes: z
      .array(z.object({ trait_type: z.string().optional(), value: z.unknown().optional() }))
      .optional(),
  })
  .passthrough();

export type NftMetadata = z.infer<typeof metadataSchema>;

/**
 * Fetch + validate ERC721 token metadata from a `tokenURI`. Handles `data:` JSON
 * URIs and ipfs/http links. Never throws into render — failures surface via
 * `isError` so the UI can degrade to showing the raw URI.
 */
export function useNftMetadata(tokenURI: string | undefined) {
  return useQuery<NftMetadata | null>({
    queryKey: ["nft-metadata", tokenURI],
    enabled: Boolean(tokenURI),
    staleTime: 60_000,
    queryFn: async () => {
      if (!tokenURI) return null;

      // Inline data URI (common for fully on-chain metadata).
      if (tokenURI.startsWith("data:")) {
        const comma = tokenURI.indexOf(",");
        if (comma === -1) return null;
        const meta = tokenURI.slice(0, comma);
        const payload = tokenURI.slice(comma + 1);
        const json = meta.includes("base64")
          ? JSON.parse(atob(payload))
          : JSON.parse(decodeURIComponent(payload));
        return metadataSchema.parse(json);
      }

      const url = ipfsToHttp(tokenURI);
      if (!/^https?:\/\//.test(url)) return null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Metadata request failed (HTTP ${res.status})`);
        const json = await res.json();
        return metadataSchema.parse(json);
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
