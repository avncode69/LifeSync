import web from "vinext/server/fetch-handler";

type Environment = {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  API: { fetch: (request: Request) => Promise<Response> };
};
export default {
  async fetch(request: Request, env: Environment, context: Parameters<typeof web.fetch>[2]) {
    const path = new URL(request.url).pathname;
    if (path === "/api" || path.startsWith("/api/")) return env.API.fetch(request);
    const response = await web.fetch(request, env, context);
    const result = new Response(response.body, response);
    result.headers.set("X-Content-Type-Options", "nosniff");
    result.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return result;
  },
};
