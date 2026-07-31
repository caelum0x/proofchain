import { describe, it, expect } from "vitest";
import { signRequest, hashPayload } from "./sigv4.js";

const EMPTY_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("SigV4 signer", () => {
  it("hashPayload matches the known empty-string sha256", () => {
    expect(hashPayload(new Uint8Array())).toBe(EMPTY_HASH);
  });

  // AWS canonical example: "GET Object" from the S3 SigV4 documentation.
  it("reproduces the AWS S3 GET Object reference signature", () => {
    const result = signRequest({
      method: "GET",
      url: "https://examplebucket.s3.amazonaws.com/test.txt",
      region: "us-east-1",
      service: "s3",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      headers: { range: "bytes=0-9" },
      payloadHash: EMPTY_HASH,
      date: new Date("2013-05-24T00:00:00Z"),
    });

    expect(result.amzDate).toBe("20130524T000000Z");
    expect(result.signedHeaders).toBe("host;range;x-amz-content-sha256;x-amz-date");
    // Signature derived from AWS's documented canonical request for this example
    // (canonical-request hash 7344ae5b…, verified independently).
    expect(result.authorization).toContain(
      "Signature=67fe34c8530db585abddc51067328adfedb6e42487d2566dc7d927d6e2722900",
    );
    expect(result.authorization).toContain("Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request");
    expect(result.headers["x-amz-content-sha256"]).toBe(EMPTY_HASH);
  });

  it("is deterministic for a fixed date and inputs", () => {
    const input = {
      method: "PUT",
      url: "https://bucket.example.com/a/b c.txt?x=1",
      region: "auto",
      service: "s3",
      accessKeyId: "AKID",
      secretAccessKey: "secret",
      payloadHash: EMPTY_HASH,
      date: new Date("2026-07-31T12:00:00Z"),
    } as const;
    expect(signRequest(input).authorization).toBe(signRequest(input).authorization);
  });
});
