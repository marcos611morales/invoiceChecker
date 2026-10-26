import Big from "big.js";
import { describe, expect, it } from "vitest";
import { normalizeDescription, ruleMapKey } from "@/domain/settings/normalize";
import type { ContentCorrection } from "@/domain/settings/types";
import { makeProduct } from "../../../tests/support/pricesFactory";
import { compareProduct } from "./compare";
import { memberContents } from "./members";
import type { Purchase } from "./purchases";

const RFC_A = "AAA010101AAA";
const RFC_B = "BBB010101BBB";
const RFC_C = "CCC010101CCC";
const RFC_D = "DDD010101DDD";

const PRODUCT = makeProduct("Leche", [{ rfc: RFC_A, descripcion: "LECHE", supplierName: "Tienda" }]);

interface Buy {
  rfc: string;
  store?: string;
  descripcion: string;
  unidad: string;
  cantidad?: string;
  /** Net amount of the line; null is an unusable amount. */
  amount?: string | null;
  fecha?: string;
}

let sequence = 0;

function buy(options: Buy): Purchase {
  sequence += 1;
  const amount = options.amount === undefined ? "10.00" : options.amount;
  return {
    productId: PRODUCT.id,
    productName: PRODUCT.name,
    storeRfc: options.rfc,
    storeName: options.store ?? `Tienda ${options.rfc}`,
    memberKey: ruleMapKey(options.rfc, normalizeDescription(options.descripcion)),
    descripcion: options.descripcion,
    claveProdServ: "50131700",
    claveUnidad: options.unidad,
    cantidad: options.cantidad ?? "1",
    fecha: options.fecha ?? "2025-01-15T10:00:00",
    folio: null,
    uuid: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    conceptIndex: 0,
    amount: amount === null ? null : new Big(amount),
  };
}

function fix(rfc: string, descripcion: string, overrides: Partial<ContentCorrection> = {}): ContentCorrection {
  return {
    rfc,
    key: normalizeDescription(descripcion),
    description: descripcion,
    supplierName: "Tienda",
    packs: 12,
    amount: "1",
    unit: "l",
    ...overrides,
  };
}

function mapOf(...corrections: ContentCorrection[]): Map<string, ContentCorrection> {
  return new Map(corrections.map((c) => [ruleMapKey(c.rfc, c.key), c]));
}

