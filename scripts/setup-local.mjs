import { randomBytes } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";

try {
  await access(".env");
  console.info("Existing .env preserved.");
} catch {
  const example = await readFile(".env.example", "utf8");
  await writeFile(
    ".env",
    example
      .replace(/^BETTER_AUTH_SECRET=$/m, `BETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}`)
      .replace(/^GOOGLE_TOKEN_ENCRYPTION_KEY=$/m, `GOOGLE_TOKEN_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}`),
    { flag: "wx" },
  );
  console.info("Created ignored .env with local generated keys. External service credentials remain unconfigured.");
}
