import { describe, expect, it } from "vitest";
import { MAX_DESCRIPTION_LENGTH, readSize, type SizeReading } from "./sizeReader";

/** Compact form of a reading for table assertions: "family:total" or "ambiguous:reason" or "none". */
function shape(reading: SizeReading): string {
  if (reading.kind === "size") return `${reading.family}:${reading.total.toString()}`;
  if (reading.kind === "ambiguous") return `ambiguous:${reading.reason}`;
  return "none";
}

describe("readSize: weight and volume (D-09 step 3, RESEARCH contract table)", () => {
  it.each([
    ["12/1L ALPURA", "volume:12"],
    ["2KG MANGO MM", "mass:2"],
    ["LECHERA 375G", "mass:0.375"],
    ["1.730K MAYON", "mass:1.73"],
    ["12/355CCSAB", "volume:4.26"],
    ["May Mccorm 1730 G", "mass:1.73"],
    ["SHIBUMI TARO 1.700 GR", "mass:1.7"],
    ["Mac Delineador Labial Lip Pencil 1.45g", "mass:0.00145"],
    ["ACIDO MURIATICO SULTAN LIMON 15/900 ML", "volume:13.5"],
    ["SALSA CHAMOY CHILERITO 12/1LT (5) SALS0002", "volume:12"],
    ["JAMON ZWAN VIRGINIA1X1KG & 10360 1/1 KG", "mass:1"],
    ["Aceite 1,5 L", "volume:1.5"],
    ["Aceite 1,25 L", "volume:1.25"],
    ["JUGO 1,500 ML", "volume:1.5"],
    ["HARINA 1,000 G", "mass:1"],
    ["AGUA 1,000 L", "volume:1000"],
    ["ARROZ 1,500 G", "mass:1.5"],
    ["Aceite 1,5 KG", "mass:1.5"],
    ["Crema ácida 900 mililitros", "volume:0.9"],
  ])("reads %j as %s", (description, expected) => {
    expect(shape(readSize(description))).toBe(expected);
  });

  it("keeps the matched text of a size", () => {
    const reading = readSize("LECHERA 375G");
    expect(reading.kind).toBe("size");
    if (reading.kind !== "size") return;
    expect(reading.text).toBe("375G");
  });
});

describe("readSize: piece counts (D-25, D-34, D-35)", () => {
  it.each([
    ["50PZ", "piece:50"],
    ["BONAFO18PK", "piece:18"],
    ["100 pz", "piece:100"],
    ["300 Piezas", "piece:300"],
    ["VASO TERMICO 4PK", "piece:4"],
    ["6PZ 6 PZ", "piece:6"],
    ["SERVILLETA 200 PZAS", "piece:200"],
    ["GUANTES 100 PZA", "piece:100"],
    ["TAPAS 50 PZS", "piece:50"],
    ["CAPSULA 2 PKS", "piece:2"],
    ["BOLSA 1 PIEZA", "piece:1"],
  ])("reads %j as %s", (description, expected) => {
    expect(shape(readSize(description))).toBe(expected);
  });

  it("discards counts of zero and counts of five digits (the pattern reads 1 to 4 digits)", () => {
    expect(shape(readSize("TAPAS 0PZ"))).toBe("none");
    expect(shape(readSize("TAPAS 10001 PZ"))).toBe("none");
    expect(shape(readSize("TAPAS 10000 PZ"))).toBe("none");
    expect(shape(readSize("TAPAS 9999 PZ"))).toBe("piece:9999");
  });

  it("does not read a count that continues a longer number", () => {
    expect(shape(readSize("TAPAS 1.5PZ"))).toBe("none");
    expect(shape(readSize("TAPAS 1,000PZ"))).toBe("none");
    expect(shape(readSize("TAPAS 12345PZ"))).toBe("none");
  });

  it("does not read tokens that merely start like a piece token", () => {
    expect(shape(readSize("TAPAS 50PZX"))).toBe("none");
    expect(shape(readSize("TAPAS 50 PIEZASS"))).toBe("none");
    expect(shape(readSize("TAPAS 50 PAQ"))).toBe("none");
    expect(shape(readSize("TAPAS 50 PQ"))).toBe("none");
  });
});

