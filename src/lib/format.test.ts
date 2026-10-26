import Big from "big.js";
import { afterEach, describe, expect, it } from "vitest";
import { PPD_SIN_COMPLEMENTO } from "@/domain/accounting/ledger";
import { dayNumber } from "@/domain/prices/history";
import {
  formaPagoLabel,
  formatContent,
  formatCount,
  formatDelta,
  formatExchangeRate,
  formatFechaIso,
  formatFolio,
  formatPercent,
  formatQuantity,
  formatTotal,
  formatUnitPrice,
  invoiceRef,
  longDateLabel,
  monthLongLabel,
  monthShortLabel,
  monthTickLabel,
  monthYearLabel,
  normalizeSearch,
  periodLabel,
  unitPriceText,
  rangeText,
  shortDateLabel,
  shortUuid,
} from "./format";

describe("formatFechaIso", () => {
  it("slices the literal ISO string into dd/mm/yyyy", () => {
    expect(formatFechaIso("2025-05-28T17:38:18")).toBe("28/05/2025");
  });

  it("does not shift the day for midnight timestamps", () => {
    expect(formatFechaIso("2025-01-01T00:00:00")).toBe("01/01/2025");
  });

  it("returns a malformed value unchanged", () => {
    expect(formatFechaIso("not a date")).toBe("not a date");
    expect(formatFechaIso("")).toBe("");
    expect(formatFechaIso("2025-5-28")).toBe("2025-5-28");
  });
});

describe("formatTotal", () => {
  it("formats MXN amounts in es-MX", () => {
    expect(formatTotal("1234.5", "MXN")).toBe("$1,234.50");
  });

  it("shows a dash for the XXX currency", () => {
    expect(formatTotal("0", "XXX")).toBe("—");
    expect(formatTotal("0.00", "XXX")).toBe("—");
  });

  it("never throws on an unknown currency code and keeps the raw amount", () => {
    const text = formatTotal("10.5", "ZZ");
    expect(text).toContain("10.5");
    expect(text).toContain("ZZ");
  });

  it("returns the raw amount with the code when the amount is not numeric", () => {
    const text = formatTotal("abc", "MXN");
    expect(text).toContain("abc");
  });
});

describe("formatFolio", () => {
  it("shows a dash for a missing folio", () => {
    expect(formatFolio(null)).toBe("—");
  });

  it("returns the folio as is", () => {
    expect(formatFolio("A-12")).toBe("A-12");
  });
});

describe("month labels", () => {
  it("gives the short Spanish name of the month", () => {
    expect(monthShortLabel("2025-01")).toBe("ene");
    expect(monthShortLabel("2025-12")).toBe("dic");
  });

  it("gives month and year", () => {
    expect(monthYearLabel("2025-05")).toBe("may 2025");
    expect(monthYearLabel("2025-01")).toBe("ene 2025");
  });

  it("gives the long name with the year", () => {
    expect(monthLongLabel("2025-05")).toBe("mayo 2025");
    expect(monthLongLabel("2025-12")).toBe("diciembre 2025");
  });

  it("returns a malformed key unchanged", () => {
    for (const bad of ["", "2025", "2025-13", "2025-00", "abcd-ef", "2025-5", "__proto__"]) {
      expect(monthShortLabel(bad)).toBe(bad);
      expect(monthYearLabel(bad)).toBe(bad);
      expect(monthLongLabel(bad)).toBe(bad);
    }
  });
});

describe("rangeText", () => {
  it("joins two months with a spaced en dash", () => {
    expect(rangeText("2025-01", "2025-12")).toBe("ene 2025 \u2013 dic 2025");
  });

  it("shows the long label for a single month", () => {
    expect(rangeText("2025-05", "2025-05")).toBe("mayo 2025");
  });

  it("keeps malformed keys as they are", () => {
    expect(rangeText("x", "y")).toBe("x \u2013 y");
  });
});

describe("formaPagoLabel", () => {
  it("gives the SAT catalog name", () => {
    expect(formaPagoLabel("28")).toBe("Tarjeta de débito");
  });

  it("never shows a bare code for an unknown code", () => {
    expect(formaPagoLabel("77")).toBe("Forma de pago 77");
  });

  it("treats a hostile code as an unknown code", () => {
    expect(formaPagoLabel("__proto__")).toBe("Forma de pago __proto__");
  });

  it("labels the PPD sentinel", () => {
    expect(formaPagoLabel(PPD_SIN_COMPLEMENTO)).toBe(
      "Por definir (sin complemento de pago)",
    );
  });
});

