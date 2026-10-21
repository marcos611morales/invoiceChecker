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
import { LIMITS, SIN_CATEGORIA, type Product, type SettingsData, type UngroupedConcept } from "./types";

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
    products: [],
    ungroupedConcepts: [],
  };
}

const LECHE_KEY = "leche entera 1 l";

/** Settings with two products (one without category) and one «No agrupar» mark. */
function sampleWithProducts(): SettingsData {
  return {
    ...sample(),
    products: [
      {
        id: "prod_leche",
        name: "Leche entera",
        categoryId: CAFE,
        members: [
          { rfc: "EKU9003173C9", key: LECHE_KEY, description: "Leche entera 1 L", supplierName: "Proveedor uno" },
          { rfc: "XAXX010101000", key: "leche ent 12 pz", description: "Leche ENT 12 pz", supplierName: "Público en general" },
        ],
      },
      {
        id: "prod_vasos",
        name: "Vasos desechables",
        categoryId: null,
        members: [
          { rfc: "EKU9003173C9", key: "vaso 12 oz", description: "Vaso 12 oz", supplierName: "Proveedor uno" },
        ],
      },
    ],
    ungroupedConcepts: [
      { rfc: "XAXX010101000", key: "renta de salon", description: "Renta de salón", supplierName: "Público en general" },
    ],
  };
}

/** A version-1 file text built by hand, so these tests do not depend on buildBackupText. */
function fileText(settings: unknown, header: Record<string, unknown> = {}): string {
  return JSON.stringify({ app: BACKUP_APP, version: 1, settings, ...header });
}

/** A version-2 file text built by hand, so these tests do not depend on buildBackupText. */
function fileText2(settings: unknown, header: Record<string, unknown> = {}): string {
  return JSON.stringify({ app: BACKUP_APP, version: 2, settings, ...header });
}

function failure(text: string): string | null {
  const result = parseBackupText(text);
  return result.ok ? null : result.reason;
}

describe("backup file contract constants", () => {
  it("publishes the app marker and file version 2", () => {
    expect(BACKUP_APP).toBe("invoicechecker-settings");
    expect(BACKUP_FILE_VERSION).toBe(2);
  });
});

describe("buildBackupText and parseBackupText round trip", () => {
  it("parses back into deep-equal settings with the summary equal to the array lengths", () => {
    const settings = sample();
    const result = parseBackupText(buildBackupText(settings));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings).toEqual(settings);
    expect(result.summary).toEqual({
      categories: 2,
      suppliers: 2,
      concepts: 2,
      products: 0,
      members: 0,
    });
  });

  it("gives back equal settings with products and «No agrupar» marks, and counts them in the summary", () => {
    const settings = sampleWithProducts();
    const result = parseBackupText(buildBackupText(settings));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings).toEqual(settings);
    expect(result.summary).toEqual({
      categories: 2,
      suppliers: 2,
      concepts: 2,
      products: 2,
      members: 3,
    });
  });

  it("writes file version 2", () => {
    const parsed: unknown = JSON.parse(buildBackupText(sample()));
    expect(parsed).toMatchObject({ app: BACKUP_APP, version: 2 });
  });

  it("writes only app, version and settings, and only the six settings fields (T-04-24)", () => {
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
      "products",
      "supplierCategories",
      "ungroupedConcepts",
    ]);
  });

  it("writes only the stored fields of each product, member and mark, even if the objects carry more", () => {
    const settings = sampleWithProducts();
    const noisy: SettingsData = {
      ...settings,
      products: settings.products.map((product) => ({
        ...product,
        monto: 123,
        members: product.members.map((member) => ({ ...member, uuid: "no-debe-salir" })),
      })),
      ungroupedConcepts: settings.ungroupedConcepts.map((mark) => ({ ...mark, folio: "A-1" })),
    };
    const text = buildBackupText(noisy);
    expect(text).not.toContain("monto");
    expect(text).not.toContain("no-debe-salir");
    expect(text).not.toContain("folio");
    const parsed = parseBackupText(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.settings).toEqual(settings);
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
      products: [],
      ungroupedConcepts: [],
    };
    const result = parseBackupText(buildBackupText(empty));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings).toEqual(empty);
    expect(result.summary).toEqual({
      categories: 0,
      suppliers: 0,
      concepts: 0,
      products: 0,
      members: 0,
    });
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
  it("accepts exactly 4 MB (4,194,304 bytes) and rejects one byte more (D-31)", () => {
    expect(checkBackupSize(4194304)).toBeNull();
    expect(checkBackupSize(4194305)).toBe("too-large");
  });

  it("no longer refuses a file between 1 MB and 4 MB", () => {
    expect(checkBackupSize(1048577)).toBeNull();
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
    expect(failure(fileText(sample(), { version: 3 }))).toBe("newer");
    expect(failure(fileText("cualquier cosa", { version: 3 }))).toBe("newer");
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
    expect(result.summary).toEqual({
      categories: 3,
      suppliers: 2,
      concepts: 2,
      products: 0,
      members: 0,
    });
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

  it("loads with no products and no «No agrupar» marks (D-13)", () => {
    const text = readFileSync(
      resolve(process.cwd(), "tests/fixtures/settings/ajustes-archivo-1.json"),
      "utf8",
    );
    const result = parseBackupText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.products).toEqual([]);
    expect(result.settings.ungroupedConcepts).toEqual([]);
  });

  it("loads a version-1 file written by the previous build even when this build writes version 2", () => {
    const result = parseBackupText(fileText(sample()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings).toEqual(sample());
    expect(result.summary.products).toBe(0);
    expect(result.summary.members).toBe(0);
  });
});

