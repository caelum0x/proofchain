import { describe, it, expect } from "vitest";
import { loadInfraConfig } from "./env.js";

describe("loadInfraConfig", () => {
  it("marks supabase unconfigured when url is missing", () => {
    const cfg = loadInfraConfig({} as NodeJS.ProcessEnv);
    expect(cfg.supabase.configured).toBe(false);
    expect(cfg.ipfs.configured).toBe(false);
  });

  it("requires BOTH url and service role key to enable supabase", () => {
    const cfg = loadInfraConfig({
      SUPABASE_URL: "https://proj.supabase.co",
    } as NodeJS.ProcessEnv);
    expect(cfg.supabase.configured).toBe(false);
  });

  it("enables supabase when url + key are present", () => {
    const cfg = loadInfraConfig({
      SUPABASE_URL: "https://proj.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "svc-key",
    } as NodeJS.ProcessEnv);
    expect(cfg.supabase.configured).toBe(true);
    if (cfg.supabase.configured) {
      expect(cfg.supabase.url).toBe("https://proj.supabase.co");
      expect(cfg.supabase.serviceRoleKey).toBe("svc-key");
    }
  });

  it("enables ipfs when a Pinata JWT is present and applies defaults", () => {
    const cfg = loadInfraConfig({ PINATA_JWT: "jwt" } as NodeJS.ProcessEnv);
    expect(cfg.ipfs.configured).toBe(true);
    expect(cfg.ipfs.jwt).toBe("jwt");
    expect(cfg.ipfs.apiUrl).toBe("https://api.pinata.cloud");
    expect(cfg.ipfs.gatewayUrl).toBe("https://gateway.pinata.cloud/ipfs");
  });

  it("treats empty / whitespace strings as unset", () => {
    const cfg = loadInfraConfig({
      SUPABASE_URL: "   ",
      PINATA_JWT: "",
    } as NodeJS.ProcessEnv);
    expect(cfg.supabase.configured).toBe(false);
    expect(cfg.ipfs.configured).toBe(false);
  });

  it("strips trailing slashes from overridden urls", () => {
    const cfg = loadInfraConfig({
      PINATA_JWT: "jwt",
      PINATA_API_URL: "https://custom.pinata.dev/",
      IPFS_GATEWAY_URL: "https://gw.example/ipfs/",
    } as NodeJS.ProcessEnv);
    expect(cfg.ipfs.apiUrl).toBe("https://custom.pinata.dev");
    expect(cfg.ipfs.gatewayUrl).toBe("https://gw.example/ipfs");
  });

  it("throws on malformed provided values (fail fast)", () => {
    expect(() =>
      loadInfraConfig({ SUPABASE_URL: "not-a-url" } as NodeJS.ProcessEnv),
    ).toThrow();
  });
});
