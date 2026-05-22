import crypto from "node:crypto";

export function verifyGithubSignature(
  payload: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const received = signatureHeader.slice("sha256=".length);

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(received, "utf8"));
  } catch {
    return false;
  }
}