describe("memberContents (D-13, D-14, D-28)", () => {
  // A: description reads 12 L (detected). B: unsized next to sized siblings (not normalized).
  // C: unsized but corrected. D: litres from the XML unit.
  const A = buy({ rfc: RFC_A, descripcion: "LECHE ALPURA 12/1L", unidad: "H87", cantidad: "2", amount: "100" });
  const B = buy({ rfc: RFC_B, descripcion: "LECHE BETA", unidad: "H87", cantidad: "3", amount: "90" });
  const C = buy({ rfc: RFC_C, descripcion: "LECHE GAMA", unidad: "XPK", cantidad: "1", amount: "80" });
  const D = buy({ rfc: RFC_D, descripcion: "LECHE DELTA", unidad: "LTR", cantidad: "4", amount: "70" });
  const CORRECTION = fix(RFC_C, "LECHE GAMA", { packs: 6, amount: "1", unit: "l" });
  const row = compareProduct(PRODUCT, [A, B, C, D], mapOf(CORRECTION));
  const members = memberContents(row, mapOf(CORRECTION));

  it("gives one row per member, not-normalized first, then corrected, then the rest by description", () => {
    expect(members.map((m) => [m.description, m.status])).toEqual([
      ["LECHE BETA", "not-normalized"],
      ["LECHE GAMA", "corrected"],
      ["LECHE ALPURA 12/1L", "detected"],
      ["LECHE DELTA", "xml"],
    ]);
  });

  it("explains a not-normalized member with its reason and lets it be edited", () => {
    const member = members[0];
    expect(member?.reason).toBe("unsized-with-sized-siblings");
    expect(member?.editable).toBe(true);
    expect(member?.detected).toBeNull();
    expect(member?.correction).toBeNull();
    expect(member?.purchases).toBe(1);
    expect(member?.latestCantidad).toBe("3");
    expect(member?.rfc).toBe(RFC_B);
    expect(member?.key).toBe("leche beta");
    expect(member?.memberKey).toBe(ruleMapKey(RFC_B, "leche beta"));
    expect(member?.storeName).toBe(`Tienda ${RFC_B}`);
  });

  it("exposes the correction of a corrected member", () => {
    const member = members[1];
    expect(member?.correction).toEqual(CORRECTION);
    expect(member?.reason).toBeNull();
    expect(member?.editable).toBe(true);
    expect(member?.xmlFamily).toBeNull();
  });

  it("reads the size of the description of a detected member", () => {
    const member = members[2];
    expect(member?.detected?.family).toBe("volume");
    expect(member?.detected?.amount.toString()).toBe("12");
    expect(member?.editable).toBe(true);
    expect(member?.reason).toBeNull();
  });

  it("marks a member bought in XML litres as xml, not editable, with its family", () => {
    const member = members[3];
    expect(member?.status).toBe("xml");
    expect(member?.editable).toBe(false);
    expect(member?.xmlFamily).toBe("volume");
    expect(member?.detected).toBeNull();
  });

  it("a weight-only member has the mass family", () => {
    const kg = buy({ rfc: RFC_A, descripcion: "LECHE EN POLVO", unidad: "KGM", cantidad: "2", amount: "50" });
    const result = memberContents(compareProduct(PRODUCT, [kg]), new Map());
    expect(result).toHaveLength(1);
    expect(result[0]?.xmlFamily).toBe("mass");
    expect(result[0]?.status).toBe("xml");
    expect(result[0]?.editable).toBe(false);
  });

  it("an unsized piece member of a per-piece product is unsized", () => {
    const one = buy({ rfc: RFC_A, descripcion: "LECHE SOLA", unidad: "H87", amount: "20" });
    const two = buy({ rfc: RFC_B, descripcion: "LECHE SOLA", unidad: "H87", amount: "25" });
    const result = memberContents(compareProduct(PRODUCT, [one, two]), new Map());
    expect(result.map((m) => m.status)).toEqual(["unsized", "unsized"]);
    expect(result.every((m) => m.detected === null && m.reason === null)).toBe(true);
  });

  it("counts every purchase of the member and takes the latest quantity and text", () => {
    const older = buy({
      rfc: RFC_A,
      store: "Tienda Vieja",
      descripcion: "LECHE   SOLA",
      unidad: "H87",
      cantidad: "2",
      fecha: "2025-01-10T09:00:00",
    });
    const newer = buy({
      rfc: RFC_A,
      store: "Tienda Nueva",
      descripcion: "LECHE SOLA",
      unidad: "H87",
      cantidad: "5",
      fecha: "2025-03-01T09:00:00",
    });
    const noAmount = buy({
      rfc: RFC_A,
      descripcion: "LECHE SOLA",
      unidad: "H87",
      cantidad: "7",
      amount: null,
      fecha: "2025-02-01T09:00:00",
    });
    const result = memberContents(compareProduct(PRODUCT, [older, newer, noAmount]), new Map());
    expect(result).toHaveLength(1);
    expect(result[0]?.purchases).toBe(3);
    expect(result[0]?.latestCantidad).toBe("5");
    expect(result[0]?.storeName).toBe("Tienda Nueva");
    expect(result[0]?.description).toBe("LECHE SOLA");
    // An unusable amount is not a content reason: nothing to fix with a typed content.
    expect(result[0]?.reason).toBeNull();
  });

  it("a unit with no equivalence is not-normalized and cannot be edited", () => {
    const meters = buy({ rfc: RFC_A, descripcion: "CINTA", unidad: "MTR", amount: "30" });
    const result = memberContents(compareProduct(PRODUCT, [meters]), new Map());
    expect(result[0]?.status).toBe("not-normalized");
    expect(result[0]?.reason).toBe("unit-unknown");
    expect(result[0]?.editable).toBe(false);
    expect(result[0]?.xmlFamily).toBeNull();
  });

  it("a correction on a member bought by weight is exposed but does not make it corrected", () => {
    const kg = buy({ rfc: RFC_A, descripcion: "AZUCAR", unidad: "KGM", cantidad: "2", amount: "50" });
    const stale = fix(RFC_A, "AZUCAR");
    const result = memberContents(compareProduct(PRODUCT, [kg], mapOf(stale)), mapOf(stale));
    expect(result[0]?.status).toBe("xml");
    expect(result[0]?.correction).toEqual(stale);
    expect(result[0]?.editable).toBe(false);
  });

  it("a member with a weight line and a piece line is editable, not xml-only", () => {
    const kg = buy({ rfc: RFC_A, descripcion: "QUESO", unidad: "KGM", cantidad: "1", amount: "50" });
    const pz = buy({ rfc: RFC_A, descripcion: "QUESO", unidad: "H87", cantidad: "2", amount: "60" });
    const result = memberContents(compareProduct(PRODUCT, [kg, pz]), new Map());
    expect(result).toHaveLength(1);
    expect(result[0]?.editable).toBe(true);
    expect(result[0]?.xmlFamily).toBeNull();
  });

  it("orders members of the same rank by description with the Spanish collator", () => {
    const names = ["ZETA", "ÁLAMO", "BETA"];
    const purchases = names.map((name, index) =>
      buy({ rfc: `R${index}`, descripcion: `LECHE ${name}`, unidad: "LTR", amount: "10" }),
    );
    const result = memberContents(compareProduct(PRODUCT, purchases), new Map());
    expect(result.map((m) => m.description)).toEqual(["LECHE ÁLAMO", "LECHE BETA", "LECHE ZETA"]);
  });

  it("an empty row has no members", () => {
    expect(memberContents(compareProduct(PRODUCT, []), new Map())).toEqual([]);
  });
});
