import Big from "big.js";
import { describe, expect, it } from "vitest";
import { ZERO, parseDecimal, sum, toMoneyString } from "./decimal";

function bigOf(raw: string): Big {
  const parsed = parseDecimal(raw);
  if (parsed === null) throw new Error(`not a decimal: ${raw}`);
  return parsed;
}

describe("parseDecimal boundaries (REGLA-04, T-02-03)", () => {
  it("accepts 18 integer digits and 12 decimals", () => {
    const eighteen = "9".repeat(18);
    expect(parseDecimal(eighteen)?.toString()).toBe(eighteen);
    expect(parseDecimal("0." + "1".repeat(12))?.toString()).toBe("0.111111111111");
    expect(parseDecimal(`${eighteen}.${"1".repeat(12)}`)).not.toBeNull();
  });

  it("rejects 19 integer digits and 13 decimals", () => {
    expect(parseDecimal("1".repeat(19))).toBeNull();
    expect(parseDecimal("0." + "1".repeat(13))).toBeNull();
  });

  it("rejects exponent forms and junk", () => {
    for (const raw of ["1e5", "1E5", "1e999999", "0x10", " 1 2 ", "", "-", ".", "NaN", "Infinity", "1,5", "+1", "1.", ".5", "--1"]) {
      expect(parseDecimal(raw), raw).toBeNull();
    }
    expect(parseDecimal(null)).toBeNull();
  });

  it("trims surrounding spaces and keeps the sign", () => {
    expect(parseDecimal("  12.50 ")?.toString()).toBe("12.5");
    expect(parseDecimal("-3.25")?.toString()).toBe("-3.25");
  });
});

describe("exact sums (REGLA-04)", () => {
  it("0.1 + 0.2 is exactly 0.3", () => {
    const total = sum([bigOf("0.1"), bigOf("0.2")]);
    expect(total.eq(bigOf("0.3"))).toBe(true);
    expect(total.toString()).toBe("0.3");
  });

  it("an empty sum is zero", () => {
    expect(sum([]).eq(ZERO)).toBe(true);
  });

  it("400 invoices equal an independent BigInt-cents reference", () => {
    const cents: bigint[] = [];
    const values: Big[] = [];
    for (let i = 0; i < 400; i += 1) {
      // Deterministic amounts with odd cents so float drift would show.
      const c = BigInt(((i * 7919 + 13) % 1_000_003) + 1);
      cents.push(c);
      const whole = c / 100n;
      const frac = (c % 100n).toString().padStart(2, "0");
      values.push(bigOf(`${whole.toString()}.${frac}`));
    }
    const reference = cents.reduce((acc, c) => acc + c, 0n);
    const refWhole = reference / 100n;
    const refFrac = (reference % 100n).toString().padStart(2, "0");
    expect(sum(values).toString()).toBe(
      bigOf(`${refWhole.toString()}.${refFrac}`).toString(),
    );
  });
});

describe("toMoneyString (display-only rounding)", () => {
  it("rounds half up to two decimals", () => {
    expect(toMoneyString(bigOf("2.345"))).toBe("2.35");
    expect(toMoneyString(bigOf("2.344"))).toBe("2.34");
    expect(toMoneyString(bigOf("2.3449999"))).toBe("2.34");
  });

  it("never prints a negative zero", () => {
    expect(toMoneyString(bigOf("-0.001"))).toBe("0.00");
    expect(toMoneyString(bigOf("-0.004"))).toBe("0.00");
    expect(toMoneyString(ZERO)).toBe("0.00");
  });

  it("pads to two decimals and keeps the sign", () => {
    expect(toMoneyString(bigOf("-1234.5"))).toBe("-1234.50");
    expect(toMoneyString(bigOf("7"))).toBe("7.00");
    expect(toMoneyString(bigOf("-0.005"))).toBe("-0.01");
  });
});

describe("Big.strict (no float path)", () => {
  it("throws when a Big is built from a number", () => {
    // The types still allow a number; Big.strict (set in decimal.ts) rejects it at run time.
    expect(() => new Big(0.1)).toThrow();
  });
});
