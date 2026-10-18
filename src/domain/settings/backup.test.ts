import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BACKUP_APP,
  BACKUP_FILE_VERSION,
  backupFileName,
  buildBackupText,
  checkBackupSize,
  parseBackupText,
} from "./backup";
import { SIN_CATEGORIA, type SettingsData } from "./types";

const CAFE = "seed:insumos-cafeteria";
const CUSTOM = "cat_0b6a8f10-4c1d-4e0a-9b52-7a3f6d2e1c44";

function sample(): SettingsData {
  return {
    ivaMode: "sin",
    categories: [
      { id: CAFE, name: "Insumos de cafetería" },
      { id: CUSTOM, name: "Eventos" },
    ],
    supplierCategories: [
      { rfc: "EKU9003173C9", name: "Proveedor uno", categoryId: CAFE },
      { rfc: "XAXX010101000", name: "Público en general", categoryId: CUSTOM },
    ],
    conceptRules: [
      { rfc: "EKU9003173C9", key: "leche", description: "Leche", categoryId: CUSTOM },
      { rfc: "XAXX010101000", key: "renta", description: "Renta", categoryId: null },
    ],
  };
}

/** A version-1 file text built by hand, so these tests do not depend on buildBackupText. */
function fileText(settings: unknown, header: Record<string, unknown> = {}): string {
  return JSON.stringify({ app: BACKUP_APP, version: 1, settings, ...header });
}

function failure(text: string): string | null {
  const result = parseBackupText(text);
  return result.ok ? null : result.reason;
}

describe("backup file contract constants", () => {
  it("publishes the app marker and file version 1", () => {
    expect(BACKUP_APP).toBe("invoicechecker-settings");
    expect(BACKUP_FILE_VERSION).toBe(1);
  });
});

describe("buildBackupText and parseBackupText round trip", () => {
  it("parses back into deep-equal settings with the summary equal to the array lengths", () => {
    const settings = sample();
    const result = parseBackupText(buildBackupText(settings));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings).toEqual(settings);
    expect(result.summary).toEqual({ categories: 2, suppliers: 2, concepts: 2 });
  });

  it("writes only app, version and settings, and only the four settings fields", () => {
    const parsed: unknown = JSON.parse(buildBackupText(sample()));
    expect(typeof parsed === "object" && parsed !== null).toBe(true);
    if (typeof parsed !== "object" || parsed === null) return;
    expect(Object.keys(parsed).sort()).toEqual(["app", "settings", "version"]);
    const settings: unknown = Reflect.get(parsed, "settings");
    expect(typeof settings === "object" && settings !== null).toBe(true);
    if (typeof settings !== "object" || settings === null) return;
    expect(Object.keys(settings).sort()).toEqual([
      "categories",
      "conceptRules",
      "ivaMode",
      "supplierCategories",
    ]);
  });

  it("writes only the stored fields of each entry, even if the object carries more", () => {
    const settings = sample();
    const noisy: SettingsData = {
      ...settings,
      categories: settings.categories.map((category) => ({ ...category, monto: 123 })),
    };
    const text = buildBackupText(noisy);
    expect(text).not.toContain("monto");
  });

  it("indents with two spaces", () => {
    expect(buildBackupText(sample())).toContain('\n  "app": "invoicechecker-settings"');
  });

  it("round-trips an empty settings value", () => {
    const empty: SettingsData = {
      ivaMode: "con",
      categories: [],
      supplierCategories: [],
      conceptRules: [],
    };
    const result = parseBackupText(buildBackupText(empty));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings).toEqual(empty);
    expect(result.summary).toEqual({ categories: 0, suppliers: 0, concepts: 0 });
  });
});

describe("backupFileName", () => {
  it("pads the month and the day", () => {
    expect(backupFileName({ year: 2026, month: 10, day: 6 })).toBe(
      "invoicechecker-ajustes-2026-10-06.json",
    );
  });

  it("keeps two-digit parts as they are", () => {
    expect(backupFileName({ year: 2027, month: 12, day: 31 })).toBe(
      "invoicechecker-ajustes-2027-12-31.json",
    );
  });
});

