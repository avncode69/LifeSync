import { spawnSync } from "node:child_process";

const environment = process.argv[2];
const deploy = process.argv.includes("--deploy");
if (!["staging", "production"].includes(environment)) throw new Error("Expected staging or production");
const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const build = spawnSync(executable, ["exec", "vinext", "build", "--mode", environment], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, CLOUDFLARE_BUILD: "1", CLOUDFLARE_ENV: environment },
});
if (build.status !== 0) process.exit(build.status ?? 1);
if (deploy) {
  const result = spawnSync(executable, ["exec", "wrangler", "deploy", "--config", "dist/server/wrangler.json"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  process.exit(result.status ?? 1);
}