describe("golden settings file of version 2 (published contract, D-13)", () => {
  const goldenText = () =>
    readFileSync(resolve(process.cwd(), "tests/fixtures/settings/ajustes-archivo-2.json"), "utf8");

  it("keeps loading with its products, members and marks", () => {
    const result = parseBackupText(goldenText());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary).toEqual({
      categories: 3,
      suppliers: 2,
      concepts: 1,
      products: 2,
      members: 3,
    });
    expect(result.settings.ivaMode).toBe("con");
    expect(result.settings.products.map((product) => product.name)).toEqual([
      "Leche entera",
      "Vasos desechables",
    ]);
    expect(result.settings.products.map((product) => product.categoryId)).toEqual([
      "seed:insumos-cafeteria",
      null,
    ]);
    expect(result.settings.products[0]?.members.map((member) => member.rfc)).toEqual([
      "EKU9003173C9",
      "XAXX010101000",
    ]);
    expect(result.settings.ungroupedConcepts.map((mark) => mark.key)).toEqual(["renta de salon"]);
  });

  it("is declared as file version 2 and survives writing and reading again", () => {
    expect(JSON.parse(goldenText())).toMatchObject({ app: BACKUP_APP, version: 2 });
    const first = parseBackupText(goldenText());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = parseBackupText(buildBackupText(first.settings));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.settings).toEqual(first.settings);
  });
});

describe("parseBackupText: version-2 files that break a rule are damaged", () => {
  const withSettings = (change: (settings: SettingsData) => Partial<SettingsData>): string =>
    fileText2({ ...sampleWithProducts(), ...change(sampleWithProducts()) });

  it("accepts the unchanged version-2 sample", () => {
    expect(failure(withSettings(() => ({})))).toBeNull();
  });

  it("rejects a version-2 file without the products or the marks field", () => {
    const { products: _products, ...withoutProducts } = sampleWithProducts();
    const { ungroupedConcepts: _marks, ...withoutMarks } = sampleWithProducts();
    expect(failure(fileText2(withoutProducts))).toBe("damaged");
    expect(failure(fileText2(withoutMarks))).toBe("damaged");
  });

  it("rejects a product that points at a missing category", () => {
    expect(
      failure(
        withSettings((settings) => ({
          products: settings.products.map((product) => ({ ...product, categoryId: "cat_no-existe" })),
        })),
      ),
    ).toBe("damaged");
  });

  it("rejects a repeated product name, ignoring case and edge spaces", () => {
    expect(
      failure(
        withSettings((settings) => ({
          products: settings.products.map((product) => ({ ...product, name: "  LECHE entera " })),
        })),
      ),
    ).toBe("damaged");
  });

  it("rejects «Sin categoría» as a product name", () => {
    expect(
      failure(
        withSettings((settings) => ({
          products: settings.products.map((product, index) =>
            index === 0 ? { ...product, name: "sin CATEGORÍA" } : product,
          ),
        })),
      ),
    ).toBe("damaged");
  });

  it("rejects a repeated product id", () => {
    expect(
      failure(
        withSettings((settings) => ({
          products: settings.products.map((product) => ({ ...product, id: "prod_igual" })),
        })),
      ),
    ).toBe("damaged");
  });

  it("rejects a product without members", () => {
    expect(
      failure(
        withSettings((settings) => ({
          products: settings.products.map((product, index) =>
            index === 0 ? { ...product, members: [] } : product,
          ),
        })),
      ),
    ).toBe("damaged");
  });

  it("rejects one member that sits in two products", () => {
    expect(
      failure(
        withSettings((settings) => {
          const shared = settings.products[0]?.members[0];
          return {
            products: settings.products.map((product, index) =>
              index === 1 && shared !== undefined
                ? { ...product, members: [...product.members, shared] }
                : product,
            ),
          };
        }),
      ),
    ).toBe("damaged");
  });

  it("rejects a «No agrupar» mark that is also a member", () => {
    expect(
      failure(
        withSettings((settings) => {
          const member = settings.products[0]?.members[0];
          return {
            ungroupedConcepts: member === undefined ? [] : [{ ...member }],
          };
        }),
      ),
    ).toBe("damaged");
  });

  it("rejects a repeated «No agrupar» mark", () => {
    expect(
      failure(
        withSettings((settings) => ({
          ungroupedConcepts: [...settings.ungroupedConcepts, ...settings.ungroupedConcepts],
        })),
      ),
    ).toBe("damaged");
  });

  it("rejects a product name longer than 60 characters and accepts 60", () => {
    const named = (name: string) =>
      withSettings((settings) => ({
        products: settings.products.map((product, index) =>
          index === 0 ? { ...product, name } : product,
        ),
      }));
    expect(failure(named("a".repeat(61)))).toBe("damaged");
    expect(failure(named("a".repeat(60)))).toBeNull();
  });
});

