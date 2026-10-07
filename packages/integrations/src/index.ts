import { z } from "zod";

export { sendWebPush, validatePushEndpoint } from "./push";

export type Fetcher = typeof fetch;
export class ProviderError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
async function providerFetch(url: string, init: RequestInit, fetcher: Fetcher): Promise<Response> {
  const timeout = AbortSignal.timeout(20000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  const response = await fetcher(url, { ...init, signal });
  if (!response.ok)
    throw new ProviderError(
      response.status === 401 || response.status === 403 ? "PROVIDER_RECONNECT_REQUIRED" : "PROVIDER_REQUEST_FAILED",
      response.status,
    );
  return response;
}
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (text: string) => Uint8Array.from(atob(text), (value) => value.charCodeAt(0));
const utf8 = new TextEncoder();

export async function encryptToken(token: string, encodedKey: string, ownerId: string): Promise<string> {
  const rawKey = decode(encodedKey);
  if (rawKey.length !== 32) throw new Error("INVALID_ENCRYPTION_KEY");
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: utf8.encode(ownerId) },
    key,
    utf8.encode(token),
  );
  return `v1.${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}
export async function decryptToken(envelope: string, encodedKey: string, ownerId: string): Promise<string> {
  const [version, iv, cipher, extra] = envelope.split(".");
  if (version !== "v1" || !iv || !cipher || extra) throw new Error("INVALID_TOKEN_ENVELOPE");
  const key = await crypto.subtle.importKey("raw", decode(encodedKey), "AES-GCM", false, ["decrypt"]);
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decode(iv), additionalData: utf8.encode(ownerId) },
      key,
      decode(cipher),
    ),
  );
}
export async function pkceChallenge(verifier: string): Promise<string> {
  return encode(new Uint8Array(await crypto.subtle.digest("SHA-256", utf8.encode(verifier))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function workspaceAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
  calendar: boolean;
  drive: boolean;
}): string {
  const scopes = ["openid", "email", "profile"];
  if (input.calendar)
    scopes.push(
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    );
  if (input.drive) scopes.push("https://www.googleapis.com/auth/drive.file");
  if (!input.calendar && !input.drive) throw new Error("WORKSPACE_SCOPE_REQUIRED");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  }).toString();
  return url.toString();
}
const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().positive(),
  scope: z.string().optional(),
});
export async function exchangeGoogleCode(
  input: { code: string; verifier: string; clientId: string; clientSecret: string; redirectUri: string },
  fetcher: Fetcher = fetch,
) {
  const response = await providerFetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      body: new URLSearchParams({
        code: input.code,
        code_verifier: input.verifier,
        client_id: input.clientId,
        client_secret: input.clientSecret,
        redirect_uri: input.redirectUri,
        grant_type: "authorization_code",
      }),
    },
    fetcher,
  );
  return tokenSchema.parse(await response.json());
}
export async function refreshGoogleToken(
  input: { refreshToken: string; clientId: string; clientSecret: string },
  fetcher: Fetcher = fetch,
) {
  const response = await providerFetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      body: new URLSearchParams({
        refresh_token: input.refreshToken,
        client_id: input.clientId,
        client_secret: input.clientSecret,
        grant_type: "refresh_token",
      }),
    },
    fetcher,
  );
  return tokenSchema.parse(await response.json());
}
export async function revokeGoogleToken(token: string, fetcher: Fetcher = fetch): Promise<void> {
  await providerFetch(
    "https://oauth2.googleapis.com/revoke",
    { method: "POST", body: new URLSearchParams({ token }) },
    fetcher,
  );
}
export async function googleIdentity(accessToken: string, fetcher: Fetcher = fetch) {
  const response = await providerFetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } },
    fetcher,
  );
  return z
    .object({ sub: z.string(), email: z.email(), email_verified: z.boolean(), picture: z.url().optional() })
    .parse(await response.json());
}
export function parseGoogleFile(value: string): string {
  if (/^[A-Za-z0-9_-]{6,200}$/.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("INVALID_GOOGLE_FILE");
  }
  if (
    url.protocol !== "https:" ||
    !["drive.google.com", "docs.google.com"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("INVALID_GOOGLE_FILE");
  const id = /\/d\/([A-Za-z0-9_-]+)/.exec(url.pathname)?.[1] ?? url.searchParams.get("id");
  if (!id || !/^[A-Za-z0-9_-]{6,200}$/.test(id)) throw new Error("INVALID_GOOGLE_FILE");
  return id;
}
export async function googleDriveMetadata(accessToken: string, fileId: string, fetcher: Fetcher = fetch) {
  const id = parseGoogleFile(fileId);
  const response = await providerFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,webViewLink,modifiedTime,iconLink`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    fetcher,
  );
  return z
    .object({
      id: z.string(),
      name: z.string(),
      mimeType: z.string(),
      webViewLink: z.url(),
      modifiedTime: z.string().optional(),
      iconLink: z.url().optional(),
    })
    .parse(await response.json());
}
export const googleEventSchema = z.object({
  id: z.string(),
  etag: z.string().optional(),
  status: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  recurrence: z.array(z.string()).optional(),
  updated: z.string().optional(),
  start: z
    .object({ date: z.string().optional(), dateTime: z.string().optional(), timeZone: z.string().optional() })
    .optional(),
  end: z
    .object({ date: z.string().optional(), dateTime: z.string().optional(), timeZone: z.string().optional() })
    .optional(),
  extendedProperties: z.object({ private: z.record(z.string(), z.string()).optional() }).optional(),
});
export type GoogleEvent = z.infer<typeof googleEventSchema>;
export class GoogleCalendarClient {
  constructor(
    private token: string,
    private fetcher: Fetcher = fetch,
  ) {}
  private async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    return providerFetch(`https://www.googleapis.com/calendar/v3/${path}`, { ...init, headers }, this.fetcher);
  }
  async calendars() {
    const response = await this.request("users/me/calendarList");
    return z
      .object({
        items: z
          .array(
            z.object({ id: z.string(), summary: z.string(), primary: z.boolean().optional(), accessRole: z.string() }),
          )
          .default([]),
      })
      .parse(await response.json()).items;
  }
  async listEvents(
    calendarId: string,
    syncToken?: string,
  ): Promise<{ events: GoogleEvent[]; syncToken: string; reset: boolean }> {
    const events: GoogleEvent[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 100; page++) {
      const params = new URLSearchParams({ maxResults: "2500", showDeleted: "true" });
      if (syncToken) params.set("syncToken", syncToken);
      if (pageToken) params.set("pageToken", pageToken);
      let response: Response;
      try {
        response = await this.request(`calendars/${encodeURIComponent(calendarId)}/events?${params}`);
      } catch (error) {
        if (error instanceof ProviderError && error.status === 410 && syncToken) {
          const result = await this.listEvents(calendarId);
          return { ...result, reset: true };
        }
        throw error;
      }
      const data = z
        .object({
          items: z.array(googleEventSchema).default([]),
          nextPageToken: z.string().optional(),
          nextSyncToken: z.string().optional(),
        })
        .parse(await response.json());
      events.push(...data.items);
      pageToken = data.nextPageToken;
      if (!pageToken) {
        if (!data.nextSyncToken) throw new Error("GOOGLE_SYNC_TOKEN_MISSING");
        return { events, syncToken: data.nextSyncToken, reset: false };
      }
    }
    throw new Error("GOOGLE_SYNC_PAGE_LIMIT");
  }
  async putEvent(
    calendarId: string,
    localId: string,
    data: Record<string, unknown>,
    etag?: string,
  ): Promise<GoogleEvent> {
    // UUID hex falls within Google's base32hex ID alphabet. Deterministic ID prevents duplicate inserts.
    const eventId = `ls${localId.replace(/-/g, "").toLowerCase()}`;
    const path = `calendars/${encodeURIComponent(calendarId)}/events`;
    const body = JSON.stringify({ ...data, id: eventId });
    try {
      const response = await this.request(etag ? `${path}/${eventId}` : path, {
        method: etag ? "PUT" : "POST",
        headers: etag ? { "If-Match": etag } : {},
        body,
      });
      return googleEventSchema.parse(await response.json());
    } catch (error) {
      if (error instanceof ProviderError && error.status === 409 && !etag) {
        return googleEventSchema.parse(await (await this.request(`${path}/${eventId}`)).json());
      }
      throw error;
    }
  }
  async updateEvent(
    calendarId: string,
    remoteId: string,
    data: Record<string, unknown>,
    etag: string,
  ): Promise<GoogleEvent> {
    const response = await this.request(
      `calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(remoteId)}`,
      { method: "PATCH", headers: { "If-Match": etag }, body: JSON.stringify(data) },
    );
    return googleEventSchema.parse(await response.json());
  }
  async deleteEvent(calendarId: string, remoteId: string, etag?: string): Promise<void> {
    try {
      await this.request(`calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(remoteId)}`, {
        method: "DELETE",
        headers: etag ? { "If-Match": etag } : {},
      });
    } catch (error) {
      if (!(error instanceof ProviderError && [404, 410].includes(error.status))) throw error;
    }
  }
  async watch(calendarId: string, channelId: string, token: string, callbackUrl: string) {
    if (!callbackUrl.startsWith("https://")) throw new Error("GOOGLE_WATCH_HTTPS_REQUIRED");
    const response = await this.request(`calendars/${encodeURIComponent(calendarId)}/events/watch`, {
      method: "POST",
      body: JSON.stringify({ id: channelId, token, type: "web_hook", address: callbackUrl }),
    });
    return z.object({ id: z.string(), resourceId: z.string(), expiration: z.string() }).parse(await response.json());
  }
  async stopWatch(channelId: string, resourceId: string): Promise<void> {
    await this.request("channels/stop", { method: "POST", body: JSON.stringify({ id: channelId, resourceId }) });
  }
}
export function syncDecision(input: {
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  lastSyncedAt?: string | null;
}): "conflict" | "push" | "pull" | "unchanged" {
  if (!input.lastSyncedAt) return "pull";
  const last = Date.parse(input.lastSyncedAt);
  const local = Date.parse(input.localUpdatedAt) > last;
  const remote = Date.parse(input.remoteUpdatedAt) > last;
  if (local && remote) return "conflict";
  if (local) return "push";
  if (remote) return "pull";
  return "unchanged";
}
export interface ExchangeRate {
  currency: string;
  rate: string;
  date: string;
  source: "NBU";
  fetchedAt: string;
}
export interface RateProvider {
  rates(date: string): Promise<ExchangeRate[]>;
}
export class NbuRateProvider implements RateProvider {
  constructor(private fetcher: Fetcher = fetch) {}
  async rates(date: string): Promise<ExchangeRate[]> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0, 10) !== date)
      throw new Error("INVALID_RATE_DATE");
    const response = await providerFetch(
      `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?date=${date.replace(/-/g, "")}&json`,
      {},
      this.fetcher,
    );
    const rows = z
      .array(
        z.object({
          cc: z.string().regex(/^[A-Z]{3}$/),
          rate: z.number().positive().finite(),
          exchangedate: z.string().regex(/^\d{2}\.\d{2}\.\d{4}$/),
        }),
      )
      .min(1)
      .parse(await response.json());
    const fetchedAt = new Date().toISOString();
    const rates = rows.map((row) => {
      const [day, month, year] = row.exchangedate.split(".");
      const rateDate = `${year}-${month}-${day}`;
      if (rateDate !== date) throw new Error("NBU_DATE_MISMATCH");
      return { currency: row.cc, rate: String(row.rate), date, source: "NBU" as const, fetchedAt };
    });
    return [
      ...rates.filter((row) => row.currency !== "UAH"),
      { currency: "UAH", rate: "1", date, source: "NBU", fetchedAt },
    ];
  }
}

