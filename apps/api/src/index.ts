import { createAuth } from "@lifesync/auth";
import { readConfig } from "@lifesync/config";
import { createDatabase } from "@lifesync/db";
import { createApp } from "./app";
import { runScheduled } from "./jobs";

interface Bindings {
  [key: string]: unknown;
  HYPERDRIVE?: { connectionString: string };
}
export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    if (new URL(request.url).pathname === "/health")
      return Response.json({ data: { status: "ok" } }, { headers: { "Cache-Control": "no-store" } });
    let db: ReturnType<typeof createDatabase> | undefined;
    try {
      const config = readConfig({ ...env, DATABASE_URL: env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL });
      db = createDatabase(config.DATABASE_URL);
      const response = await createApp({ db, auth: createAuth(db, config), config }).fetch(request);
      if (response.headers.get("content-type")?.includes("text/event-stream") && response.body) {
        const connection = db;
        db = undefined;
        const reader = response.body.getReader();
        const body = new ReadableStream<Uint8Array>({
          async pull(controller) {
            try {
              const part = await reader.read();
              if (part.done) {
                controller.close();
                await connection.$client.end();
              } else controller.enqueue(part.value);
            } catch (error) {
              controller.error(error);
              await connection.$client.end();
            }
          },
          async cancel() {
            await reader.cancel();
            await connection.$client.end();
          },
        });
        return new Response(body, { status: response.status, headers: response.headers });
      }
      return response;
    } catch {
      const requestId = crypto.randomUUID();
      console.error(JSON.stringify({ requestId, code: "API_CONFIGURATION_OR_CONNECTION_FAILURE" }));
      return Response.json(
        { error: { code: "SERVICE_UNAVAILABLE", message: "Service is temporarily unavailable", requestId } },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    } finally {
      if (db) await db.$client.end();
    }
  },
  async scheduled(_event: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    const config = readConfig({ ...env, DATABASE_URL: env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL });
    ctx.waitUntil(
      (async () => {
        const db = createDatabase(config.DATABASE_URL);
        try {
          await runScheduled(db, config);
        } finally {
          await db.$client.end();
        }
      })(),
    );
  },
};
