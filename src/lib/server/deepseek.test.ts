import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupRequest } from "@/domain/llm/contract";
import { groupWithDeepSeek, type LlmClock } from "./deepseek";

const ENV = { apiKey: `sk-test-${crypto.randomUUID()}`, model: "deepseek-flash" };

const REQUEST: GroupRequest = {
  items: [
    { id: "i1", description: "MM LECHE ENT", supplier: "Tienda Uno" },
    { id: "i2", description: "LECHE ENTERA 1L", supplier: "Tienda Dos" },
    { id: "i3", description: "Azúcar", supplier: "Tienda Uno" },
  ],
  existing: [],
};

type FetchImpl = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
const fetchMock = vi.fn<FetchImpl>();

/** Manual time, recorded sleeps and attempt timeouts the test can fire by hand. */
class FakeClock implements LlmClock {
  time = 0;
  sleeps: number[] = [];
  timeouts: { ms: number; controller: AbortController }[] = [];

  now(): number {
    return this.time;
  }

  async sleep(ms: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw signal.reason;
    this.sleeps.push(ms);
    this.time += ms;
  }

  timeout(ms: number): AbortSignal {
    const controller = new AbortController();
    this.timeouts.push({ ms, controller });
    return controller.signal;
  }

  expire(index: number): void {
    this.timeouts[index]?.controller.abort(new DOMException("timed out", "TimeoutError"));
  }
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

function good(): Response {
  return completion({ g: [{ n: "Leche entera", i: ["i1", "i2"], e: null }, { n: "Azúcar", i: ["i3"], e: null }] });
}

function status(code: number, headers?: Record<string, string>): Response {
  return new Response(`{"echo":"${ENV.apiKey}"}`, { status: code, headers });
}

/** A fetch that never answers; it rejects when its signal aborts, after running onStart. */
function hangUntilAborted(onStart: () => void): FetchImpl {
  return (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) throw new Error("expected a signal");
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      onStart();
    });
}

let clock: FakeClock;
function spyInfo() {
  return vi.spyOn(console, "info").mockImplementation(() => undefined);
}
let info: ReturnType<typeof spyInfo>;