describe("checkBackupSize (T-03-16)", () => {
  it("accepts exactly 1 MB and rejects one byte more", () => {
    expect(checkBackupSize(1048576)).toBeNull();
    expect(checkBackupSize(1048577)).toBe("too-large");
  });

  it("accepts an empty file", () => {
    expect(checkBackupSize(0)).toBeNull();
  });
});

describe("parseBackupText: not an InvoiceChecker settings file", () => {
  it("rejects plain text", () => {
    expect(failure("hola")).toBe("not-invoicechecker");
  });

  it("rejects PDF-like text", () => {
    expect(failure("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj")).toBe("not-invoicechecker");
  });

  it("rejects an empty text", () => {
    expect(failure("")).toBe("not-invoicechecker");
  });

  it("rejects JSON that is not an object", () => {
    expect(failure("[1,2,3]")).toBe("not-invoicechecker");
    expect(failure("null")).toBe("not-invoicechecker");
    expect(failure('"texto"')).toBe("not-invoicechecker");
  });

  it("rejects a JSON object without the app marker", () => {
    expect(failure(JSON.stringify({ version: 1, settings: sample() }))).toBe("not-invoicechecker");
  });

  it("rejects another app", () => {
    expect(failure(JSON.stringify({ app: "otra-app", version: 1, settings: sample() }))).toBe(
      "not-invoicechecker",
    );
  });

  it("rejects version 0, a string version and a fractional version", () => {
    expect(failure(fileText(sample(), { version: 0 }))).toBe("not-invoicechecker");
    expect(failure(fileText(sample(), { version: "1" }))).toBe("not-invoicechecker");
    expect(failure(fileText(sample(), { version: 1.5 }))).toBe("not-invoicechecker");
  });
});

describe("parseBackupText: newer version", () => {
  it("reports a newer version whatever the rest contains", () => {
    expect(failure(fileText(sample(), { version: 2 }))).toBe("newer");
    expect(failure(fileText("cualquier cosa", { version: 2 }))).toBe("newer");
    expect(failure(JSON.stringify({ app: BACKUP_APP, version: 99 }))).toBe("newer");
  });
});

describe("parseBackupText: damaged or incomplete", () => {
  it("rejects a truncated InvoiceChecker file", () => {
    const whole = buildBackupText(sample());
    expect(whole.length).toBeGreaterThan(40);
    expect(failure(whole.slice(0, Math.floor(whole.length / 2)))).toBe("damaged");
  });

  it("rejects a version-1 file without settings", () => {
    expect(failure(JSON.stringify({ app: BACKUP_APP, version: 1 }))).toBe("damaged");
  });

  it("rejects a wrong ivaMode", () => {
    expect(failure(fileText({ ...sample(), ivaMode: "tal vez" }))).toBe("damaged");
  });

  it("rejects 201 categories", () => {
    const categories = Array.from({ length: 201 }, (_, index) => ({
      id: `cat_${String(index)}`,
      name: `Categoría ${String(index)}`,
    }));
    expect(
      failure(fileText({ ...sample(), categories, supplierCategories: [], conceptRules: [] })),
    ).toBe("damaged");
  });

  it("accepts exactly 200 categories", () => {
    const categories = Array.from({ length: 200 }, (_, index) => ({
      id: `cat_${String(index)}`,
      name: `Categoría ${String(index)}`,
    }));
    expect(
      failure(fileText({ ...sample(), categories, supplierCategories: [], conceptRules: [] })),
    ).toBeNull();
  });

  it("rejects a 61-character category name and accepts 60", () => {
    const withName = (name: string) =>
      fileText({
        ...sample(),
        categories: [{ id: CAFE, name }],
        supplierCategories: [],
        conceptRules: [],
      });
    expect(failure(withName("a".repeat(61)))).toBe("damaged");
    expect(failure(withName("a".repeat(60)))).toBeNull();
  });

  it("rejects a category name repeated ignoring case and edge spaces", () => {
    expect(
      failure(
        fileText({
          ...sample(),
          categories: [
            { id: CAFE, name: "Limpieza" },
            { id: CUSTOM, name: "  LIMPIEZA " },
          ],
          supplierCategories: [],
          conceptRules: [],
        }),
      ),
    ).toBe("damaged");
  });

  it("rejects «Sin categoría» as a name, in any case", () => {
    expect(
      failure(
        fileText({
          ...sample(),
          categories: [{ id: CAFE, name: "sin CATEGORÍA" }],
          supplierCategories: [],
          conceptRules: [],
        }),
      ),
    ).toBe("damaged");
  });

  it("rejects a category id equal to the reserved key", () => {
    expect(
      failure(
        fileText({
          ...sample(),
          categories: [{ id: SIN_CATEGORIA, name: "Algo" }],
          supplierCategories: [],
          conceptRules: [],
        }),
      ),
    ).toBe("damaged");
  });

  it("rejects a repeated category id", () => {
    expect(
      failure(
        fileText({
          ...sample(),
          categories: [
            { id: CAFE, name: "Uno" },
            { id: CAFE, name: "Dos" },
          ],
          supplierCategories: [],
          conceptRules: [],
        }),
      ),
    ).toBe("damaged");
  });

  it("rejects a supplier assignment to a missing category id", () => {
    expect(
      failure(
        fileText({
          ...sample(),
          supplierCategories: [{ rfc: "EKU9003173C9", name: "Uno", categoryId: "cat_no-existe" }],
        }),
      ),
    ).toBe("damaged");
  });

  it("rejects a repeated supplier RFC", () => {
    expect(
      failure(
        fileText({
          ...sample(),
          supplierCategories: [
            { rfc: "EKU9003173C9", name: "Uno", categoryId: CAFE },
            { rfc: "EKU9003173C9", name: "Uno otra vez", categoryId: CUSTOM },
          ],
        }),
      ),
    ).toBe("damaged");
  });

  it("rejects a concept rule to a missing category and a repeated rfc plus key", () => {
    const rule = { rfc: "EKU9003173C9", key: "leche", description: "Leche", categoryId: CAFE };
    expect(
      failure(fileText({ ...sample(), conceptRules: [{ ...rule, categoryId: "cat_no-existe" }] })),
    ).toBe("damaged");
    expect(failure(fileText({ ...sample(), conceptRules: [rule, rule] }))).toBe("damaged");
  });
});

