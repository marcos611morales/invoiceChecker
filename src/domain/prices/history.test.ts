import Big from "big.js";
import { describe, expect, it } from "vitest";
import { makeProduct } from "../../../tests/support/pricesFactory";
import { compareProduct } from "./compare";
import { assignSlots, dayNumber, historySeries, STORE_SLOTS, type SeriesSlot } from "./history";
import type { Purchase } from "./purchases";

const PRODUCT = makeProduct("Azúcar", [{ rfc: "AAA010101AAA", descripcion: "AZUCAR", supplierName: "x" }]);

let sequence = 0;

interface Buy {
  unidad?: string;
  cantidad?: string;
  amount?: string | null;
  fecha?: string;
  folio?: string | null;
}

/** A purchase of the product at a store (default: 1 kg for 10.00). */
function buy(rfc: string, name: string, options: Buy = {}): Purchase {
  sequence += 1;
  const amount = options.amount === undefined ? "10.00" : options.amount;
  return {
    productId: PRODUCT.id,
    productName: PRODUCT.name,
    storeRfc: rfc,
    storeName: name,
    memberKey: `${rfc}\u0000azucar`,
    descripcion: "AZUCAR",
    claveProdServ: "50161800",
    claveUnidad: options.unidad ?? "KGM",
    cantidad: options.cantidad ?? "1",
    fecha: options.fecha ?? "2025-01-15T10:00:00",
    folio: options.folio === undefined ? null : options.folio,
    uuid: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    conceptIndex: 0,
    amount: amount === null ? null : new Big(amount),
  };
}

function slotsOf(stores: readonly { rfc: string; name: string }[]): ReadonlyMap<string, SeriesSlot> {
  return assignSlots(stores);
}

describe("assignSlots (stable slots by Spanish alphabetical order)", () => {
  it("orders four stores with the es collator, accents and case ignored", () => {
    const slots = assignSlots([
      { rfc: "R1", name: "Zapata" },
      { rfc: "R2", name: "Abarrotes" },
      { rfc: "R3", name: "Ñandú" },
      { rfc: "R4", name: "Bodega" },
    ]);
    expect(slots.get("R2")).toBe("tienda1");
    expect(slots.get("R4")).toBe("tienda2");
    expect(slots.get("R3")).toBe("tienda3");
    expect(slots.get("R1")).toBe("tienda4");
  });

  it("gives the six slots to six stores and folds the rest into otras", () => {
    const stores = Array.from({ length: 8 }, (_, index) => ({
      rfc: `R${String(index)}`,
      name: `Tienda ${String.fromCharCode(65 + index)}`,
    }));
    const slots = assignSlots(stores);
    expect([...slots.values()].filter((slot) => slot === "otras")).toHaveLength(2);
    expect(slots.get("R0")).toBe("tienda1");
    expect(slots.get("R5")).toBe("tienda6");
    expect(slots.get("R6")).toBe("otras");
    expect(slots.get("R7")).toBe("otras");
  });

  it("breaks equal names by the RFC order", () => {
    const slots = assignSlots([
      { rfc: "BBB", name: "Mismo" },
      { rfc: "AAA", name: "Mismo" },
    ]);
    expect(slots.get("AAA")).toBe("tienda1");
    expect(slots.get("BBB")).toBe("tienda2");
  });

  it("treats __proto__ as a plain RFC key", () => {
    const slots = assignSlots([{ rfc: "__proto__", name: "Raro" }]);
    expect(slots.get("__proto__")).toBe("tienda1");
    expect(slots.size).toBe(1);
  });

  it("exposes the six store slots in order", () => {
    expect(STORE_SLOTS).toEqual(["tienda1", "tienda2", "tienda3", "tienda4", "tienda5", "tienda6"]);
  });
});

describe("dayNumber (literal date, no time zone)", () => {
  it("is the UTC day count of the literal date", () => {
    expect(dayNumber("2025-05-28T17:38:18")).toBe(Date.UTC(2025, 4, 28) / 86_400_000);
    expect(dayNumber("2025-01-01T00:00:00")).toBe(Date.UTC(2025, 0, 1) / 86_400_000);
  });

  it("accepts the last day of a leap February and rejects an impossible one", () => {
    expect(dayNumber("2024-02-29T00:00:00")).toBe(Date.UTC(2024, 1, 29) / 86_400_000);
    expect(dayNumber("2025-02-30T00:00:00")).toBeNull();
    expect(dayNumber("2025-02-29T00:00:00")).toBeNull();
  });

  it("gives null for a month out of range or text that is not a date", () => {
    expect(dayNumber("2025-13-01")).toBeNull();
    expect(dayNumber("2025-00-10")).toBeNull();
    expect(dayNumber("junk")).toBeNull();
    expect(dayNumber("")).toBeNull();
  });

  it("advances by one for each following day", () => {
    const a = dayNumber("2025-12-31T23:59:59");
    const b = dayNumber("2026-01-01T00:00:00");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    if (a !== null && b !== null) expect(b - a).toBe(1);
  });
});