beforeEach(() => {
  clock = new FakeClock();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  info = spyInfo();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function run(signal: AbortSignal = new AbortController().signal) {
  return groupWithDeepSeek(REQUEST, ENV, signal, clock);
}

describe("one retry for a flaky answer (D-27, OQ4)", () => {
  it("answers ok with attempts 1 when the first answer is good", async () => {
    fetchMock.mockResolvedValueOnce(good());
    const result = await run();
    expect(result.ok).toBe(true);
    expect(result.meta.attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["empty content", () => completion("")],
    ["whitespace content", () => completion("   \n")],
    ["content that is not JSON", () => completion("no es json")],
    ["an answer of the wrong shape", () => completion({ groups: [] })],
    ["a response body that is not JSON", () => new Response("<html>", { status: 200 })],
    ["finish_reason length", () => completion({ g: [{ n: "Leche", i: ["i1", "i2", "i3"] }] }, "length")],
  ])("retries once after %s and takes the good second answer", async (_label, first) => {
    fetchMock.mockResolvedValueOnce(first()).mockResolvedValueOnce(good());
    const result = await run();
    expect(result.ok).toBe(true);
    expect(result.meta.attempts).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("answers invalid_response after two garbage answers and never makes a third call", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(completion("no es json")));
    const result = await run();
    expect(result).toMatchObject({ ok: false, error: "invalid_response", meta: { attempts: 2 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("answers invalid_response after finish_reason content_filter twice", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(completion({ g: [{ n: "Leche", i: ["i1", "i2", "i3"] }] }, "content_filter")),
    );
    const result = await run();
    expect(result).toMatchObject({ ok: false, error: "invalid_response", meta: { attempts: 2 } });
    expect(result.meta.finishReason).toBe("content_filter");
  });

  it("answers incomplete_response when an id is missing twice", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(completion({ g: [{ n: "Leche", i: ["i1", "i2"], e: null }] })),
    );
    const result = await run();
    expect(result).toMatchObject({ ok: false, error: "incomplete_response", meta: { attempts: 2 } });
  });

  it("retries an answer that repeats or invents an id", async () => {
    fetchMock
      .mockResolvedValueOnce(completion({ g: [{ n: "Leche", i: ["i1", "i2", "i3", "i99"], e: null }] }))
      .mockResolvedValueOnce(
        completion({ g: [{ n: "A", i: ["i1", "i2"], e: null }, { n: "B", i: ["i2", "i3"], e: null }] }),
      );
    const result = await run();
    expect(result).toMatchObject({ ok: false, error: "incomplete_response", meta: { attempts: 2 } });
  });

  it("reports tokens and finish_reason of the last attempt", async () => {
    fetchMock.mockResolvedValueOnce(completion("")).mockResolvedValueOnce(good());
    const result = await run();
    expect(result.meta).toMatchObject({
      attempts: 2,
      finishReason: "stop",
      promptTokens: 120,
      completionTokens: 40,
      reasoningTokens: 0,
    });
  });
});

describe("refusals a retry cannot fix are not retried (D-27)", () => {
  it.each([
    [401, "upstream_auth"],
    [402, "upstream_balance"],
    [400, "upstream_rejected"],
    [422, "upstream_rejected"],
  ])("maps a DeepSeek %i to %s after exactly one attempt", async (code, error) => {
    fetchMock.mockResolvedValue(status(code));
    const result = await run();
    expect(result).toMatchObject({ ok: false, error, meta: { attempts: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(clock.sleeps).toEqual([]);
  });
});

describe("429 waits before the single retry", () => {
  it("sleeps the Retry-After seconds, then takes the good second answer", async () => {
    fetchMock.mockResolvedValueOnce(status(429, { "retry-after": "1" })).mockResolvedValueOnce(good());
    const result = await run();
    expect(result.ok).toBe(true);
    expect(result.meta.attempts).toBe(2);
    expect(clock.sleeps).toEqual([1000]);
  });

  it("sleeps 1 to 2 seconds with jitter when there is no Retry-After", async () => {
    fetchMock.mockResolvedValueOnce(status(429)).mockResolvedValueOnce(good());
    await run();
    expect(clock.sleeps).toHaveLength(1);
    expect(clock.sleeps[0]).toBeGreaterThanOrEqual(1000);
    expect(clock.sleeps[0]).toBeLessThanOrEqual(2000);
  });

  it("ignores a Retry-After that is not a number", async () => {
    fetchMock
      .mockResolvedValueOnce(status(429, { "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" }))
      .mockResolvedValueOnce(good());
    await run();
    expect(clock.sleeps[0]).toBeGreaterThanOrEqual(1000);
    expect(clock.sleeps[0]).toBeLessThanOrEqual(2000);
  });

  it("does not wait a Retry-After that would leave less than the minimum retry budget", async () => {
    fetchMock.mockResolvedValueOnce(status(429, { "retry-after": "160" })).mockResolvedValueOnce(good());
    const result = await run();
    expect(result.ok).toBe(true);
    expect(clock.sleeps[0]).toBeLessThanOrEqual(2000);
  });

  it("answers upstream_rate_limited after two 429", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(status(429, { "retry-after": "1" })));
    const result = await run();
    expect(result).toMatchObject({ ok: false, error: "upstream_rate_limited", meta: { attempts: 2 } });
    expect(clock.sleeps).toEqual([1000]);
  });
});

describe("5xx and network failures are retried once", () => {
  it.each([500, 502, 503, 504])("retries a DeepSeek %i and takes the good second answer", async (code) => {
    fetchMock.mockResolvedValueOnce(status(code)).mockResolvedValueOnce(good());
    const result = await run();
    expect(result.ok).toBe(true);
    expect(result.meta.attempts).toBe(2);
    expect(clock.sleeps).toEqual([]);
  });

  it("answers upstream_unavailable after two 503", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(status(503)));
    const result = await run();
    expect(result).toMatchObject({ ok: false, error: "upstream_unavailable", meta: { attempts: 2 } });
  });

  it("answers upstream_unavailable after a network error twice", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("fetch failed")));
    const result = await run();
    expect(result).toMatchObject({ ok: false, error: "upstream_unavailable", meta: { attempts: 2 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("the 110-second deadline (OQ3)", () => {
  it("gives the first attempt 50 seconds and the retry no more than the remaining time minus 5 seconds", async () => {
    fetchMock
      .mockImplementationOnce(() => {
        clock.time = 60_000;
        return Promise.resolve(status(503));
      })
      .mockResolvedValueOnce(good());
    const result = await run();
    expect(result.ok).toBe(true);
    expect(clock.timeouts.map((entry) => entry.ms)).toEqual([50_000, 45_000]);
  });

  it("does not retry after an attempt timeout when less than 20 seconds are left", async () => {
    fetchMock.mockImplementationOnce(
      hangUntilAborted(() => {
        clock.time = 100_000;
        clock.expire(0);
      }),
    );
    const result = await run();
    expect(result).toMatchObject({ ok: false, error: "upstream_timeout", meta: { attempts: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries an attempt timeout while enough time is left", async () => {
    fetchMock
      .mockImplementationOnce(
        hangUntilAborted(() => {
          clock.time = 50_000;
          clock.expire(0);
        }),
      )
      .mockResolvedValueOnce(good());
    const result = await run();
    expect(result.ok).toBe(true);
    expect(result.meta.attempts).toBe(2);
    expect(clock.timeouts.map((entry) => entry.ms)).toEqual([50_000, 50_000]);
  });

  it("answers upstream_timeout after two attempt timeouts", async () => {
    fetchMock
      .mockImplementationOnce(
        hangUntilAborted(() => {
          clock.time = 50_000;
          clock.expire(0);
        }),
      )
      .mockImplementationOnce(
        hangUntilAborted(() => {
          clock.time = 100_000;
          clock.expire(1);
        }),
      );
    const result = await run();
    expect(result).toMatchObject({ ok: false, error: "upstream_timeout", meta: { attempts: 2 } });
  });

  it("does not start a retry when the first failure leaves less than 20 seconds", async () => {
    fetchMock.mockImplementation(() => {
      clock.time = 95_000;
      return Promise.resolve(status(503));
    });
    const result = await run();
    expect(result).toMatchObject({ ok: false, error: "upstream_unavailable", meta: { attempts: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("the caller's signal (browser aborted)", () => {
  it("stops at once with upstream_timeout, never retries, and the abort reaches fetch", async () => {
    const caller = new AbortController();
    let seen: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((url, init) => {
      seen = init?.signal ?? undefined;
      return hangUntilAborted(() => caller.abort())(url, init);
    });
    const result = await run(caller.signal);
    expect(result).toMatchObject({ ok: false, error: "upstream_timeout", meta: { attempts: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(seen?.aborted).toBe(true);
  });

  it("does not retry a retryable failure once the caller has aborted", async () => {
    const caller = new AbortController();
    fetchMock.mockImplementation(() => {
      caller.abort();
      return Promise.resolve(status(429));
    });
    const result = await run(caller.signal);
    expect(result).toMatchObject({ ok: false, meta: { attempts: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("same-name groups of one answer are merged (A-5)", () => {
  it("returns one group with both id lists when two names differ only in case and edge spaces", async () => {
    fetchMock.mockResolvedValueOnce(
      completion({
        g: [
          { n: "Leche entera", i: ["i1"], e: null },
          { n: " leche ENTERA", i: ["i2"], e: null },
          { n: "Azúcar", i: ["i3"], e: null },
        ],
      }),
    );
    const result = await run();
    expect(result).toMatchObject({
      ok: true,
      data: [
        { name: "Leche entera", ids: ["i1", "i2"], existing: null },
        { name: "Azúcar", ids: ["i3"], existing: null },
      ],
    });
  });
});

describe("one content-free log line per call (Pitfall 1, T-04-12)", () => {
  it("logs exactly one [llm] line with codes and counts only", async () => {
    fetchMock.mockResolvedValueOnce(completion("")).mockResolvedValueOnce(good());
    await run();
    expect(info).toHaveBeenCalledTimes(1);
    const line = String(info.mock.calls[0]?.join(" "));
    expect(line.startsWith("[llm] ")).toBe(true);
    const parsed: unknown = JSON.parse(line.slice("[llm] ".length));
    expect(parsed).toMatchObject({
      route: "group",
      outcome: "ok",
      attempts: 2,
      finishReason: "stop",
      promptTokens: 120,
      completionTokens: 40,
      reasoningTokens: 0,
    });
    expect(parsed).toHaveProperty("durationMs");
    expect(Object.keys(parsed as Record<string, unknown>).sort()).toEqual(
      [
        "attempts",
        "completionTokens",
        "durationMs",
        "finishReason",
        "outcome",
        "promptTokens",
        "reasoningTokens",
        "route",
      ].sort(),
    );
  });

  it("logs the error code as the outcome and never the key, a description or a supplier", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(status(401)));
    const log = vi.spyOn(console, "log");
    const warn = vi.spyOn(console, "warn");
    const error = vi.spyOn(console, "error");
    await run();
    expect(info).toHaveBeenCalledTimes(1);
    const line = String(info.mock.calls[0]?.join(" "));
    expect(line).toContain("upstream_auth");
    expect(line).not.toContain(ENV.apiKey);
    for (const item of REQUEST.items) {
      expect(line).not.toContain(item.description);
      expect(line).not.toContain(item.supplier);
    }
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
