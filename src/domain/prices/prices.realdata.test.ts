// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { hasSample, loadSample } from "../../../tests/support/realSample";
import { normalizeDescription, ruleMapKey } from "../settings/normalize";
import { resolveContent } from "./content";
import { readSize } from "./sizeReader";
import { unitRuleOf } from "./units";

// Local coverage test of the size reader against the real 2025 sample. Facturas/ is gitignored,
// so the suite is skipped where the folder is absent (Vercel, CI, other machines).
// FACTURAS_DIR overrides the default <cwd>/Facturas (useful from git worktrees).
// Assertions are counts and booleans only: no RFC, name, description, amount, folio, date or
// UUID is ever asserted as a literal or printed.

const MIN_WEIGHT_VOLUME_MEMBERS = 30;
const MIN_PIECE_COUNT_MEMBERS = 5;
const MAX_TOTAL = 1000;

interface Coverage {
  weightVolumeMembers: number;
  pieceCountMembers: number;
  maxWeightVolume: number;
  weightVolumeLinesFromDescription: number;
  weightVolumeLines: number;
}

function measure(): Coverage {
  const members = new Map<string, { kind: "size-wv" | "size-piece" | "other" }>();
  let maxWeightVolume = 0;
  let weightVolumeLines = 0;
  let weightVolumeLinesFromDescription = 0;
  for (const invoice of loadSample()) {
    if (invoice.tipo !== "I") continue;
    for (const concepto of invoice.conceptos) {
      const rule = unitRuleOf(concepto.claveUnidad);
      if (rule === null) continue;
      if (rule.family !== "piece") {
        weightVolumeLines += 1;
        const content = resolveContent(concepto);
        if (content.ok && content.source !== "xml") weightVolumeLinesFromDescription += 1;
        continue;
      }
      const key = ruleMapKey(invoice.emisor.rfc, normalizeDescription(concepto.descripcion));
      const reading = readSize(concepto.descripcion);
      let kind: "size-wv" | "size-piece" | "other" = "other";
      if (reading.kind === "size") {
        if (reading.family === "piece") {
          kind = "size-piece";
        } else {
          kind = "size-wv";
          maxWeightVolume = Math.max(maxWeightVolume, Number(reading.total.toString()));
        }
      }
      const previous = members.get(key);
      if (previous === undefined || previous.kind === "other") members.set(key, { kind });
    }
  }
  let weightVolumeMembers = 0;
  let pieceCountMembers = 0;
  for (const member of members.values()) {
    if (member.kind === "size-wv") weightVolumeMembers += 1;
    if (member.kind === "size-piece") pieceCountMembers += 1;
  }
  return {
    weightVolumeMembers,
    pieceCountMembers,
    maxWeightVolume,
    weightVolumeLinesFromDescription,
    weightVolumeLines,
  };
}

describe.skipIf(!hasSample)("size reader sobre la muestra real 2025", () => {
  // Lazy: describe.skipIf still runs this body when collecting, and the folder may be absent.
  let cache: Coverage | null = null;
  function coverage(): Coverage {
    if (cache === null) cache = measure();
    return cache;
  }

  it("reads a weight or volume for at least 30 distinct piece-unit members", () => {
    expect(coverage().weightVolumeMembers).toBeGreaterThanOrEqual(MIN_WEIGHT_VOLUME_MEMBERS);
  });

  it("reads a piece count for at least 5 distinct piece-unit members", () => {
    expect(coverage().pieceCountMembers).toBeGreaterThanOrEqual(MIN_PIECE_COUNT_MEMBERS);
  });

  it("never reads a weight or volume above 1,000 kg or L", () => {
    expect(coverage().maxWeightVolume).toBeLessThanOrEqual(MAX_TOTAL);
  });

  it("takes every weight and volume line from the XML quantity", () => {
    const { weightVolumeLines, weightVolumeLinesFromDescription } = coverage();
    expect(weightVolumeLines).toBeGreaterThan(0);
    expect(weightVolumeLinesFromDescription).toBe(0);
  });
});