describe("historySeries", () => {
  const A = "AAA010101AAA";
  const B = "BBB010101BBB";
  const C = "CCC010101CCC";

  it("builds one date-ordered series per slot present with exact prices", () => {
    const row = compareProduct(PRODUCT, [
      buy(A, "Alfa", { fecha: "2025-03-10T10:00:00", amount: "30.00", cantidad: "2", folio: "A-2" }),
      buy(A, "Alfa", { fecha: "2025-01-05T10:00:00", amount: "10.00", folio: "A-1" }),
      buy(B, "Beta", { fecha: "2025-02-01T09:00:00", amount: "12.50" }),
    ]);
    const result = historySeries(row, slotsOf(row.stores));
    expect(result.series.map((series) => series.slot)).toEqual(["tienda1", "tienda2"]);
    const alfa = result.series[0];
    expect(alfa?.points.map((point) => point.fecha)).toEqual([
      "2025-01-05T10:00:00",
      "2025-03-10T10:00:00",
    ]);
    expect(alfa?.points.map((point) => point.price.toString())).toEqual(["10", "15"]);
    expect(alfa?.points[1]?.content.toString()).toBe("2");
    expect(alfa?.points[1]?.folio).toBe("A-2");
    expect(alfa?.points[0]?.family).toBe("mass");
    expect(alfa?.stores).toEqual([{ rfc: A, name: "Alfa" }]);
    expect(result.plotted).toBe(3);
    expect(result.excluded).toBe(0);
    expect(result.firstFecha).toBe("2025-01-05T10:00:00");
    expect(result.lastFecha).toBe("2025-03-10T10:00:00");
  });

  it("leaves out the not-normalized purchases and counts them", () => {
    const row = compareProduct(PRODUCT, [
      buy(A, "Alfa", { fecha: "2025-01-05T10:00:00" }),
      buy(B, "Beta", { fecha: "2025-01-06T10:00:00", amount: "0" }),
      buy(B, "Beta", { fecha: "2025-01-07T10:00:00", unidad: "MTR" }),
    ]);
    const result = historySeries(row, slotsOf(row.stores));
    expect(result.plotted).toBe(1);
    expect(result.excluded).toBe(2);
    expect(result.series.flatMap((series) => series.points)).toHaveLength(1);
  });

  it("reports nothing plotted for a product with no normalized purchase", () => {
    const row = compareProduct(PRODUCT, [buy(A, "Alfa", { unidad: "MTR" })]);
    const result = historySeries(row, slotsOf(row.stores));
    expect(result.series).toEqual([]);
    expect(result.plotted).toBe(0);
    expect(result.excluded).toBe(1);
    expect(result.firstFecha).toBeNull();
    expect(result.lastFecha).toBeNull();
  });

  it("sends a store missing from the slot map to otras with the other folded stores", () => {
    const row = compareProduct(PRODUCT, [
      buy(A, "Alfa"),
      buy(B, "Beta", { fecha: "2025-02-01T10:00:00" }),
      buy(C, "Gama", { fecha: "2025-01-20T10:00:00" }),
    ]);
    const slots = new Map<string, SeriesSlot>([[A, "tienda1"]]);
    const result = historySeries(row, slots);
    expect(result.series.map((series) => series.slot)).toEqual(["tienda1", "otras"]);
    const otras = result.series[1];
    expect(otras?.stores.map((store) => store.name)).toEqual(["Beta", "Gama"]);
    expect(otras?.points.map((point) => point.storeName)).toEqual(["Gama", "Beta"]);
    expect(otras?.points.every((point) => point.slot === "otras")).toBe(true);
  });

  it("keeps the slot of a surviving store when a filter hides another store", () => {
    const everything = [
      buy(A, "Alfa", { fecha: "2025-01-05T10:00:00" }),
      buy(B, "Beta", { fecha: "2025-02-05T10:00:00" }),
    ];
    const unfiltered = compareProduct(PRODUCT, everything);
    const slots = assignSlots(unfiltered.stores);
    // A date filter that hides the purchases of Alfa: only Beta survives.
    const filtered = compareProduct(PRODUCT, everything.slice(1));
    const withFilter = historySeries(filtered, slots);
    expect(withFilter.series.map((series) => series.slot)).toEqual(["tienda2"]);
    const without = historySeries(unfiltered, slots);
    expect(without.series.map((series) => series.slot)).toEqual(["tienda1", "tienda2"]);
  });

  it("orders two purchases of one day by their literal time", () => {
    const row = compareProduct(PRODUCT, [
      buy(A, "Alfa", { fecha: "2025-01-05T18:00:00", amount: "20.00" }),
      buy(A, "Alfa", { fecha: "2025-01-05T08:00:00", amount: "10.00" }),
    ]);
    const result = historySeries(row, slotsOf(row.stores));
    expect(result.series[0]?.points.map((point) => point.price.toString())).toEqual(["10", "20"]);
  });
});
