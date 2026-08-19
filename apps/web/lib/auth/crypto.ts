import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function randomNonce(): string {
  return randomBytes(16).toString("hex");
}

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftDigest = Buffer.from(sha256(left), "hex");
  const rightDigest = Buffer.from(sha256(right), "hex");
  return timingSafeEqual(leftDigest, rightDigest);
}
