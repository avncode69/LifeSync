import { apiErrorSchema, resourceRegistry } from "@lifesync/contracts";
import { z } from "zod";
import { serviceBodies, serviceQueries } from "./service-contracts";

type Operation = Record<string, unknown>;
export function makeOpenApi(routes: { method: string; path: string }[]) {
  const paths: Record<string, Record<string, Operation>> = {};
  const json = (schema: z.ZodType) => ({
    "application/json": { schema: z.toJSONSchema(schema, { unrepresentable: "any" }) },
  });
  const errors = Object.fromEntries(
    [400, 401, 403, 404, 409, 413, 429, 503].map((status) => [
      String(status),
      { description: "Typed error with safe code, message and requestId", content: json(apiErrorSchema) },
    ]),
  );
  const normalResponses = {
    "200": {
      description: "Owner-scoped result",
      content: {
        "application/json": { schema: { type: "object", properties: { data: {}, nextCursor: { type: "string" } } } },
      },
    },
    ...errors,
  };
  for (const resource of Object.values(resourceRegistry)) {
    const path = `/api/v1${resource.path}`;
    paths[path] = {
      get: { summary: `List ${resource.table}`, responses: normalResponses },
      ...(resource.table === "notifications"
        ? {}
        : {
            post: {
              summary: `Create ${resource.table}`,
              requestBody: { required: true, content: json(resource.createSchema) },
              responses: { "201": { description: "Created owner-scoped resource" }, ...errors },
            },
          }),
    };
    paths[`${path}/{id}`] = {
      get: { summary: `Read ${resource.table}`, responses: normalResponses },
      patch: {
        summary: `Update ${resource.table}`,
        requestBody: { required: true, content: json(resource.updateSchema) },
        responses: normalResponses,
      },
      delete: { summary: `Move ${resource.table} to trash`, responses: normalResponses },
    };
  }
  for (const route of routes) {
    if (!["GET", "POST", "PATCH", "DELETE"].includes(route.method) || route.path.includes("*")) continue;
    const path = route.path.replace(/:([a-zA-Z][a-zA-Z0-9]*)/g, "{$1}"),
      method = route.method.toLowerCase();
    if (!path.startsWith("/api/") && path !== "/health") continue;
    const operation = paths[path]?.[method] ?? { summary: `${route.method} ${path}`, responses: normalResponses };
    const parameters: Record<string, unknown>[] = [];
    for (const match of path.matchAll(/\{([^}]+)\}/g))
      parameters.push({
        in: "path",
        name: match[1],
        required: true,
        schema: { type: "string", ...(match[1] === "id" ? { format: "uuid" } : {}) },
      });
    const query = serviceQueries[path];
    if (query)
      for (const [name, field] of Object.entries(query.shape))
        parameters.push({
          in: "query",
          name,
          required: !field.isOptional(),
          schema: z.toJSONSchema(field, { unrepresentable: "any" }),
        });
    const resource = Object.values(resourceRegistry).find((value) => path === `/api/v1${value.path}`);
    if (method === "get" && resource) {
      const shape = {
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.uuid().optional(),
        search: z.string().max(200).optional(),
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
        ...Object.fromEntries(Object.keys(resource.relations).map((name) => [name, z.uuid().optional()])),
      };
      for (const [name, field] of Object.entries(shape))
        parameters.push({ in: "query", name, schema: z.toJSONSchema(field, { unrepresentable: "any" }) });
    }
    if (
      [
        "POST /api/v1/finance/transactions",
        "POST /api/v1/ai/chat",
        "POST /api/v1/health/templates/{id}/start",
      ].includes(`${route.method} ${path}`)
    )
      parameters.push({
        in: "header",
        name: "Idempotency-Key",
        required: true,
        schema: { type: "string", minLength: 1, maxLength: 128, pattern: "^[A-Za-z0-9_-]+$" },
      });
    if (parameters.length) operation.parameters = parameters;
    const body = serviceBodies[`${route.method} ${path}`];
    if (body) operation.requestBody = { required: true, content: json(body) };
    if (path === "/api/v1/ai/chat")
      operation.responses = {
        "200": {
          description: "SSE text/action/done/error events; mutations require confirmation",
          content: { "text/event-stream": { schema: { type: "string" } } },
        },
        ...errors,
      };
    if (path.startsWith("/api/public/") || path === "/health" || path.startsWith("/api/webhooks/"))
      operation.security = [];
    if (path.includes("/admin/"))
      operation.description =
        "Administrator role required. Responses expose operational metadata, never private module content.";
    paths[path] ??= {};
    paths[path][method] = operation;
  }
  const authBodies: Record<string, z.ZodType> = {
    "/api/auth/sign-up/email": z.object({
      name: z.string().min(1),
      email: z.email(),
      password: z.string().min(12).max(128),
      termsAccepted: z.literal(true),
      callbackURL: z.string().optional(),
    }),
    "/api/auth/sign-in/email": z.object({
      email: z.email(),
      password: z.string().min(1).max(128),
      rememberMe: z.boolean().optional(),
    }),
    "/api/auth/request-password-reset": z.object({ email: z.email(), redirectTo: z.string().optional() }),
    "/api/auth/reset-password": z.object({ newPassword: z.string().min(12).max(128), token: z.string().optional() }),
    "/api/auth/send-verification-email": z.object({ email: z.email(), callbackURL: z.string().optional() }),
    "/api/auth/sign-in/social": z.object({ provider: z.literal("google"), callbackURL: z.string().optional() }),
    "/api/auth/change-password": z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(12).max(128),
      revokeOtherSessions: z.boolean().optional(),
    }),
  };
  for (const [path, body] of Object.entries(authBodies))
    paths[path] = {
      post: {
        summary: path.split("/").at(-1),
        requestBody: { required: true, content: json(body) },
        responses: normalResponses,
        ...(path !== "/api/auth/change-password" ? { security: [] } : {}),
      },
    };
  paths["/api/auth/sign-out"] = {
    post: { summary: "Revoke current session and clear session cookie", responses: normalResponses },
  };
  paths["/api/auth/get-session"] = {
    get: { summary: "Read current verified server session", responses: normalResponses },
  };
  paths["/api/auth/verify-email"] = {
    get: {
      summary: "Verify expiring email link",
      security: [],
      parameters: [
        { in: "query", name: "token", required: true, schema: { type: "string" } },
        { in: "query", name: "callbackURL", schema: { type: "string" } },
      ],
      responses: {
        "200": { description: "Email verified" },
        "302": { description: "Redirect after verification" },
        ...errors,
      },
    },
  };
  return {
    openapi: "3.1.0",
    info: { title: "LifeSync API", version: "1.0.0" },
    paths,
    components: {
      securitySchemes: { sessionCookie: { type: "apiKey", in: "cookie", name: "better-auth.session_token" } },
    },
    security: [{ sessionCookie: [] }],
  };
}
