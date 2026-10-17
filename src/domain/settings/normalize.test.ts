import { describe, expect, it } from "vitest";
import { normalizeDescription, ruleMapKey } from "./normalize";

describe("normalizeDescription (D-10, D-26)", () => {
  it("ignores case, accents and repeated spaces: «Café  Molido 1kg» is «CAFE MOLIDO 1KG»", () => {
    const a = normalizeDescription("Café  Molido 1kg");
    expect(a).toBe("cafe molido 1kg");
    expect(a).toBe(normalizeDescription("CAFE MOLIDO 1KG"));
  });

  it("keeps different quantities apart: «CAFE 1KG» is not «CAFE 500G»", () => {
    expect(normalizeDescription("CAFE 1KG")).not.toBe(normalizeDescription("CAFE 500G"));
  });

  it("keeps ñ distinct from n: «PEÑA» is not «PENA»", () => {
    expect(normalizeDescription("PEÑA")).toBe("peña");
    expect(normalizeDescription("PEÑA")).not.toBe(normalizeDescription("PENA"));
  });

  it("treats «Ñ» and «ñ» as the same letter", () => {
    expect(normalizeDescription("Ñ")).toBe(normalizeDescription("ñ"));
    expect(normalizeDescription("Ñ")).toBe("ñ");
  });

  it("composes a decomposed n plus a tilde into the same key as «PEÑA»", () => {
    const decomposed = "PEÑA";
    expect(decomposed).not.toBe("PEÑA");
    expect(normalizeDescription(decomposed)).toBe(normalizeDescription("PEÑA"));
  });

  it("removes the dieresis and the acute marks of the other vowels", () => {
    expect(normalizeDescription("PINGÜINO")).toBe("pinguino");
    expect(normalizeDescription("ÁÉÍÓÚ")).toBe("aeiou");
  });

  it("collapses tabs, newlines, non-breaking spaces and repeated spaces to one space", () => {
    expect(normalizeDescription("a\tb\nc d   e")).toBe("a b c d e");
  });

  it("trims the edges", () => {
    expect(normalizeDescription("   cloro 1l \n")).toBe("cloro 1l");
    expect(normalizeDescription("  ")).toBe("");
  });
});

describe("ruleMapKey", () => {
  it("joins the rfc and the key with a NUL so no pair collides with another", () => {
    expect(ruleMapKey("AAA", "bcd")).toBe("AAA\u0000bcd");
    expect(ruleMapKey("AAAb", "cd")).not.toBe(ruleMapKey("AAA", "bcd"));
  });

  it("is a plain string for an rfc such as __proto__", () => {
    expect(ruleMapKey("__proto__", "x")).toBe("__proto__\u0000x");
  });
});
