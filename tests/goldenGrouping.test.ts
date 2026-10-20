import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { groupRequestSchema } from "@/domain/llm/contract";
import { evaluateGolden, goldenSetSchema, type GoldenSet } from "./support/goldenGrouping";

function loadGolden(): GoldenSet {
  const raw: unknown = JSON.parse(
    readFileSync(resolve(process.cwd(), "tests/fixtures/llm/golden-grouping.json"), "utf8"),
  );
  return goldenSetSchema.parse(raw);
}

const golden = loadGolden();

/** The id of the golden item with exactly this description. */
function idOf(description: string): string {
  const item = golden.items.find((candidate) => candidate.description === description);
  if (item === undefined) throw new Error(`golden item not found: ${description}`);
  return item.id;
}

interface Answer {
  name: string;
  ids: string[];
}

/** A perfect answer: every MUST pair together, every MUST-NOT pair apart, all SHOULD pairs together. */
function perfectAnswer(): Answer[] {
  return [
    { name: "Leche entera", ids: [idOf("MM LECHE ENT"), idOf("LECHE ENTERA 1L")] },
    {
      name: "Leche deslactosada",
      ids: [idOf("MM LECHE DES"), idOf("LECHE DESL L"), idOf("Leche LacDel Desla")],
    },
    { name: "Leche evaporada", ids: [idOf("Leche Evaporada Ne")] },
    { name: "Leche condensada", ids: [idOf("LECHERA 375G"), idOf("La Leche Orig 375g")] },
    { name: "Queso manchego", ids: [idOf("1K MANCHEGO"), idOf("QSO MANCHEGO")] },
    {
      name: "Jamón Zwan",
      ids: [idOf("JAMON ZWAN"), idOf("JAMON ZWAN VIRGINIA1X1KG & 10360 1/1 KG")],
    },
    { name: "Jamón serrano", ids: [idOf("MM JAMONSERR")] },
    { name: "Pago", ids: [idOf("Pago")] },
  ];
}

describe("the golden grouping fixture", () => {
  it("parses with goldenSetSchema", () => {
    expect(golden.items.length).toBeGreaterThanOrEqual(14);
    expect(golden.mustGroup.length).toBe(2);
  });

  it("is a valid grouping request, so the live run sends exactly what the route accepts", () => {
    expect(groupRequestSchema.safeParse({ items: golden.items, existing: [] }).success).toBe(true);
  });

  it("names only synthetic suppliers", () => {
    const suppliers = new Set(golden.items.map((item) => item.supplier));
    expect([...suppliers].sort()).toEqual(["Supermercado A", "Tienda B", "Tienda C", "Tienda D"]);
  });

  it("puts the JAMON ZWAN pair and the leche entera pair at different suppliers (D-32)", () => {
    const supplierOf = (description: string) =>
      golden.items.find((item) => item.description === description)?.supplier;
    expect(supplierOf("JAMON ZWAN")).not.toBe(
      supplierOf("JAMON ZWAN VIRGINIA1X1KG & 10360 1/1 KG"),
    );
    expect(supplierOf("MM LECHE ENT")).not.toBe(supplierOf("LECHE ENTERA 1L"));
  });

  it("rejects a case that names an id that is not an item", () => {
    const broken = { ...golden, mustGroup: [["i1", "i999"]] };
    expect(goldenSetSchema.safeParse(broken).success).toBe(false);
  });
});

