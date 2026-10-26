import { describe, expect, it } from "vitest";
import { unitRuleOf } from "./units";

describe("unitRuleOf (D-09 step 2, D-11, D-32)", () => {
  it("reads weight codes with their factor to kg", () => {
    expect(unitRuleOf("KGM")).toEqual({ family: "mass", factor: "1" });
    expect(unitRuleOf("GRM")).toEqual({ family: "mass", factor: "0.001" });
  });

  it("reads volume codes with their factor to L", () => {
    expect(unitRuleOf("LTR")).toEqual({ family: "volume", factor: "1" });
    expect(unitRuleOf("MLT")).toEqual({ family: "volume", factor: "0.001" });
  });

  it("ignores case and edge spaces", () => {
    expect(unitRuleOf("h87 ")).toEqual({ family: "piece", factor: "1" });
    expect(unitRuleOf("  kgm")?.family).toBe("mass");
  });

  it.each([
    "H87",
    "XUN",
    "XPK",
    "E48",
    "EA",
    "ACT",
    "XBX",
    "X4G",
    "XBJ",
    "XBO",
    "XBG",
    "XCT",
    "XCS",
    "XPA",
    "SET",
    "KT",
    "XKI",
  ])("reads %s as a piece unit with factor 1", (code) => {
    expect(unitRuleOf(code)).toEqual({ family: "piece", factor: "1" });
  });

  it("gives null for a unit with no equivalence and for an empty string", () => {
    expect(unitRuleOf("MTR")).toBeNull();
    expect(unitRuleOf("")).toBeNull();
    expect(unitRuleOf("   ")).toBeNull();
  });

  it("gives null for prototype keys without touching Object.prototype (T-05-01)", () => {
    expect(unitRuleOf("__proto__")).toBeNull();
    expect(unitRuleOf("constructor")).toBeNull();
    expect(unitRuleOf("toString")).toBeNull();
    expect(Object.keys(Object.prototype)).toEqual([]);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, "family")).toBe(false);
  });
});