describe("parseBackupText: forward compatibility and hostile text", () => {
  it("ignores unknown extra keys inside a version-1 file and still loads", () => {
    const settings = sample();
    const text = JSON.stringify({
      app: BACKUP_APP,
      version: 1,
      extraTopLevel: { cualquier: "cosa" },
      settings: {
        ...settings,
        productosAgrupados: [{ id: "x" }],
        categories: settings.categories.map((category) => ({ ...category, color: "rojo" })),
      },
    });
    const result = parseBackupText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings).toEqual(settings);
  });

  it("loads a supplier RFC \"__proto__\" as plain data", () => {
    const settings: SettingsData = {
      ...sample(),
      supplierCategories: [{ rfc: "__proto__", name: "constructor", categoryId: CAFE }],
      conceptRules: [{ rfc: "__proto__", key: "__proto__", description: "x", categoryId: CAFE }],
    };
    const result = parseBackupText(buildBackupText(settings));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.supplierCategories[0]?.rfc).toBe("__proto__");
    expect(result.settings.conceptRules[0]?.key).toBe("__proto__");
    expect(Reflect.get(Object.prototype, "polluted")).toBeUndefined();
  });
});

describe("golden settings file of version 1 (published contract, D-07)", () => {
  it("keeps loading with its expected content", () => {
    const text = readFileSync(
      resolve(process.cwd(), "tests/fixtures/settings/ajustes-archivo-1.json"),
      "utf8",
    );
    const result = parseBackupText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary).toEqual({ categories: 3, suppliers: 2, concepts: 2 });
    expect(result.settings.ivaMode).toBe("sin");
    expect(result.settings.categories.map((category) => category.id)).toEqual([
      "seed:insumos-cafeteria",
      "seed:otros",
      "cat_6f1d2c58-3b0e-4a7f-9c21-0d8e5a4b7c13",
    ]);
    expect(result.settings.supplierCategories.map((assignment) => assignment.rfc)).toEqual([
      "EKU9003173C9",
      "XAXX010101000",
    ]);
    expect(result.settings.conceptRules.map((rule) => rule.categoryId)).toEqual(["seed:otros", null]);
  });
});