describe("evaluateGolden", () => {
  it("reports nothing wrong for a perfect answer", () => {
    const report = evaluateGolden(golden, perfectAnswer());
    expect(report.coverage).toEqual({ missing: [], unknown: [], duplicated: [] });
    expect(report.mustGroupMissed).toEqual([]);
    expect(report.mustNotViolated).toEqual([]);
    expect(report.nameProblems).toEqual([]);
    expect(report.shouldGroupHit).toBe(3);
    expect(report.shouldGroupTotal).toBe(3);
  });

  it("reports the JAMON ZWAN pair as missed when the answer splits it (D-32)", () => {
    const answer = perfectAnswer().filter((group) => group.name !== "Jamón Zwan");
    answer.push(
      { name: "Jamón Zwan", ids: [idOf("JAMON ZWAN")] },
      { name: "Jamón Zwan Virginia", ids: [idOf("JAMON ZWAN VIRGINIA1X1KG & 10360 1/1 KG")] },
    );
    const report = evaluateGolden(golden, answer);
    expect(report.mustGroupMissed).toEqual([
      [idOf("JAMON ZWAN"), idOf("JAMON ZWAN VIRGINIA1X1KG & 10360 1/1 KG")],
    ]);
    expect(report.coverage.missing).toEqual([]);
  });

  it("reports the leche entera pair as missed when one of its ids is not grouped with the other", () => {
    const answer = perfectAnswer().map((group) =>
      group.name === "Leche entera" ? { ...group, ids: [idOf("MM LECHE ENT")] } : group,
    );
    answer.push({ name: "Leche entera 1 L", ids: [idOf("LECHE ENTERA 1L")] });
    const report = evaluateGolden(golden, answer);
    expect(report.mustGroupMissed).toEqual([[idOf("MM LECHE ENT"), idOf("LECHE ENTERA 1L")]]);
  });

  it("reports a MUST-NOT pair when entera and deslactosada share a group", () => {
    const answer = perfectAnswer().map((group) => {
      if (group.name === "Leche entera") {
        return { ...group, ids: [...group.ids, idOf("MM LECHE DES")] };
      }
      if (group.name === "Leche deslactosada") {
        return { ...group, ids: group.ids.filter((id) => id !== idOf("MM LECHE DES")) };
      }
      return group;
    });
    const report = evaluateGolden(golden, answer);
    expect(report.mustNotViolated).toEqual([[idOf("MM LECHE ENT"), idOf("MM LECHE DES")]]);
    expect(report.mustGroupMissed).toEqual([]);
  });

  it("reports a MUST-NOT pair when jamón serrano joins the JAMON ZWAN group", () => {
    const answer = perfectAnswer().map((group) => {
      if (group.name === "Jamón Zwan") return { ...group, ids: [...group.ids, idOf("MM JAMONSERR")] };
      return group;
    });
    const report = evaluateGolden(golden, answer.filter((group) => group.name !== "Jamón serrano"));
    expect(report.mustNotViolated).toEqual([
      [idOf("MM JAMONSERR"), idOf("JAMON ZWAN")],
      [idOf("MM JAMONSERR"), idOf("JAMON ZWAN VIRGINIA1X1KG & 10360 1/1 KG")],
    ]);
  });

  it("counts the SHOULD pairs that were not grouped", () => {
    const answer = perfectAnswer().filter((group) => group.name !== "Queso manchego");
    answer.push(
      { name: "Queso manchego en barra", ids: [idOf("1K MANCHEGO")] },
      { name: "Queso manchego rebanado", ids: [idOf("QSO MANCHEGO")] },
    );
    const report = evaluateGolden(golden, answer);
    expect(report.shouldGroupHit).toBe(2);
    expect(report.shouldGroupTotal).toBe(3);
  });

  it("reports names equal ignoring case and edge spaces", () => {
    const answer = perfectAnswer().map((group) =>
      group.name === "Leche evaporada" ? { ...group, name: " leche ENTERA " } : group,
    );
    const report = evaluateGolden(golden, answer);
    expect(report.nameProblems).toHaveLength(1);
    expect(report.nameProblems[0]).toMatch(/repetid/i);
  });

  it("reports a name of 61 characters", () => {
    const longName = "x".repeat(61);
    const answer = perfectAnswer().map((group) =>
      group.name === "Pago" ? { ...group, name: longName } : group,
    );
    const report = evaluateGolden(golden, answer);
    expect(report.nameProblems).toHaveLength(1);
    expect(report.nameProblems[0]).toMatch(/60/);
  });

  it("accepts a name of exactly 60 characters", () => {
    const answer = perfectAnswer().map((group) =>
      group.name === "Pago" ? { ...group, name: "x".repeat(60) } : group,
    );
    expect(evaluateGolden(golden, answer).nameProblems).toEqual([]);
  });

  it("reports «Sin categoría» as a product name, with or without the accent", () => {
    for (const name of ["Sin categoría", "SIN CATEGORIA"]) {
      const answer = perfectAnswer().map((group) =>
        group.name === "Pago" ? { ...group, name } : group,
      );
      const report = evaluateGolden(golden, answer);
      expect(report.nameProblems).toHaveLength(1);
      expect(report.nameProblems[0]).toMatch(/Sin categor/i);
    }
  });

  it("reports an empty name", () => {
    const answer = perfectAnswer().map((group) =>
      group.name === "Pago" ? { ...group, name: "   " } : group,
    );
    expect(evaluateGolden(golden, answer).nameProblems).toHaveLength(1);
  });

  it("reports an omitted id in coverage.missing", () => {
    const answer = perfectAnswer().map((group) =>
      group.name === "Pago" ? { ...group, ids: [] } : group,
    );
    const report = evaluateGolden(golden, answer);
    expect(report.coverage.missing).toEqual([idOf("Pago")]);
  });

  it("reports invented and repeated ids in coverage", () => {
    const answer = [
      ...perfectAnswer(),
      { name: "Extra", ids: ["i999", idOf("Pago")] },
    ];
    const report = evaluateGolden(golden, answer);
    expect(report.coverage.unknown).toEqual(["i999"]);
    expect(report.coverage.duplicated).toEqual([idOf("Pago")]);
  });

  it("never counts an unsent id as grouped", () => {
    const report = evaluateGolden(golden, []);
    expect(report.mustGroupMissed).toEqual(golden.mustGroup);
    expect(report.shouldGroupHit).toBe(0);
    expect(report.mustNotViolated).toEqual([]);
  });
});
