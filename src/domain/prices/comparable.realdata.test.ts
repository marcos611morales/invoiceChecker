// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { hasSample, loadSample } from "../../../tests/support/realSample";
import { classifyClave } from "./comparable";

// Local coverage test of the ClaveProdServ classification against the real 2025 sample. Facturas/
// is gitignored, so the suite is skipped where the folder is absent (Vercel, CI, other machines).
// FACTURAS_DIR overrides the default <cwd>/Facturas (useful from git worktrees).
// Assertions are counts only: no RFC, name, description, amount, folio, date, UUID or key is ever
// asserted as a literal or printed.

interface Counts {
  lines: number;
  fuel: number;
  service: number;
  product: number;
  ltrLines: number;
  ltrFuel: number;
}

function measure(): Counts {
  const counts: Counts = { lines: 0, fuel: 0, service: 0, product: 0, ltrLines: 0, ltrFuel: 0 };
  for (const invoice of loadSample()) {
    if (invoice.tipo !== "I") continue;
    for (const concepto of invoice.conceptos) {
      const kind = classifyClave(concepto.claveProdServ);
      counts.lines += 1;
      counts[kind] += 1;
      if (concepto.claveUnidad === "LTR") {
        counts.ltrLines += 1;
        if (kind === "fuel") counts.ltrFuel += 1;
      }
    }
  }
  return counts;
}

describe.skipIf(!hasSample)("ClaveProdServ classification on the real sample (D-16, D-27)", () => {
  it("classifies every LTR line as fuel, at least one line as a service and most lines as products", () => {
    const counts = measure();
    expect(counts.lines).toBeGreaterThan(0);
    expect(counts.ltrLines).toBeGreaterThan(0);
    expect(counts.ltrFuel).toBe(counts.ltrLines);
    expect(counts.service).toBeGreaterThanOrEqual(1);
    expect(counts.product).toBeGreaterThan(counts.lines / 2);
    expect(counts.fuel + counts.service + counts.product).toBe(counts.lines);
  });
});
