import { describe, expect, it } from "vitest";
import { mergeSameNamedGroups } from "./reconcile";

interface TestGroup {
  name: string;
  ids: string[];
  existing: string | null;
}

describe("mergeSameNamedGroups (A-5, Pitfall 8)", () => {
  it("merges names equal ignoring case and edge spaces, keeping both id lists in order", () => {
    const merged = mergeSameNamedGroups<TestGroup>([
      { name: "Leche entera", ids: ["i1", "i2"], existing: null },
      { name: "Azúcar", ids: ["i3"], existing: null },
      { name: " leche ENTERA", ids: ["i4"], existing: null },
    ]);
    expect(merged).toEqual([
      { name: "Leche entera", ids: ["i1", "i2", "i4"], existing: null },
      { name: "Azúcar", ids: ["i3"], existing: null },
    ]);
  });

  it("keeps the first name and the first non-null existing", () => {
    const merged = mergeSameNamedGroups<TestGroup>([
      { name: "Leche entera", ids: ["i1"], existing: null },
      { name: "LECHE ENTERA", ids: ["i2"], existing: "p2" },
      { name: "leche entera", ids: ["i3"], existing: "p9" },
    ]);
    expect(merged).toEqual([{ name: "Leche entera", ids: ["i1", "i2", "i3"], existing: "p2" }]);
  });

  it("leaves groups with different names alone and does not mutate its input", () => {
    const input: TestGroup[] = [
      { name: "Leche", ids: ["i1"], existing: null },
      { name: "Leche deslactosada", ids: ["i2"], existing: null },
    ];
    const merged = mergeSameNamedGroups(input);
    expect(merged).toEqual(input);
    expect(input[0]?.ids).toEqual(["i1"]);
  });

  it("returns an empty list for an empty answer", () => {
    expect(mergeSameNamedGroups<TestGroup>([])).toEqual([]);
  });
});
