import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const monorepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the file-tracing root to the monorepo so an unrelated lockfile elsewhere
  // on the machine can't be inferred as the workspace root.
  outputFileTracingRoot: monorepoRoot,
  // Transpile the workspace shared package so its ESM/TS sources resolve during build.
  transpilePackages: ["@proofchain/shared"],
  eslint: {
    // Lint is enforced via the dedicated `lint` script in CI; do not silently ignore errors.
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Strict types are a hard requirement — never ship with type errors.
    ignoreBuildErrors: false,
  },
  experimental: {
    // wagmi/viem ship ESM; ensure server components tree-shake cleanly.
    optimizePackageImports: ["wagmi", "viem", "@rainbow-me/rainbowkit"],
  },
  webpack: (config, { webpack, isServer }) => {
    // RainbowKit's default Base Account connector transitively pulls in
    // @coinbase/cdp-sdk, which lazily references the optional `@x402/*`
    // payment packages. ProofChain does not use x402 payments (settlement is
    // handled by SettlementEscrow), and those packages are not installed, so
    // ignore them to keep the bundle resolvable. The code paths that touch
    // them are never reached in this app.
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));

    if (!isServer) {
      // @proofchain/shared statically imports Node built-ins (`node:module`,
      // `node:fs`) for its on-disk deployment-manifest reader. That code is
      // guarded to run only under Node; the browser supplies addresses via
      // NEXT_PUBLIC_* env overrides. Stub the built-ins to empty modules in the
      // client bundle so webpack can resolve them.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        module: false,
        path: false,
        "node:fs": false,
        "node:module": false,
        "node:path": false,
      };
    }
    return config;
  },
};

export default nextConfig;
