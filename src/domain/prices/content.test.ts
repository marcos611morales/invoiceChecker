import { describe, expect, it } from "vitest";
import type { ContentCorrection } from "../settings/types";
import { resolveContent } from "./content";

function line(claveUnidad: string, cantidad: string, descripcion = "PRODUCTO DE PRUEBA") {
  return { claveUnidad, cantidad, descripcion };
}

describe("resolveContent (D-09 steps 2 and 4, D-11, D-26, D-32)", () => {
  it.each(["0", "-1", "abc", "", "1e3", "0.000"])(
    "gives bad-quantity for the quantity %j",
    (cantidad) => {
      expect(resolveContent(line("KGM", cantidad))).toEqual({
        ok: false,
        reason: "bad-quantity",
      });
    },
  );

  it("reads a weight unit from the XML quantity whatever the description says", () => {
    const content = resolveContent(line("KGM", "0.27", "JAMON ZWAN VIRGINIA1X1KG"));
    expect(content.ok).toBe(true);
    if (!content.ok) return;
    expect(content.family).toBe("mass");
    expect(content.amount.toString()).toBe("0.27");
    expect(content.sized).toBe(true);
    expect(content.source).toBe("xml");
  });

  it("converts grams to kg and millilitres to L exactly", () => {
    const grams = resolveContent(line("GRM", "250"));
    expect(grams.ok && grams.family === "mass" && grams.amount.toString()).toBe("0.25");
    const millilitres = resolveContent(line("MLT", "1500"));
    expect(millilitres.ok && millilitres.family === "volume" && millilitres.amount.toString()).toBe(
      "1.5",
    );
  });

  it("reads litres as volume with the XML quantity", () => {
    const content = resolveContent(line("LTR", "3"));
    expect(content.ok && content.family === "volume" && content.sized).toBe(true);
  });

  it("reads a piece unit as pieces without a verified size", () => {
    const content = resolveContent(line("H87", "6"));
    expect(content.ok).toBe(true);
    if (!content.ok) return;
    expect(content.family).toBe("piece");
    expect(content.amount.toString()).toBe("6");
    expect(content.sized).toBe(false);
    expect(content.source).toBe("unsized");
  });

  it("gives unit-unknown for a unit with no equivalence", () => {
    expect(resolveContent(line("MTR", "2"))).toEqual({ ok: false, reason: "unit-unknown" });
    expect(resolveContent(line("", "2"))).toEqual({ ok: false, reason: "unit-unknown" });
  });

  it("reads the size of a piece unit from the description (D-09 step 3)", () => {
    const content = resolveContent(line("H87", "2", "12/1L ALPURA"));
    expect(content.ok).toBe(true);
    if (!content.ok) return;
    expect(content.family).toBe("volume");
    expect(content.amount.toString()).toBe("24");
    expect(content.sized).toBe(true);
    expect(content.source).toBe("description");
  });

  it("reads a weight from the description of another piece code", () => {
    const content = resolveContent(line("XPK", "3", "LECHERA 375G"));
    expect(content.ok && content.family === "mass" && content.amount.toString()).toBe("1.125");
    expect(content.ok && content.source).toBe("description");
  });

  it("keeps a piece unit without a readable size unsized", () => {
    const content = resolveContent(line("XUN", "6", "Leche LacDel Desla"));
    expect(content.ok).toBe(true);
    if (!content.ok) return;
    expect(content.family).toBe("piece");
    expect(content.amount.toString()).toBe("6");
    expect(content.sized).toBe(false);
    expect(content.source).toBe("unsized");
  });

  it("counts pieces read from the description as a verified size (D-25, D-34)", () => {
    const content = resolveContent(line("H87", "3", "50PZ"));
    expect(content.ok).toBe(true);
    if (!content.ok) return;
    expect(content.family).toBe("piece");
    expect(content.amount.toString()).toBe("150");
    expect(content.sized).toBe(true);
    expect(content.source).toBe("description");
  });

  it.each(["AGUA 600ML 24PK", "24 TARROS 470 ML - PACK 24 TARROS", "50PZ / CJ 20PQ"])(
    "leaves the ambiguous description %j unsized",
    (descripcion) => {
      const content = resolveContent(line("H87", "2", descripcion));
      expect(content.ok && content.family).toBe("piece");
      expect(content.ok && content.sized).toBe(false);
      expect(content.ok && content.amount.toString()).toBe("2");
    },
  );

  it("never reads the description of a weight or volume unit", () => {
    const mass = resolveContent(line("KGM", "0.27", "JAMON ZWAN VIRGINIA1X1KG & 10360 1/1 KG"));
    expect(mass.ok && mass.family).toBe("mass");
    expect(mass.ok && mass.amount.toString()).toBe("0.27");
    expect(mass.ok && mass.source).toBe("xml");
    const volume = resolveContent(line("LTR", "2", "12/1L ALPURA"));
    expect(volume.ok && volume.amount.toString()).toBe("2");
    expect(volume.ok && volume.source).toBe("xml");
  });
});

