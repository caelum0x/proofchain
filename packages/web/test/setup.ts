import "@testing-library/jest-dom/vitest";

// Provide deterministic public env for modules that read it at import time.
process.env.NEXT_PUBLIC_WALLETCONNECT_ID ||= "test-walletconnect-id";
process.env.NEXT_PUBLIC_AGENT_API_URL ||= "http://agent.test";
process.env.NEXT_PUBLIC_CHAIN_ID ||= "84532";

// jsdom's Blob/File implementation omits the standard `arrayBuffer()` method
// that real browsers provide. Polyfill it (via FileReader, which jsdom does
// support) so code using the standard Web API — e.g. `fileToBase64` — works
// under test without changing the production implementation.
if (typeof Blob !== "undefined" && typeof Blob.prototype.arrayBuffer !== "function") {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}
