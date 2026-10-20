import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { POST } from "./route";
import { createSessionToken } from "@/lib/server/session";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const PASSWORD = "correct horse battery staple";
const SECRET = "s".repeat(48);
const KEY = `sk-test-${crypto.randomUUID()}`;

const BODY = {
  items: [
    { id: "i1", description: "MM LECHE ENT", supplier: "Tienda Uno" },
    { id: "i2", description: "LECHE ENTERA 1L", supplier: "Tienda Dos" },
    { id: "i3", description: "Azúcar", supplier: "Tienda Uno" },
  ],
  existing: [],
};

const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();

let token = "";

/** The same kind of answer for every attempt; a Response body can only be read once, hence a factory. */
function always(make: () => Response): void {
  fetchMock.mockImplementation(() => Promise.resolve(make()));
}

function completion(content: unknown, finishReason = "stop"): Response {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: finishReason,
          message: { content: typeof content === "string" ? content : JSON.stringify(content) },
        },
      ],
      usage: {
        prompt_tokens: 120,
        completion_tokens: 40,
        completion_tokens_details: { reasoning_tokens: 0 },
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

/** Every id once, in one group, under the given name. */
function oneGroup(name: string): Response {
  return completion({ g: [{ n: name, i: ["i1", "i2", "i3"], e: null }] });
}

interface RequestOptions {
  cookie?: string | null;
  contentType?: string | null;
  contentLength?: string;
}

function request(body: string, options: RequestOptions = {}): NextRequest {
  const headers = new Headers();
  const contentType = options.contentType === undefined ? "application/json" : options.contentType;
  if (contentType !== null) headers.set("content-type", contentType);
  const cookie = options.cookie === undefined ? token : options.cookie;
  if (cookie !== null) headers.set("cookie", `session=${cookie}`);
  if (options.contentLength !== undefined) headers.set("content-length", options.contentLength);
  return new NextRequest("http://localhost/api/llm/group", { method: "POST", headers, body });
}

async function answer(response: Response): Promise<{ status: number; json: unknown; text: string }> {
  const text = await response.text();
  return { status: response.status, json: JSON.parse(text) as unknown, text };
}

function upstreamBody(): Record<string, unknown> {
  const call = fetchMock.mock.calls[0];
  const init = call?.[1];
  if (typeof init?.body !== "string") throw new Error("expected a string upstream body");
  return z.record(z.string(), z.unknown()).parse(JSON.parse(init.body));
}

beforeEach(async () => {
  vi.stubEnv("APP_PASSWORD", PASSWORD);
  vi.stubEnv("SESSION_SECRET", SECRET);
  vi.stubEnv("DEEPSEEK_API_KEY", KEY);
  vi.stubEnv("DEEPSEEK_MODEL", undefined);
  token = await createSessionToken({ APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/llm/group: the session is checked inside the handler (ACC-03)", () => {
  it("answers the proxy's exact 401 without a cookie and never calls DeepSeek", async () => {
    const result = await answer(await POST(request(JSON.stringify(BODY), { cookie: null })));
    expect(result.status).toBe(401);
    expect(result.json).toEqual({ error: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 401 to a tampered cookie and never calls DeepSeek", async () => {
    const tampered = `${token.slice(0, -3)}${token.endsWith("AAA") ? "BBB" : "AAA"}`;
    const result = await answer(await POST(request(JSON.stringify(BODY), { cookie: tampered })));
    expect(result.status).toBe(401);
    expect(result.json).toEqual({ error: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 401 to a token signed with another secret", async () => {
    const foreign = await createSessionToken({ APP_PASSWORD: PASSWORD, SESSION_SECRET: "t".repeat(48) });
    const result = await answer(await POST(request(JSON.stringify(BODY), { cookie: foreign })));
    expect(result.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks the session before anything else, even for a body that is not JSON", async () => {
    const result = await answer(await POST(request("not json", { cookie: null, contentType: "text/plain" })));
    expect(result.status).toBe(401);
  });
});

describe("POST /api/llm/group: the request checks (LLM-03, D-05)", () => {
  it("answers 400 bad_request to text/plain", async () => {
    const result = await answer(
      await POST(request(JSON.stringify(BODY), { contentType: "text/plain" })),
    );
    expect(result.status).toBe(400);
    expect(result.json).toEqual({ error: "bad_request", retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 400 bad_request without a content type", async () => {
    const result = await answer(await POST(request(JSON.stringify(BODY), { contentType: null })));
    expect(result.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 400 bad_request to invalid JSON", async () => {
    const result = await answer(await POST(request("{ not json")));
    expect(result.status).toBe(400);
    expect(result.json).toEqual({ error: "bad_request", retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 400 bad_request to an extra field, at the top level or on an item", async () => {
    const top = await answer(await POST(request(JSON.stringify({ ...BODY, uuid: "x" }))));
    expect(top.status).toBe(400);
    const item = await answer(
      await POST(
        request(
          JSON.stringify({
            ...BODY,
            items: [{ id: "i1", description: "MM LECHE ENT", supplier: "Tienda Uno", rfc: "AAA010101AAA" }],
          }),
        ),
      ),
    );
    expect(item.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 400 bad_request to a missing existing", async () => {
    const result = await answer(await POST(request(JSON.stringify({ items: BODY.items }))));
    expect(result.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 413 payload_too_large above 262144 bytes", async () => {
    const result = await answer(
      await POST(request(JSON.stringify({ pad: "x".repeat(300000) }))),
    );
    expect(result.status).toBe(413);
    expect(result.json).toEqual({ error: "payload_too_large", retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 413 from the declared content length before reading the body", async () => {
    const result = await answer(
      await POST(request(JSON.stringify(BODY), { contentLength: "300000" })),
    );
    expect(result.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 500 server_not_configured without DEEPSEEK_API_KEY and never calls DeepSeek", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", undefined);
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(500);
    expect(result.json).toEqual({ error: "server_not_configured", retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 500 server_not_configured when DEEPSEEK_API_KEY is empty", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/llm/group: the DeepSeek call (ACC-04, D-29)", () => {
  it("calls DeepSeek once with the documented request and answers 200 with the groups", async () => {
    fetchMock.mockResolvedValueOnce(oneGroup("Leche entera"));
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({
      groups: [{ name: "Leche entera", ids: ["i1", "i2", "i3"], existing: null }],
      meta: { attempts: 1, finishReason: "stop", promptTokens: 120, completionTokens: 40 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe(DEEPSEEK_URL);
    expect(call?.[1]?.method).toBe("POST");
    expect(new Headers(call?.[1]?.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    expect(upstreamBody()).toMatchObject({
      model: "deepseek-flash",
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 8192,
      stream: false,
    });
  });

  it("uses DEEPSEEK_MODEL when it is set", async () => {
    vi.stubEnv("DEEPSEEK_MODEL", "deepseek-other");
    fetchMock.mockResolvedValueOnce(oneGroup("Leche entera"));
    await POST(request(JSON.stringify(BODY)));
    expect(upstreamBody()).toMatchObject({ model: "deepseek-other" });
  });

  it("sends the instructions in the system message and only the data in the user message", async () => {
    fetchMock.mockResolvedValueOnce(oneGroup("Leche entera"));
    await POST(request(JSON.stringify(BODY)));
    const messages = z
      .array(z.object({ role: z.string(), content: z.string() }))
      .parse(upstreamBody().messages);
    expect(messages.map((message) => message.role)).toEqual(["system", "user"]);
    expect(messages[0]?.content).toContain("json");
    const user = z
      .object({
        suppliers: z.array(z.string()),
        items: z.array(z.object({ id: z.string(), description: z.string(), supplier: z.number() })),
        existing: z.array(z.unknown()),
      })
      .parse(JSON.parse(messages[1]?.content ?? "null"));
    expect(user.suppliers).toEqual(["Tienda Uno", "Tienda Dos"]);
    expect(user.items.map((item) => item.supplier)).toEqual([0, 1, 0]);
  });

  it("normalizes the names: control characters and runs of spaces out, trimmed, cut to 60", async () => {
    fetchMock.mockResolvedValueOnce(
      completion({
        g: [
          { n: "  Leche\u0000   entera\u0007 ", i: ["i1"], e: null },
          { n: "x".repeat(80), i: ["i2"], e: null },
          { n: "Azúcar", i: ["i3"], e: null },
        ],
      }),
    );
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(200);
    const names = z
      .object({ groups: z.array(z.object({ name: z.string() })) })
      .parse(result.json)
      .groups.map((group) => group.name);
    expect(names[0]).toBe("Leche entera");
    expect(names[1]).toHaveLength(60);
    expect(names[1]?.endsWith("…")).toBe(true);
    expect(names[2]).toBe("Azúcar");
  });

  it("names a group whose name is empty after cleaning with the first description of the group", async () => {
    fetchMock.mockResolvedValueOnce(
      completion({
        g: [
          { n: "   ", i: ["i2", "i1"], e: null },
          { n: "\u0000\u0007", i: ["i3"], e: null },
        ],
      }),
    );
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(200);
    const names = z
      .object({ groups: z.array(z.object({ name: z.string() })) })
      .parse(result.json)
      .groups.map((group) => group.name);
    expect(names).toEqual(["LECHE ENTERA 1L", "Azúcar"]);
  });

  it("keeps «e» only when it names a context product that was sent", async () => {
    const body = { ...BODY, existing: [{ id: "p1", name: "Leche entera" }] };
    fetchMock.mockResolvedValueOnce(
      completion({
        g: [
          { n: "Leche", i: ["i1", "i2"], e: "p1" },
          { n: "Azúcar", i: ["i3"], e: "p9" },
        ],
      }),
    );
    const result = await answer(await POST(request(JSON.stringify(body))));
    expect(
      z
        .object({ groups: z.array(z.object({ existing: z.string().nullable() })) })
        .parse(result.json)
        .groups.map((group) => group.existing),
    ).toEqual(["p1", null]);
  });

  it("answers 502 incomplete_response, retryable, when the answer leaves out an id", async () => {
    always(() => completion({ g: [{ n: "Leche", i: ["i1", "i2"], e: null }] }));
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(502);
    expect(result.json).toEqual({ error: "incomplete_response", retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("answers 502 incomplete_response when the answer repeats an id", async () => {
    always(() =>
      completion({
        g: [
          { n: "Leche", i: ["i1", "i2"], e: null },
          { n: "Otra", i: ["i2", "i3"], e: null },
        ],
      }),
    );
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(502);
    expect(result.json).toEqual({ error: "incomplete_response", retryable: true });
  });

  it("answers 502 incomplete_response when the answer invents an id", async () => {
    always(() => completion({ g: [{ n: "Leche", i: ["i1", "i2", "i3", "i99"], e: null }] }));
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(502);
    expect(result.json).toEqual({ error: "incomplete_response", retryable: true });
  });

  it("answers 502 upstream_auth, not retryable, to a DeepSeek 401 and never echoes the key", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: `bad key ${KEY}` } }), { status: 401 }),
    );
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(502);
    expect(result.json).toEqual({ error: "upstream_auth", retryable: false });
    expect(result.text).not.toContain(KEY);
  });

  it.each([
    [402, "upstream_balance", 502, false],
    [429, "upstream_rate_limited", 503, true],
    [400, "upstream_rejected", 502, false],
    [422, "upstream_rejected", 502, false],
    [500, "upstream_unavailable", 502, true],
    [503, "upstream_unavailable", 502, true],
  ])("maps a DeepSeek %i to our own %s (%i)", async (upstreamStatus, code, status, retryable) => {
    always(() => new Response(`{"echo":"${KEY}"}`, { status: upstreamStatus, headers: { "retry-after": "0" } }));
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(status);
    expect(result.json).toEqual({ error: code, retryable });
    expect(result.text).not.toContain(KEY);
  });

  it("answers 502 upstream_unavailable when the connection fails", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("fetch failed")));
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(502);
    expect(result.json).toEqual({ error: "upstream_unavailable", retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["empty content", () => completion("")],
    ["whitespace content", () => completion("   ")],
    ["content that is not JSON", () => completion("no es json")],
    ["a model answer of the wrong shape", () => completion({ groups: [] })],
    ["a cut-off answer", () => completion({ g: [{ n: "Leche", i: ["i1", "i2", "i3"] }] }, "length")],
  ])("answers 502 invalid_response, retryable, to %s", async (_label, response) => {
    always(response);
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(502);
    expect(result.json).toEqual({ error: "invalid_response", retryable: true });
  });

  it("never puts the key in any response body", async () => {
    fetchMock.mockResolvedValueOnce(oneGroup("Leche entera"));
    const ok = await answer(await POST(request(JSON.stringify(BODY))));
    expect(ok.text).not.toContain(KEY);
  });
});
