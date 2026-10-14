// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFixture, withUuid } from "../../../tests/support/cfdiVariants";
import { CHUNK_SIZE, ingest, toFileRef } from "./ingest";

function uuid(n: number): string {
  return `AAAAAAAA-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function xmlFile(n: number): File {
  const xml = withUuid(readFixture("ingreso-bom-decl.xml"), uuid(n));
  return new File([xml], `f${n}.xml`);
}

function thirtyXmlFiles(): File[] {
  return Array.from({ length: 30 }, (_, i) => xmlFile(i + 1));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CHUNK_SIZE", () => {
  it("parses 25 files per chunk", () => {
    expect(CHUNK_SIZE).toBe(25);
  });
});

describe("toFileRef", () => {
  it("prefers the dropzone path, then webkitRelativePath, then the name", () => {
    const withPath = new File(["x"], "a.xml");
    Object.defineProperty(withPath, "path", { value: "/2025/a.xml" });
    expect(toFileRef(withPath)).toEqual({ name: "a.xml", path: "/2025/a.xml" });

    const withRelative = new File(["x"], "b.xml");
    Object.defineProperty(withRelative, "webkitRelativePath", { value: "2025/b.xml" });
    expect(toFileRef(withRelative)).toEqual({ name: "b.xml", path: "2025/b.xml" });

    expect(toFileRef(new File(["x"], "c.xml"))).toEqual({ name: "c.xml", path: "c.xml" });
  });

  it("ignores an empty dropzone path", () => {
    const file = new File(["x"], "d.xml");
    Object.defineProperty(file, "path", { value: "" });
    expect(toFileRef(file)).toEqual({ name: "d.xml", path: "d.xml" });
  });
});

describe("ingest", () => {
  it("classifies, parses XML and keeps the original order, dropping hidden files", async () => {
    const xml = thirtyXmlFiles();
    const files = [
      ...xml,
      new File(["%PDF"], "a.pdf"),
      new File(["PK"], "b.zip"),
      new File(["hola"], "c.txt"),
      new File(["x"], ".DS_Store"),
      new File([xmlFile(99)], "._x.xml"),
    ];
    const entries = await ingest(files);
    expect(entries).not.toBeNull();
    if (entries === null) return;
    expect(entries).toHaveLength(33);
    expect(entries.map((e) => e.file.name)).toEqual([
      ...xml.map((f) => f.name),
      "a.pdf",
      "b.zip",
      "c.txt",
    ]);
    for (const entry of entries.slice(0, 30)) {
      expect(entry.kind).toBe("parsed");
      if (entry.kind === "parsed") expect(entry.result.ok).toBe(true);
    }
    expect(entries.slice(30).map((e) => (e.kind === "ignored" ? e.ignoredKind : e.kind))).toEqual([
      "pdf",
      "zip",
      "other",
    ]);
  });

  it("keeps order when XML and ignored files are interleaved", async () => {
    const files = [new File(["%PDF"], "a.pdf"), xmlFile(1), new File(["z"], "b.zip"), xmlFile(2)];
    const entries = await ingest(files);
    expect(entries?.map((e) => e.file.name)).toEqual(["a.pdf", "f1.xml", "b.zip", "f2.xml"]);
  });

  it("reports the final progress with total equal to the XML count", async () => {
    const calls: Array<[number, number]> = [];
    const files = [...thirtyXmlFiles(), new File(["%PDF"], "a.pdf")];
    await ingest(files, { onProgress: (done, total) => calls.push([done, total]) });
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]).toEqual([30, 30]);
    for (const [, total] of calls) expect(total).toBe(30);
  });

  it("throttles progress to one call per 100 ms plus the final one", async () => {
    vi.spyOn(performance, "now").mockReturnValue(1000);
    const frozen: Array<[number, number]> = [];
    await ingest(thirtyXmlFiles(), { onProgress: (d, t) => frozen.push([d, t]) });
    expect(frozen).toEqual([[30, 30]]);

    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => {
      clock += 150;
      return clock;
    });
    const spaced: Array<[number, number]> = [];
    await ingest(thirtyXmlFiles(), { onProgress: (d, t) => spaced.push([d, t]) });
    expect(spaced).toEqual([
      [25, 30],
      [30, 30],
    ]);
  });

  it("resolves null when cancelled after the first chunk", async () => {
    let checks = 0;
    const parsedSoFar: number[] = [];
    const result = await ingest(thirtyXmlFiles(), {
      onProgress: (done) => parsedSoFar.push(done),
      isCancelled: () => {
        checks += 1;
        return checks > 1;
      },
    });
    expect(result).toBeNull();
    expect(parsedSoFar).not.toContain(30);
  });

  it("yields to the event loop between chunks", async () => {
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    await ingest(thirtyXmlFiles());
    expect(timeoutSpy).toHaveBeenCalled();
  });

  it("turns a file whose text() rejects into an unreadable entry", async () => {
    const broken = new File(["x"], "broken.xml");
    Object.defineProperty(broken, "text", {
      value: () => Promise.reject(new Error("boom")),
    });
    const entries = await ingest([broken, xmlFile(1)]);
    expect(entries?.[0]).toEqual({
      kind: "unreadable",
      file: { name: "broken.xml", path: "broken.xml" },
    });
    expect(entries?.[1]?.kind).toBe("parsed");
  });

  it("returns an empty list for an empty selection", async () => {
    expect(await ingest([])).toEqual([]);
  });
});
