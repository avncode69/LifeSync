import { writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { readConfig } from "@lifesync/config";
import { createDatabase } from "@lifesync/db";
import { runScheduled } from "../src/jobs";
import { runExclusively } from "../src/scheduler";

const config = readConfig(process.env);
const db = createDatabase(config.DATABASE_URL);
const abort = new AbortController();
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => abort.abort());
try {
  while (!abort.signal.aborted) {
    try {
      await runExclusively(db.$client, () => runScheduled(db, config));
      await writeFile("/tmp/lifesync-jobs-heartbeat", String(Date.now()));
    } catch {
      console.error("SCHEDULER_CYCLE_FAILED");
    }
    await setTimeout(300_000, undefined, { signal: abort.signal }).catch(() => {});
  }
} finally {
  await db.$client.end();
}