function fix(overrides: Partial<ContentCorrection> = {}): ContentCorrection {
  return {
    rfc: "AAA010101AAA",
    key: "producto de prueba",
    description: "PRODUCTO DE PRUEBA",
    supplierName: "Tienda",
    packs: 1,
    amount: "1",
    unit: "l",
    ...overrides,
  };
}

describe("resolveContent with a user correction (D-09 step 1, D-13, D-14)", () => {
  it("multiplies quantity, pieces per pack and content into litres", () => {
    const content = resolveContent(line("H87", "2"), fix({ packs: 12, amount: "1", unit: "l" }));
    expect(content.ok).toBe(true);
    if (!content.ok) return;
    expect(content.family).toBe("volume");
    expect(content.amount.toString()).toBe("24");
    expect(content.sized).toBe(true);
    expect(content.source).toBe("user");
  });

  it("converts grams to kg and millilitres to L exactly", () => {
    const grams = resolveContent(line("H87", "2"), fix({ packs: 1, amount: "375", unit: "g" }));
    expect(grams.ok && grams.family === "mass" && grams.amount.toString()).toBe("0.75");
    const millilitres = resolveContent(line("XPK", "3"), fix({ packs: 6, amount: "355", unit: "ml" }));
    expect(millilitres.ok && millilitres.family === "volume" && millilitres.amount.toString()).toBe(
      "6.39",
    );
    const kilos = resolveContent(line("H87", "4"), fix({ packs: 1, amount: "0.5", unit: "kg" }));
    expect(kilos.ok && kilos.family === "mass" && kilos.amount.toString()).toBe("2");
  });

  it("counts typed pieces as a verified size", () => {
    const content = resolveContent(line("H87", "2"), fix({ packs: 1, amount: "6", unit: "piezas" }));
    expect(content.ok).toBe(true);
    if (!content.ok) return;
    expect(content.family).toBe("piece");
    expect(content.amount.toString()).toBe("12");
    expect(content.sized).toBe(true);
    expect(content.source).toBe("user");
  });

  it("wins over a size read from the description", () => {
    const content = resolveContent(line("H87", "2", "12/1L ALPURA"), fix({ amount: "500", unit: "ml" }));
    expect(content.ok && content.family).toBe("volume");
    expect(content.ok && content.amount.toString()).toBe("1");
    expect(content.ok && content.source).toBe("user");
  });

  it.each(["KGM", "GRM", "LTR", "MLT"])("ignores the correction on the weight or volume unit %s", (unit) => {
    const without = resolveContent(line(unit, "0.27"));
    const withFix = resolveContent(line(unit, "0.27"), fix({ packs: 12, amount: "1", unit: "l" }));
    expect(withFix).toEqual(without);
    expect(withFix.ok && withFix.source).toBe("xml");
  });

  it("keeps the unit-unknown and bad-quantity refusals", () => {
    expect(resolveContent(line("MTR", "2"), fix())).toEqual({ ok: false, reason: "unit-unknown" });
    expect(resolveContent(line("H87", "0"), fix())).toEqual({ ok: false, reason: "bad-quantity" });
  });

  it("falls back to detection when the stored amount cannot be parsed, without throwing", () => {
    const bad = resolveContent(line("H87", "2", "12/1L ALPURA"), fix({ amount: "abc" }));
    expect(bad.ok && bad.source).toBe("description");
    const badPacks = resolveContent(line("H87", "2"), fix({ packs: Number.NaN }));
    expect(badPacks.ok && badPacks.source).toBe("unsized");
    const fractional = resolveContent(line("H87", "2"), fix({ packs: 1.5 }));
    expect(fractional.ok && fractional.source).toBe("unsized");
  });

  it("treats null and undefined corrections as absent", () => {
    const none = resolveContent(line("H87", "2", "12/1L ALPURA"));
    expect(resolveContent(line("H87", "2", "12/1L ALPURA"), null)).toEqual(none);
    expect(resolveContent(line("H87", "2", "12/1L ALPURA"), undefined)).toEqual(none);
  });
});