describe("normalizeSearch", () => {
  it("lowercases, strips accents and trims", () => {
    expect(normalizeSearch("  ÁBACO Ñandú ")).toBe("abaco nandu");
  });

  it("returns an empty string for blank text", () => {
    expect(normalizeSearch("   ")).toBe("");
  });
});

describe("formatPercent (D-40, REGLA-04)", () => {
  it("writes a fraction as a spaced percent with one decimal", () => {
    expect(formatPercent(new Big("0.124"))).toBe("12.4 %");
  });

  it("rounds half-up to one decimal only at display", () => {
    expect(formatPercent(new Big("0.12449"))).toBe("12.4 %");
    expect(formatPercent(new Big("0.1245"))).toBe("12.5 %");
  });

  it("uses the true minus sign U+2212 for negatives", () => {
    const text = formatPercent(new Big("-0.08"));
    expect(text).toBe("\u22128.0 %");
    expect(text.charCodeAt(0)).toBe(0x2212);
  });

  it("never prints a negative zero", () => {
    expect(formatPercent(new Big("0.0004"))).toBe("0.0 %");
    expect(formatPercent(new Big("-0.0004"))).toBe("0.0 %");
    expect(formatPercent(new Big("0"))).toBe("0.0 %");
  });

  it("groups thousands in es-MX", () => {
    expect(formatPercent(new Big("12.5"))).toBe("1,250.0 %");
  });
});

describe("formatDelta (D-20)", () => {
  it("signs an increase and points up", () => {
    expect(formatDelta(new Big("0.124"))).toEqual({ text: "+12.4 %", direction: "up" });
  });

  it("signs a decrease with the true minus and points down", () => {
    expect(formatDelta(new Big("-0.08"))).toEqual({ text: "\u22128.0 %", direction: "down" });
  });

  it("is flat when the rounded value is zero", () => {
    expect(formatDelta(new Big("0.0004"))).toEqual({ text: "0.0 %", direction: "flat" });
    expect(formatDelta(new Big("-0.0004"))).toEqual({ text: "0.0 %", direction: "flat" });
    expect(formatDelta(new Big("0"))).toEqual({ text: "0.0 %", direction: "flat" });
  });
});

describe("periodLabel (D-20)", () => {
  it("names a single month with its year", () => {
    expect(periodLabel("2025-05", "2025-05")).toBe("may 2025");
  });

  it("joins two months of one year with an unspaced en dash", () => {
    expect(periodLabel("2025-01", "2025-06")).toBe("ene\u2013jun 2025");
  });

  it("names both years when the period crosses a year", () => {
    expect(periodLabel("2024-12", "2025-02")).toBe("dic 2024\u2013feb 2025");
  });
});

describe("formatCount", () => {
  it("groups thousands in es-MX", () => {
    expect(formatCount(1234)).toBe("1,234");
    expect(formatCount(0)).toBe("0");
  });
});

describe("formatQuantity", () => {
  it("trims trailing zeros of the decimal text", () => {
    expect(formatQuantity("1.500000")).toBe("1.5");
    expect(formatQuantity("2.000000")).toBe("2");
    expect(formatQuantity("10")).toBe("10");
  });

  it("never prints an exponent", () => {
    expect(formatQuantity("0.000001")).toBe("0.000001");
    expect(formatQuantity("123456789012.5")).toBe("123456789012.5");
  });

  it("rounds to at most 6 decimals", () => {
    expect(formatQuantity("1.1234565")).toBe("1.123457");
  });

  it("returns the raw text when it is not a valid decimal", () => {
    expect(formatQuantity("abc")).toBe("abc");
    expect(formatQuantity("")).toBe("");
    expect(formatQuantity("1e5")).toBe("1e5");
  });
});

describe("formatUnitPrice", () => {
  it("keeps 2 decimals at least and 6 at most", () => {
    expect(formatUnitPrice(new Big("12.5"))).toBe("$12.50");
    expect(formatUnitPrice(new Big("0.123456"))).toBe("$0.123456");
    expect(formatUnitPrice(new Big("1234.5"))).toBe("$1,234.50");
  });

  it("shows a dash when there is no price", () => {
    expect(formatUnitPrice(null)).toBe("—");
  });
});

describe("unitPriceText", () => {
  it("rounds half-up to 2 decimals and names the unit of the family", () => {
    expect(unitPriceText(new Big("35.2047"), "mass")).toBe("$35.20 / kg");
    expect(unitPriceText(new Big("12.5"), "volume")).toBe("$12.50 / L");
    expect(unitPriceText(new Big("50"), "piece")).toBe("$50.00 / pieza");
    expect(unitPriceText(new Big("0.125"), "mass")).toBe("$0.13 / kg");
  });
});

