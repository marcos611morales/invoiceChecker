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
  suppliers: [
    { id: "s1", name: "Tienda Uno" },
    { id: "s2", name: "Tienda Dos" },
  ],
  products: [{ id: "q1", name: "Leche entera", members: ["MM LECHE ENT", "LECHE ENTERA 1L"] }],
  categories: [
    { id: "c1", name: "Abarrotes" },
    { id: "c2", name: "Limpieza" },
  ],
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
        prompt_tokens: 90,
        completion_tokens: 30,
        completion_tokens_details: { reasoning_tokens: 0 },
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

/** A good answer: codes for two ids and a new name for the third. */
function goodAnswer(): Response {
  return completion({
    a: [
      { i: "s1", c: "c1", n: null },
      { i: "s2", c: "c2", n: null },
      { i: "q1", c: null, n: "Bebidas" },
    ],
  });
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
  return new NextRequest("http://localhost/api/llm/categorize", {
    method: "POST",
    headers,
    body,
  });
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

const answersSchema = z.object({
  answers: z.array(
    z.object({
      id: z.string(),
      choice: z.union([
        z.object({ kind: z.literal("code"), code: z.string() }),
        z.object({ kind: z.literal("new"), name: z.string() }),
      ]),
    }),
  ),
});

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

describe("POST /api/llm/categorize: the session is checked inside the handler (ACC-03, T-04-36)", () => {
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

  it("checks the session before anything else, even for a body that is not JSON", async () => {
    const result = await answer(
      await POST(request("not json", { cookie: null, contentType: "text/plain" })),
    );
    expect(result.status).toBe(401);
  });
});

describe("POST /api/llm/categorize: the request checks (LLM-03, T-04-37)", () => {
  it("answers 400 bad_request to text/plain", async () => {
    const result = await answer(
      await POST(request(JSON.stringify(BODY), { contentType: "text/plain" })),
    );
    expect(result.status).toBe(400);
    expect(result.json).toEqual({ error: "bad_request", retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 400 bad_request to a content type that only contains application/json", async () => {
    const result = await answer(
      await POST(request(JSON.stringify(BODY), { contentType: "text/plain; application/json" })),
    );
    expect(result.status).toBe(400);
    expect(result.json).toEqual({ error: "bad_request", retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts application/json with a charset parameter, in any case", async () => {
    fetchMock.mockResolvedValueOnce(goodAnswer());
    const result = await answer(
      await POST(request(JSON.stringify(BODY), { contentType: "Application/JSON; charset=utf-8" })),
    );
    expect(result.status).toBe(200);
  });

  it("answers 400 bad_request to invalid JSON", async () => {
    const result = await answer(await POST(request("{ not json")));
    expect(result.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 400 bad_request to an rfc on a supplier, a field on a product or at the top level", async () => {
    const supplier = await answer(
      await POST(
        request(
          JSON.stringify({
            ...BODY,
            suppliers: [{ id: "s1", name: "Tienda Uno", rfc: "AAA010101AAA" }],
          }),
        ),
      ),
    );
    expect(supplier.status).toBe(400);
    const product = await answer(
      await POST(
        request(
          JSON.stringify({
            ...BODY,
            products: [{ id: "q1", name: "Leche", members: ["LECHE"], total: "10.00" }],
          }),
        ),
      ),
    );
    expect(product.status).toBe(400);
    const top = await answer(await POST(request(JSON.stringify({ ...BODY, uuid: "x" }))));
    expect(top.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 400 bad_request to an empty body of entries and to more than 150 entries", async () => {
    const none = await answer(
      await POST(request(JSON.stringify({ suppliers: [], products: [], categories: [] }))),
    );
    expect(none.status).toBe(400);
    const suppliers = Array.from({ length: 151 }, (_unused, index) => ({
      id: `s${String(index + 1)}`,
      name: `Proveedor ${String(index + 1)}`,
    }));
    const many = await answer(
      await POST(request(JSON.stringify({ suppliers, products: [], categories: [] }))),
    );
    expect(many.status).toBe(400);
    const exact = suppliers.slice(0, 150);
    fetchMock.mockResolvedValueOnce(
      completion({ a: exact.map((supplier) => ({ i: supplier.id, c: null, n: "Servicios" })) }),
    );
    const ok = await answer(
      await POST(request(JSON.stringify({ suppliers: exact, products: [], categories: [] }))),
    );
    expect(ok.status).toBe(200);
  });

  it("answers 413 payload_too_large above 262144 bytes and from the declared length", async () => {
    const big = await answer(await POST(request(JSON.stringify({ pad: "x".repeat(300000) }))));
    expect(big.status).toBe(413);
    expect(big.json).toEqual({ error: "payload_too_large", retryable: false });
    const declared = await answer(
      await POST(request(JSON.stringify(BODY), { contentLength: "300000" })),
    );
    expect(declared.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 500 server_not_configured without DEEPSEEK_API_KEY and never calls DeepSeek", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", undefined);
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(500);
    expect(result.json).toEqual({ error: "server_not_configured", retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/llm/categorize: the DeepSeek call and our own answer (D-17, D-27)", () => {
  it("maps a valid answer to our codes, in the order the ids were sent, with the meta", async () => {
    fetchMock.mockResolvedValueOnce(goodAnswer());
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({
      answers: [
        { id: "s1", choice: { kind: "code", code: "c1" } },
        { id: "s2", choice: { kind: "code", code: "c2" } },
        { id: "q1", choice: { kind: "new", name: "Bebidas" } },
      ],
      meta: { attempts: 1, finishReason: "stop", promptTokens: 90, completionTokens: 30 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("calls DeepSeek once with max_tokens 4096, thinking disabled and the key in the header only", async () => {
    fetchMock.mockResolvedValueOnce(goodAnswer());
    await POST(request(JSON.stringify(BODY)));
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe(DEEPSEEK_URL);
    expect(call?.[1]?.method).toBe("POST");
    expect(new Headers(call?.[1]?.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    expect(upstreamBody()).toMatchObject({
      model: "deepseek-flash",
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 4096,
      stream: false,
    });
    expect(JSON.stringify(upstreamBody())).not.toContain(KEY);
  });

  it("sends the instructions in the system message and only the sent names in the user message", async () => {
    fetchMock.mockResolvedValueOnce(goodAnswer());
    await POST(request(JSON.stringify(BODY)));
    const messages = z
      .array(z.object({ role: z.string(), content: z.string() }))
      .parse(upstreamBody().messages);
    expect(messages.map((message) => message.role)).toEqual(["system", "user"]);
    expect(messages[0]?.content).toContain("json");
    expect(messages[0]?.content).toContain('{"a":[{"i":"s1","c":"c3","n":null}');
    expect(JSON.parse(messages[1]?.content ?? "null")).toEqual(BODY);
  });

  it("turns a new name equal to a sent category, ignoring case and edge spaces, into its code", async () => {
    fetchMock.mockResolvedValueOnce(
      completion({
        a: [
          { i: "s1", c: null, n: "  ABARROTES " },
          { i: "s2", c: null, n: "limpieza" },
          { i: "q1", c: null, n: "Bebidas" },
        ],
      }),
    );
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(200);
    expect(answersSchema.parse(result.json).answers).toEqual([
      { id: "s1", choice: { kind: "code", code: "c1" } },
      { id: "s2", choice: { kind: "code", code: "c2" } },
      { id: "q1", choice: { kind: "new", name: "Bebidas" } },
    ]);
  });

  it("normalizes a proposed new name: control characters out, runs of spaces collapsed, cut to 60", async () => {
    fetchMock.mockResolvedValueOnce(
      completion({
        a: [
          { i: "s1", c: null, n: "  Bebidas\u0000   frías\u0007 " },
          { i: "s2", c: null, n: "x".repeat(80) },
          { i: "q1", c: "c1", n: null },
        ],
      }),
    );
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(200);
    const [first, second] = answersSchema.parse(result.json).answers;
    expect(first?.choice).toEqual({ kind: "new", name: "Bebidas frías" });
    expect(second?.choice.kind === "new" ? second.choice.name : "").toHaveLength(60);
  });

  it("answers 502 incomplete_response, retryable, after a retry, when the answer leaves out an id", async () => {
    always(() =>
      completion({
        a: [
          { i: "s1", c: "c1", n: null },
          { i: "q1", c: "c2", n: null },
        ],
      }),
    );
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(502);
    expect(result.json).toEqual({ error: "incomplete_response", retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("recovers when the second attempt is complete", async () => {
    fetchMock.mockResolvedValueOnce(completion({ a: [{ i: "s1", c: "c1", n: null }] }));
    fetchMock.mockResolvedValueOnce(goodAnswer());
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ meta: { attempts: 2 } });
  });

  it("answers 502 incomplete_response when the answer repeats or invents an id", async () => {
    always(() =>
      completion({
        a: [
          { i: "s1", c: "c1", n: null },
          { i: "s1", c: "c2", n: null },
          { i: "s2", c: "c1", n: null },
          { i: "q1", c: "c1", n: null },
        ],
      }),
    );
    const repeated = await answer(await POST(request(JSON.stringify(BODY))));
    expect(repeated.json).toEqual({ error: "incomplete_response", retryable: true });
    always(() =>
      completion({
        a: [
          { i: "s1", c: "c1", n: null },
          { i: "s2", c: "c1", n: null },
          { i: "q1", c: "c1", n: null },
          { i: "s9", c: "c1", n: null },
        ],
      }),
    );
    const invented = await answer(await POST(request(JSON.stringify(BODY))));
    expect(invented.json).toEqual({ error: "incomplete_response", retryable: true });
  });

  it("treats a code that was not sent as a failed attempt: 502 invalid_response after a retry", async () => {
    always(() =>
      completion({
        a: [
          { i: "s1", c: "c1", n: null },
          { i: "s2", c: "c9", n: null },
          { i: "q1", c: "c2", n: null },
        ],
      }),
    );
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(502);
    expect(result.json).toEqual({ error: "invalid_response", retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats an answer with neither a code nor a usable new name as a failed attempt", async () => {
    always(() =>
      completion({
        a: [
          { i: "s1", c: null, n: "   " },
          { i: "s2", c: "c1", n: null },
          { i: "q1", c: "c2", n: null },
        ],
      }),
    );
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(502);
    expect(result.json).toEqual({ error: "invalid_response", retryable: true });
  });

  it("lets every answer be a new name when the user has no category", async () => {
    fetchMock.mockResolvedValueOnce(
      completion({
        a: [
          { i: "s1", c: null, n: "Servicios" },
          { i: "s2", c: null, n: "Servicios" },
          { i: "q1", c: null, n: "Bebidas" },
        ],
      }),
    );
    const result = await answer(
      await POST(request(JSON.stringify({ ...BODY, categories: [] }))),
    );
    expect(result.status).toBe(200);
    expect(answersSchema.parse(result.json).answers.map((entry) => entry.choice.kind)).toEqual([
      "new",
      "new",
      "new",
    ]);
  });

  it.each([
    ["empty content", () => completion("")],
    ["content that is not JSON", () => completion("no es json")],
    ["a model answer of the wrong shape", () => completion({ g: [] })],
    ["a cut-off answer", () => completion({ a: [{ i: "s1", c: "c1" }] }, "length")],
  ])("answers 502 invalid_response, retryable, to %s", async (_label, response) => {
    always(response);
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(502);
    expect(result.json).toEqual({ error: "invalid_response", retryable: true });
  });

  it.each([
    [401, "upstream_auth", 502, false],
    [402, "upstream_balance", 502, false],
    [429, "upstream_rate_limited", 503, true],
    [422, "upstream_rejected", 502, false],
    [500, "upstream_unavailable", 502, true],
  ])("maps a DeepSeek %i to our own %s (%i)", async (upstreamStatus, code, status, retryable) => {
    always(
      () =>
        new Response(`{"echo":"Bearer ${KEY}"}`, {
          status: upstreamStatus,
          headers: { "retry-after": "0" },
        }),
    );
    const result = await answer(await POST(request(JSON.stringify(BODY))));
    expect(result.status).toBe(status);
    expect(result.json).toEqual({ error: code, retryable });
    expect(result.text).not.toContain(KEY);
  });
});

describe("POST /api/llm/categorize: nothing of the key or of the names leaves (ACC-04, T-04-39)", () => {
  let spies: ReturnType<typeof spyOnConsole>;

  function spyOnConsole() {
    return {
      info: vi.spyOn(console, "info").mockImplementation(() => undefined),
      log: vi.spyOn(console, "log").mockImplementation(() => undefined),
      warn: vi.spyOn(console, "warn").mockImplementation(() => undefined),
      error: vi.spyOn(console, "error").mockImplementation(() => undefined),
    };
  }

  function consoleText(): string {
    return Object.values(spies)
      .flatMap((spy) => spy.mock.calls)
      .map((call) => JSON.stringify(call))
      .join("\n");
  }

  beforeEach(() => {
    spies = spyOnConsole();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("never puts the key in a response body, and logs one line with codes and counts only", async () => {
    fetchMock.mockResolvedValueOnce(goodAnswer());
    const ok = await answer(await POST(request(JSON.stringify(BODY))));
    expect(ok.text).not.toContain(KEY);
    expect(spies.info).toHaveBeenCalledTimes(1);
    const line = String(spies.info.mock.calls[0]?.[0]);
    expect(line).toContain('"route":"categorize"');
    expect(line).toContain('"outcome":"ok"');
    const logged = consoleText();
    expect(logged).not.toContain(KEY);
    for (const supplier of BODY.suppliers) expect(logged).not.toContain(supplier.name);
    for (const category of BODY.categories) expect(logged).not.toContain(category.name);
    for (const member of BODY.products.flatMap((product) => product.members)) {
      expect(logged).not.toContain(member);
    }
    expect(spies.log).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
    expect(spies.error).not.toHaveBeenCalled();
  });

  it("an upstream failure that echoes the key leaks neither the key nor the upstream text", async () => {
    always(
      () =>
        new Response(JSON.stringify({ error: { message: `UPSTREAM-MARKER Bearer ${KEY}` } }), {
          status: 401,
          headers: { "x-echo": `Bearer ${KEY}` },
        }),
    );
    const response = await POST(request(JSON.stringify(BODY)));
    const result = await answer(response.clone());
    expect(result.json).toEqual({ error: "upstream_auth", retryable: false });
    for (const needle of [KEY, "UPSTREAM-MARKER", "Bearer"]) {
      expect(result.text).not.toContain(needle);
      for (const value of response.headers.values()) expect(value).not.toContain(needle);
      expect(consoleText()).not.toContain(needle);
    }
  });

  it("a tampered cookie never reaches fetch and logs nothing", async () => {
    const tampered = `${token.slice(0, -3)}${token.endsWith("AAA") ? "BBB" : "AAA"}`;
    const result = await answer(await POST(request(JSON.stringify(BODY), { cookie: tampered })));
    expect(result.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(spies.info).not.toHaveBeenCalled();
  });
});
