import { z } from "zod";

export class ApiFailure extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}
export function requireMutationOrigin(method: string, origin: string | null, appUrl: string): void {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return;
  if (!origin || origin !== new URL(appUrl).origin)
    throw new ApiFailure("ORIGIN_REJECTED", "Request origin is not permitted", 403);
}
export function publicError(error: unknown, requestId: string) {
  return {
    error: {
      code: error instanceof ApiFailure ? error.code : "INTERNAL_ERROR",
      message: error instanceof ApiFailure ? error.message : "Unable to process this request",
      requestId,
    },
  };
}
export function parseCursor(value?: string): string | undefined {
  if (!value) return undefined;
  if (!z.uuid().safeParse(value).success) throw new ApiFailure("INVALID_CURSOR", "Invalid pagination cursor");
  return value;
}