describe("readSize: ambiguous descriptions give no size (RESEARCH Pitfall 4, D-35)", () => {
  it.each([
    ["2 PZ 3 PZ", "ambiguous:conflict"],
    ["AGUA 600ML 24PK", "ambiguous:conflict"],
    ["50PZ / CJ 20PQ", "ambiguous:pack-token"],
    ["24 TARROS MASON JAR 470 ML - PACK 24 TARROS", "ambiguous:pack-token"],
    ["JUGO 1L CAJA", "ambiguous:pack-token"],
    ["AGUA 600 ML 40P", "ambiguous:pack-token"],
    ["AGUA 1L DOCENA", "ambiguous:pack-token"],
    ["REFRESCO 355 ML FAJILLA", "ambiguous:pack-token"],
    ["VASOS 50PZ PACK", "ambiguous:pack-token"],
    ["VASOS 50PZ CAJA", "ambiguous:pack-token"],
    ["VASOS 50PZ DOCENA", "ambiguous:pack-token"],
    ["VASOS 50PZ 3 P", "ambiguous:pack-token"],
    ["1KG 2KG", "ambiguous:conflict"],
    ["12/50PZ", "ambiguous:pack-token"],
  ])("reads %j as %s", (description, expected) => {
    expect(shape(readSize(description))).toBe(expected);
  });

  it("lists the texts of a conflict", () => {
    const reading = readSize("2 PZ 3 PZ");
    expect(reading.kind).toBe("ambiguous");
    if (reading.kind !== "ambiguous") return;
    expect(reading.texts).toEqual(["2 PZ", "3 PZ"]);
  });
});

describe("readSize: nothing to read", () => {
  it.each([
    "MM AGUA 40P",
    "SPRITE 600",
    "SPR SA 355",
    "CLORALEX3.75",
    "FRESA 454",
    "Leche LacDel Desla",
    "",
    "   ",
  ])("gives none for %j", (description) => {
    expect(readSize(description).kind).toBe("none");
  });

  it.each([
    "MINI UPS 12V 5000 MAHX2",
    "Cable USB-C 2 Metros",
    "MPQ MALLAS DE ALAMBRE 90 2X2M",
    "SOPORTE G45",
    "LLANTA 195/65 R15 89V",
    "Apple Watch Series 10 42mm",
    "COLORES 2 GRANDES",
    "BOLSA 40X60 KG",
  ])("guards the false positive %j", (description) => {
    expect(readSize(description).kind).toBe("none");
  });
});

describe("readSize: bounds and hostile input (T-05-12, T-05-13)", () => {
  it("discards totals above 1,000 kg or L and zero sizes", () => {
    expect(shape(readSize("COSTAL 1001 KG"))).toBe("none");
    expect(shape(readSize("COSTAL 1000 KG"))).toBe("mass:1000");
    expect(shape(readSize("TANQUE 0 L"))).toBe("none");
    expect(shape(readSize("12/100 L"))).toBe("none");
    // A thousands comma is read first and the bound still applies after it.
    expect(shape(readSize("COSTAL 1,001 KG"))).toBe("none");
    expect(shape(readSize("TANQUE 2,500 L"))).toBe("none");
  });

  it("cuts the description at MAX_DESCRIPTION_LENGTH before reading", () => {
    expect(MAX_DESCRIPTION_LENGTH).toBe(300);
    const filler = "A ".repeat(200);
    expect(shape(readSize(`${filler}2KG`))).toBe("none");
    expect(shape(readSize(`2KG ${filler}`))).toBe("mass:2");
  });

  it("returns quickly on a 5,000 character hostile description", () => {
    const inputs = [
      "1".repeat(5000),
      "1 ".repeat(2500),
      "1/".repeat(2500),
      "9.".repeat(2500),
      `${"1X".repeat(2000)}KG`,
      "PZ ".repeat(1700),
      "K".repeat(5000),
    ];
    const start = performance.now();
    for (const input of inputs) readSize(input);
    expect(performance.now() - start).toBeLessThan(50);
  });
});
