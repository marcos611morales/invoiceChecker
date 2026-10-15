// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { InvoiceTable } from "./InvoiceTable";

describe("InvoiceTable placeholder", () => {
  it("exports the component that Task 2 of Plan 02-13 implements", () => {
    expect(typeof InvoiceTable).toBe("function");
  });
});
