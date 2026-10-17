import { describe, expect, it } from "vitest";
import {
  removeSupplierAssignment,
  restoreSupplierAssignment,
  supplierTableRows,
} from "./assignments";
import { LIMITS, defaultSettings, type SettingsData } from "./types";

const LIMPIEZA = "seed:limpieza-higiene";
const SERVICIOS = "seed:servicios";

function withAssignments(
  assignments: SettingsData["supplierCategories"],
): SettingsData {
  return { ...defaultSettings(), supplierCategories: assignments };
}

describe("supplierTableRows (D-03)", () => {
  it("gives a row per loaded supplier plus one per saved assignment with no loaded invoice", () => {
    const settings = withAssignments([
      { rfc: "AAA010101AAA", name: "Nombre guardado A", categoryId: LIMPIEZA },
      { rfc: "CCC010101CCC", name: "Proveedor C", categoryId: SERVICIOS },
    ]);
    const rows = supplierTableRows(
      [
        { key: "AAA010101AAA", label: "Proveedor A", count: 3 },
        { key: "BBB010101BBB", label: "Proveedor B", count: 1 },
      ],
      settings,
    );
    expect(rows).toEqual([
      { rfc: "AAA010101AAA", name: "Proveedor A", invoices: 3, categoryId: LIMPIEZA, loaded: true },
      { rfc: "BBB010101BBB", name: "Proveedor B", invoices: 1, categoryId: null, loaded: true },
      { rfc: "CCC010101CCC", name: "Proveedor C", invoices: 0, categoryId: SERVICIOS, loaded: false },
    ]);
  });

  it("does not duplicate a saved assignment whose supplier is loaded and shows the loaded name", () => {
    const settings = withAssignments([
      { rfc: "AAA010101AAA", name: "Nombre viejo", categoryId: LIMPIEZA },
    ]);
    const rows = supplierTableRows([{ key: "AAA010101AAA", label: "Nombre actual", count: 2 }], settings);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Nombre actual", loaded: true, categoryId: LIMPIEZA });
  });

  it("gives only saved-only rows when nothing is loaded", () => {
    const settings = withAssignments([
      { rfc: "CCC010101CCC", name: "Proveedor C", categoryId: SERVICIOS },
    ]);
    expect(supplierTableRows([], settings)).toEqual([
      { rfc: "CCC010101CCC", name: "Proveedor C", invoices: 0, categoryId: SERVICIOS, loaded: false },
    ]);
  });
});

describe("removeSupplierAssignment", () => {
  it("returns the removed assignment and settings without it", () => {
    const assignment = { rfc: "AAA010101AAA", name: "Proveedor A", categoryId: LIMPIEZA };
    const other = { rfc: "BBB010101BBB", name: "Proveedor B", categoryId: SERVICIOS };
    const settings = withAssignments([assignment, other]);
    const result = removeSupplierAssignment(settings, "AAA010101AAA");
    expect(result.removed).toEqual(assignment);
    expect(result.next.supplierCategories).toEqual([other]);
    expect(settings.supplierCategories).toHaveLength(2);
  });

  it("returns the same settings and null when there is no assignment", () => {
    const settings = defaultSettings();
    const result = removeSupplierAssignment(settings, "ZZZ010101ZZZ");
    expect(result.removed).toBeNull();
    expect(result.next).toBe(settings);
  });
});

describe("restoreSupplierAssignment", () => {
  const removed = { rfc: "AAA010101AAA", name: "Proveedor A", categoryId: LIMPIEZA };

  it("puts the removed assignment back unchanged", () => {
    const { next } = removeSupplierAssignment(withAssignments([removed]), removed.rfc);
    const restored = restoreSupplierAssignment(next, removed);
    expect(restored.supplierCategories).toEqual([removed]);
  });

  it("replaces an assignment of the same RFC made in the meantime", () => {
    const meanwhile = { rfc: removed.rfc, name: "Otro nombre", categoryId: SERVICIOS };
    const restored = restoreSupplierAssignment(withAssignments([meanwhile]), removed);
    expect(restored.supplierCategories).toEqual([removed]);
  });

  it("leaves the settings unchanged when the category no longer exists", () => {
    const settings = defaultSettings();
    const gone = { ...removed, categoryId: "cat_borrada" };
    expect(restoreSupplierAssignment(settings, gone)).toBe(settings);
  });

  it("leaves the settings unchanged when appending would pass the limit", () => {
    const full = withAssignments(
      Array.from({ length: LIMITS.supplierCategories }, (_, index) => ({
        rfc: `RFC${String(index)}`,
        name: `Proveedor ${String(index)}`,
        categoryId: LIMPIEZA,
      })),
    );
    expect(restoreSupplierAssignment(full, removed)).toBe(full);
  });
});