export interface AIMessage {
  role: "user" | "assistant";
  text: string;
}
export interface AITool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
export interface AIRequest {
  messages: AIMessage[];
  system: string;
  tools?: AITool[];
  signal?: AbortSignal;
}
export type AIChunk = { type: "text"; text: string } | { type: "tool"; name: string; args: Record<string, unknown> };
export interface AIProvider {
  chat(request: AIRequest): Promise<string>;
  structured(request: AIRequest): Promise<unknown>;
  toolCall(request: AIRequest): Promise<AIChunk[]>;
  stream(request: AIRequest): AsyncIterable<AIChunk>;
}
const geminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z.array(
              z.object({
                text: z.string().optional(),
                functionCall: z.object({ name: z.string(), args: z.record(z.string(), z.unknown()) }).optional(),
              }),
            ),
          })
          .optional(),
      }),
    )
    .optional(),
});
export class GeminiProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model: string,
    private fetcher: Fetcher = fetch,
  ) {
    if (!apiKey || !/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error("AI_NOT_CONFIGURED");
  }
  private body(request: AIRequest, json: boolean = false) {
    return JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: request.messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.text }],
      })),
      ...(request.tools?.length ? { tools: [{ functionDeclarations: request.tools }] } : {}),
      ...(json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
    });
  }
  private async generate(request: AIRequest, json: boolean = false) {
    const response = await providerFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: this.body(request, json),
        signal: request.signal,
      },
      this.fetcher,
    );
    return geminiResponseSchema.parse(await response.json());
  }
  async chat(request: AIRequest): Promise<string> {
    const data = await this.generate(request);
    const text = data.candidates?.[0]?.content?.parts.map((part) => part.text ?? "").join("") ?? "";
    if (!text) throw new Error("AI_EMPTY_COMPLETION");
    return text;
  }
  async structured(request: AIRequest): Promise<unknown> {
    const data = await this.generate(request, true);
    return JSON.parse(data.candidates?.[0]?.content?.parts.map((part) => part.text ?? "").join("") ?? "null");
  }
  async toolCall(request: AIRequest): Promise<AIChunk[]> {
    const data = await this.generate(request);
    return this.chunks(data);
  }
  private chunks(data: z.infer<typeof geminiResponseSchema>): AIChunk[] {
    return (data.candidates?.[0]?.content?.parts ?? []).flatMap<AIChunk>((part) =>
      part.functionCall
        ? [{ type: "tool" as const, name: part.functionCall.name, args: part.functionCall.args }]
        : part.text
          ? [{ type: "text" as const, text: part.text }]
          : [],
    );
  }
  async *stream(request: AIRequest): AsyncIterable<AIChunk> {
    const response = await providerFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: this.body(request),
        signal: request.signal,
      },
      this.fetcher,
    );
    if (!response.body) throw new Error("AI_EMPTY_STREAM");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trimEnd();
          buffer = buffer.slice(newline + 1);
          if (line.startsWith("data: ")) {
            for (const chunk of this.chunks(geminiResponseSchema.parse(JSON.parse(line.slice(6))))) yield chunk;
          }
          newline = buffer.indexOf("\n");
        }
        if (buffer.length > 1024 * 1024) throw new Error("AI_STREAM_TOO_LARGE");
        if (done) break;
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
  }
}
