/** Match the shared color contract before rendering untrusted API values as CSS. */
export function hexColor(value: unknown): string | undefined {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : undefined;
}
