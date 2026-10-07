import { expect, it, vi } from "vitest";
import { GeminiProvider } from "./index";

it("uses server-only API header and streams text plus structured calls", async () => {
  const chunks = [
    JSON.stringify({ candidates: [{ content: { parts: [{ text: "Hello " }] } }] }),
    JSON.stringify({
      candidates: [{ content: { parts: [{ functionCall: { name: "createTask", args: { title: "Review" } } }] } }],
    }),
  ];
  const fetcher = vi.fn().mockResolvedValue(
    new Response(`data: ${chunks[0]}\r\n\r\ndata: ${chunks[1]}\r\n\r\n`, {
      headers: { "Content-Type": "text/event-stream" },
    }),
  );
  const provider = new GeminiProvider("test-only-key", "configured-model", fetcher);
  const output = [];
  for await (const chunk of provider.stream({
    messages: [{ role: "user", text: "Review" }],
    system: "Only authorized tools",
  }))
    output.push(chunk);
  expect(output).toEqual([
    { type: "text", text: "Hello " },
    { type: "tool", name: "createTask", args: { title: "Review" } },
  ]);
  expect(fetcher.mock.calls[0][0]).not.toContain("test-only-key");
  expect(fetcher.mock.calls[0][1].headers["x-goog-api-key"]).toBe("test-only-key");
});
it("rejects blocked/empty provider completion", async () => {
  const provider = new GeminiProvider(
    "test-only-key",
    "configured-model",
    vi.fn().mockResolvedValue(Response.json({ candidates: [] })),
  );
  await expect(provider.chat({ messages: [{ role: "user", text: "hello" }], system: "policy" })).rejects.toThrow(
    "AI_EMPTY_COMPLETION",
  );
});
