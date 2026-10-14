// @vitest-environment jsdom
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCfdi } from "./parseCfdi";
import type { ParsedInvoice } from "./types";

// Local regression against the real 2025 sample. Facturas/ is gitignored, so the
// suite is skipped where the folder is absent (Vercel, CI, other machines).
// FACTURAS_DIR overrides the default <cwd>/Facturas (useful from git worktrees).
// Assertions are counts only: no real value is ever printed or snapshotted.
const facturasRoot = process.env.FACTURAS_DIR ?? resolve(process.cwd(), "Facturas");
const sampleDir = join(facturasRoot, "2025");
const hasSample = existsSync(sampleDir);

describe.skipIf(!hasSample)("parseCfdi sobre la muestra real 2025", () => {
  it("muestra real: 143 XML, 133 I, 3 E, 7 P", () => {
    const names = readdirSync(sampleDir).filter((n) => n.toLowerCase().endsWith(".xml"));
    expect(names).toHaveLength(143);

    const invoices: ParsedInvoice[] = [];
    let rejected = 0;
    for (const name of names) {
      const result = parseCfdi(readFileSync(join(sampleDir, name), "utf8"));
      if (result.ok) invoices.push(result.invoice);
      else rejected += 1;
    }
    expect(rejected).toBe(0);
    expect(invoices).toHaveLength(143);

    const countTipo = (tipo: string): number =>
      invoices.filter((i) => i.tipo === tipo).length;
    expect(countTipo("I")).toBe(133);
    expect(countTipo("E")).toBe(3);
    expect(countTipo("P")).toBe(7);

    expect(new Set(invoices.map((i) => i.uuid)).size).toBe(143);

    expect(invoices.reduce((n, i) => n + i.conceptos.length, 0)).toBe(362);

    const pagos = invoices.flatMap((i) => i.pagos);
    expect(pagos).toHaveLength(7);
    expect(pagos.reduce((n, p) => n + p.doctos.length, 0)).toBe(7);

    const withRelacionados = invoices.filter((i) => i.relacionados.length > 0);
    expect(withRelacionados).toHaveLength(6);
    const relacionadoUuids = withRelacionados.flatMap((i) =>
      i.relacionados.flatMap((r) => r.uuids),
    );
    expect(relacionadoUuids).toHaveLength(7);

    expect(invoices.filter((i) => i.folio === null)).toHaveLength(10);
    expect(invoices.filter((i) => i.descuento !== null)).toHaveLength(68);
    expect(invoices.filter((i) => i.tipoCambio !== null)).toHaveLength(65);
  });

  it("ningun XML real 4.0 es rechazado", () => {
    const names = readdirSync(sampleDir).filter((n) => n.toLowerCase().endsWith(".xml"));
    const reasons = names
      .map((n) => parseCfdi(readFileSync(join(sampleDir, n), "utf8")))
      .filter((r) => !r.ok)
      .map((r) => (r.ok ? "" : r.reason));
    expect(reasons).toEqual([]);
  });
});