describe("shortUuid and invoiceRef", () => {
  it("takes the first 8 characters of the uuid", () => {
    expect(shortUuid("ABCDEF12-3456-7890-ABCD-EF1234567890")).toBe("ABCDEF12");
  });

  it("uses the folio, else the short uuid", () => {
    const uuid = "ABCDEF12-3456-7890-ABCD-EF1234567890";
    expect(invoiceRef("A-12", uuid)).toBe("A-12");
    expect(invoiceRef(null, uuid)).toBe("ABCDEF12");
    expect(invoiceRef("", uuid)).toBe("ABCDEF12");
  });
});

describe("formatExchangeRate", () => {
  it("shows at least 2 and at most 6 decimals", () => {
    expect(formatExchangeRate(new Big("18.2"))).toBe("18.20");
    expect(formatExchangeRate(new Big("18"))).toBe("18.00");
    expect(formatExchangeRate(new Big("18.123400"))).toBe("18.1234");
    expect(formatExchangeRate(new Big("0.0525"))).toBe("0.0525");
  });
});

describe("shortDateLabel", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it.each(["America/Mexico_City", "Asia/Tokyo", "Pacific/Kiritimati", "Pacific/Pago_Pago"])(
    "reads the literal day in the %s time zone",
    (zone) => {
      process.env.TZ = zone;
      expect(shortDateLabel("2025-05-28T17:38:18")).toBe("28 may 2025");
      expect(shortDateLabel("2025-01-01T00:00:00")).toBe("1 ene 2025");
      expect(shortDateLabel("2025-12-31T23:59:59")).toBe("31 dic 2025");
    },
  );

  it("names every month in three letters", () => {
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    months.forEach((name, index) => {
      expect(shortDateLabel(`2025-${String(index + 1).padStart(2, "0")}-15T10:00:00`)).toBe(
        `15 ${name} 2025`,
      );
    });
  });

  it("returns a malformed value unchanged", () => {
    expect(shortDateLabel("mayo")).toBe("mayo");
    expect(shortDateLabel("2025-13-01T00:00:00")).toBe("2025-13-01T00:00:00");
    expect(shortDateLabel("2025-05-00T00:00:00")).toBe("2025-05-00T00:00:00");
  });
});

describe("formatContent", () => {
  it("trims trailing zeros and keeps up to three decimals", () => {
    expect(formatContent(new Big("0.375"), "mass")).toBe("0.375 kg");
    expect(formatContent(new Big("1.73"), "mass")).toBe("1.73 kg");
    expect(formatContent(new Big("1.730"), "mass")).toBe("1.73 kg");
    expect(formatContent(new Big("12"), "volume")).toBe("12 L");
    expect(formatContent(new Big("24.0000"), "volume")).toBe("24 L");
  });

  it("rounds half-up to three decimals only when displayed", () => {
    expect(formatContent(new Big("0.12345"), "mass")).toBe("0.123 kg");
    expect(formatContent(new Big("0.1235"), "mass")).toBe("0.124 kg");
    expect(formatContent(new Big("0.0004"), "volume")).toBe("0 L");
  });

  it("pluralizes pieces", () => {
    expect(formatContent(new Big("6"), "piece")).toBe("6 piezas");
    expect(formatContent(new Big("1"), "piece")).toBe("1 pieza");
    expect(formatContent(new Big("1.0004"), "piece")).toBe("1 pieza");
    expect(formatContent(new Big("0.5"), "piece")).toBe("0.5 piezas");
  });
});

describe("longDateLabel", () => {
  it("writes the literal date with the long month, without a leading zero", () => {
    expect(longDateLabel("2025-05-28T17:38:18")).toBe("28 de mayo de 2025");
    expect(longDateLabel("2025-01-01T00:00:00")).toBe("1 de enero de 2025");
    expect(longDateLabel("2025-09-05T23:59:59")).toBe("5 de septiembre de 2025");
  });

  it("returns a malformed value unchanged", () => {
    expect(longDateLabel("junk")).toBe("junk");
    expect(longDateLabel("2025-13-01T00:00:00")).toBe("2025-13-01T00:00:00");
    expect(longDateLabel("2025-05-00T00:00:00")).toBe("2025-05-00T00:00:00");
  });
});

describe("monthTickLabel", () => {
  it("reads «may 2025» for a day number of that month", () => {
    const day = dayNumber("2025-05-01T00:00:00");
    expect(day).not.toBeNull();
    if (day !== null) {
      expect(monthTickLabel(day)).toBe("may 2025");
      expect(monthTickLabel(day + 30)).toBe("may 2025");
      expect(monthTickLabel(day + 31)).toBe("jun 2025");
    }
  });
});