describe("parseBackupText: version-2 limits (D-13, T-04-22)", () => {
  function product(index: number, memberCount: number): Product {
    return {
      id: `prod_${String(index)}`,
      name: `Producto ${String(index)}`,
      categoryId: null,
      members: Array.from({ length: memberCount }, (_, member) => ({
        rfc: "EKU9003173C9",
        key: `concepto ${String(index)} ${String(member)}`,
        description: `Concepto ${String(index)} ${String(member)}`,
        supplierName: "Proveedor",
      })),
    };
  }

  function marks(count: number): UngroupedConcept[] {
    return Array.from({ length: count }, (_, index) => ({
      rfc: "EKU9003173C9",
      key: `marca ${String(index)}`,
      description: `Marca ${String(index)}`,
      supplierName: "Proveedor",
    }));
  }

  it("accepts exactly 2,000 products and rejects 2,001", () => {
    const build = (count: number) =>
      fileText2({
        ...sample(),
        products: Array.from({ length: count }, (_, index) => product(index, 1)),
      });
    expect(failure(build(LIMITS.products))).toBeNull();
    expect(failure(build(LIMITS.products + 1))).toBe("damaged");
  });

  it("accepts exactly 5,000 members and rejects 5,001", () => {
    const build = (total: number) => fileText2({ ...sample(), products: [product(0, total)] });
    expect(failure(build(LIMITS.productMembers))).toBeNull();
    expect(failure(build(LIMITS.productMembers + 1))).toBe("damaged");
  });

  it("accepts exactly 5,000 marks and rejects 5,001", () => {
    const build = (count: number) => fileText2({ ...sample(), ungroupedConcepts: marks(count) });
    expect(failure(build(LIMITS.ungroupedConcepts))).toBeNull();
    expect(failure(build(LIMITS.ungroupedConcepts + 1))).toBe("damaged");
  });

  it("a settings value at the product limits with sample-sized texts fits under the 4 MB gate (D-31)", () => {
    const categories = Array.from({ length: 9 }, (_, index) => ({
      id: `cat_${String(index).padStart(36, "0")}`,
      name: `Categoría ${String(index)}`,
    }));
    const firstCategoryId = categories[0]?.id ?? "";
    const supplierCategories = Array.from({ length: 39 }, (_, index) => ({
      rfc: `RFC${String(index).padStart(10, "0")}`,
      name: "N".repeat(25),
      categoryId: firstCategoryId,
    }));
    const text40 = (label: string, index: number) => `${label}${String(index)}`.padEnd(40, "x");
    const base = Math.floor(LIMITS.productMembers / LIMITS.products);
    const extra = LIMITS.productMembers - base * LIMITS.products;
    const products: Product[] = Array.from({ length: LIMITS.products }, (_, index) => ({
      id: `prod_${String(index).padStart(36, "0")}`,
      name: `P${String(index)}`.padEnd(30, "p"),
      categoryId: firstCategoryId,
      members: Array.from({ length: base + (index < extra ? 1 : 0) }, (_, member) => ({
        rfc: "R".repeat(13),
        key: text40("k", index * 10 + member),
        description: text40("d", index * 10 + member),
        supplierName: "S".repeat(25),
      })),
    }));
    const ungroupedConcepts: UngroupedConcept[] = Array.from(
      { length: LIMITS.ungroupedConcepts },
      (_, index) => ({
        rfc: "R".repeat(13),
        key: text40("m", index),
        description: text40("n", index),
        supplierName: "S".repeat(25),
      }),
    );
    const settings: SettingsData = {
      ivaMode: "con",
      categories,
      supplierCategories,
      conceptRules: [],
      products,
      ungroupedConcepts,
    };
    const text = buildBackupText(settings);
    const bytes = Buffer.byteLength(text, "utf8");
    expect(products.reduce((sum, item) => sum + item.members.length, 0)).toBe(LIMITS.productMembers);
    expect(bytes).toBeLessThan(4194304);
    expect(checkBackupSize(bytes)).toBeNull();
    const result = parseBackupText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.products).toBe(LIMITS.products);
    expect(result.summary.members).toBe(LIMITS.productMembers);
  });
});

describe("LIMITS.backupBytes (D-31)", () => {
  it("is 4,194,304 bytes", () => {
    expect(LIMITS.backupBytes).toBe(4194304);
  });
});
