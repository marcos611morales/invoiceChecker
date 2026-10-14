// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCfdi } from "./parseCfdi";

const fixture = readFileSync(
  resolve(process.cwd(), "tests/fixtures/cfdi/ingreso-bom-decl.xml"),
  "utf8",
);

describe("parseCfdi", () => {
  it("parses a CFDI 4.0 Ingreso with BOM and XML declaration", () => {
    expect(fixture.startsWith("﻿")).toBe(true);
    const result = parseCfdi(fixture);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoice.tipo).toBe("I");
    expect(result.invoice.uuid).toBe("AAAAAAAA-0000-4000-8000-000000000001");
    expect(result.invoice.emisor.rfc).toBe("EKU9003173C9");
    expect(result.invoice.total).toBe("116.00");
    expect(result.invoice.totalImpuestosTrasladados).toBe("16.00");
    expect(result.invoice.descuento).toBeNull();
  });

  it("rejects a CFDI 3.3 document with the version as detail", () => {
    const xml =
      '<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/3" Version="3.3"/>';
    expect(parseCfdi(xml)).toEqual({
      ok: false,
      reason: "cfdi-3x",
      detail: "3.3",
    });
  });

  it("rejects a non-CFDI document", () => {
    expect(parseCfdi("<foo/>")).toMatchObject({ ok: false, reason: "not-cfdi" });
  });
});
