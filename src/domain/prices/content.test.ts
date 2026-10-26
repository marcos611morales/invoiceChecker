import { describe, expect, it } from "vitest";
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
});
