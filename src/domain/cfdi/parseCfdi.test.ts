// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  readFixture,
  withoutBomAndDeclaration,
  withPrefixes,
  withReceptorRfc,
  withTipo,
  withUuid,
} from "../../../tests/support/cfdiVariants";
import { parseCfdi } from "./parseCfdi";
import type { ParsedInvoice } from "./types";

function parseOk(xml: string): ParsedInvoice {
  const result = parseCfdi(xml);
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.reason} ${result.detail ?? ""}`);
  }
  return result.invoice;
}

const base = readFixture("ingreso-bom-decl.xml");

describe("parseCfdi", () => {
  it("parses a CFDI 4.0 Ingreso with BOM and XML declaration", () => {
    expect(base.startsWith("﻿")).toBe(true);
    const invoice = parseOk(base);
    expect(invoice.tipo).toBe("I");
    expect(invoice.uuid).toBe("AAAAAAAA-0000-4000-8000-000000000001");
    expect(invoice.emisor.rfc).toBe("EKU9003173C9");
    expect(invoice.total).toBe("116.00");
    expect(invoice.totalImpuestosTrasladados).toBe("16.00");
    expect(invoice.descuento).toBeNull();
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

describe("parseCfdi conceptos", () => {
  it("extracts exactly one concepto with its own IVA traslado", () => {
    const invoice = parseOk(base);
    expect(invoice.conceptos).toHaveLength(1);
    const concepto = invoice.conceptos[0];
    expect(concepto).toBeDefined();
    expect(concepto?.traslados).toHaveLength(1);
    expect(concepto?.traslados[0]).toEqual({
      base: "100.00",
      impuesto: "002",
      tipoFactor: "Tasa",
      tasaOCuota: "0.160000",
      importe: "16.00",
    });
    expect(concepto?.retenciones).toEqual([]);
    expect(concepto?.descripcion).toBe("PRODUCTO DE PRUEBA");
    expect(concepto?.noIdentificacion).toBeNull();
    expect(concepto?.descuento).toBeNull();
    expect(concepto?.objetoImp).toBe("02");
  });

  it("keeps the exact strings of a multi-concept invoice with discounts", () => {
    const invoice = parseOk(readFixture("ingreso-multiconcepto-descuento.xml"));
    expect(invoice.conceptos).toHaveLength(6);
    expect(invoice.descuento).toBe("2.00");
    expect(invoice.tipoCambio).toBe("1");
    expect(invoice.formaPago).toBe("01");
    expect(invoice.metodoPago).toBe("PUE");
    expect(invoice.totalImpuestosTrasladados).toBe("36.91");
    expect(invoice.totalImpuestosRetenidos).toBe("5.00");

    const first = invoice.conceptos[0];
    expect(first?.valorUnitario).toBe("12.345678");
    expect(first?.descuento).toBe("2.00");
    expect(first?.noIdentificacion).toBe("SKU-001");

    const withTwoTaxes = invoice.conceptos[2];
    expect(withTwoTaxes?.traslados.map((t) => t.impuesto)).toEqual(["003", "002"]);

    const withRetention = invoice.conceptos[1];
    expect(withRetention?.retenciones).toEqual([
      {
        base: "50.00",
        impuesto: "001",
        tipoFactor: "Tasa",
        tasaOCuota: "0.100000",
        importe: "5.00",
      },
    ]);
    // Unidad is optional: absent means null, never undefined.
    expect(withRetention?.unidad).toBeNull();

    // Exento traslado: optional attributes are null.
    expect(invoice.conceptos[3]?.traslados[0]).toEqual({
      base: "30.00",
      impuesto: "002",
      tipoFactor: "Exento",
      tasaOCuota: null,
      importe: null,
    });
    expect(invoice.conceptos[4]?.traslados).toEqual([]);
  });

  it("never copies the root-level Impuestos into a concepto", () => {
    const invoice = parseOk(readFixture("ingreso-multiconcepto-descuento.xml"));
    const all = invoice.conceptos.flatMap((c) => [...c.traslados, ...c.retenciones]);
    // 1 + 1 traslado + 1 retencion + 2 + 1 + 0 + 1
    expect(all).toHaveLength(7);
    expect(all.some((i) => i.importe === "28.91")).toBe(false);
    expect(all.some((i) => i.base === "205.69")).toBe(false);
  });

  it("parses an invoice without taxes", () => {
    const invoice = parseOk(readFixture("ingreso-sin-impuestos.xml"));
    expect(invoice.conceptos).toHaveLength(2);
    for (const c of invoice.conceptos) {
      expect(c.traslados).toEqual([]);
      expect(c.retenciones).toEqual([]);
    }
    expect(invoice.totalImpuestosTrasladados).toBeNull();
    expect(invoice.folio).toBeNull();
    expect(invoice.serie).toBeNull();
  });
});

describe("parseCfdi variants (CARGA-02, D-16, D-17, D-18)", () => {
  it("parses identically without BOM and XML declaration", () => {
    const stripped = withoutBomAndDeclaration(base);
    expect(stripped.startsWith("<cfdi:Comprobante")).toBe(true);
    expect(parseOk(stripped)).toEqual(parseOk(base));
  });

  it("parses identically with other namespace prefixes", () => {
    const prefixed = withPrefixes(base, { cfdi: "x", tfd: "t" });
    expect(prefixed).toContain("<x:Comprobante");
    expect(prefixed).toContain("<t:TimbreFiscalDigital");
    expect(prefixed).not.toContain("cfdi:");
    expect(parseOk(prefixed)).toEqual(parseOk(base));
  });

  it("accepts Traslado and Nomina documents with their tipo", () => {
    expect(parseOk(withTipo(base, "T")).tipo).toBe("T");
    expect(parseOk(withTipo(base, "N")).tipo).toBe("N");
  });

  it("exposes the receptor RFC so it can be derived from the data", () => {
    expect(parseOk(withReceptorRfc(base, "XEXX010101000")).receptor.rfc).toBe(
      "XEXX010101000",
    );
  });

  it("normalizes a lowercase UUID to the same value as the uppercase copy", () => {
    const upper = withUuid(base, "AAAAAAAA-0000-4000-8000-000000000001");
    expect(parseOk(upper).uuid).toBe(parseOk(base).uuid);
  });

  it("throws when a transform cannot find its attribute", () => {
    expect(() => withTipo("<a/>", "T")).toThrow();
    expect(() => withReceptorRfc("<a/>", "X")).toThrow();
    expect(() => withUuid("<a/>", "X")).toThrow();
  });
});

describe("parseCfdi relacionados and pagos", () => {
  const egreso = readFixture("egreso-relacionado.xml");

  it("extracts CfdiRelacionados with uppercased UUIDs", () => {
    const invoice = parseOk(egreso);
    expect(invoice.tipo).toBe("E");
    expect(invoice.relacionados).toEqual([
      { tipoRelacion: "07", uuids: ["AAAAAAAA-0000-4000-8000-000000000001"] },
    ]);
  });

  it("keeps repeated CfdiRelacionados elements in arrival order", () => {
    const block = /<cfdi:CfdiRelacionados[\s\S]*?<\/cfdi:CfdiRelacionados>/.exec(egreso);
    expect(block).not.toBeNull();
    const original = block?.[0] ?? "";
    const second = original
      .replace('TipoRelacion="07"', 'TipoRelacion="01"')
      .replace(
        /<cfdi:CfdiRelacionado UUID="[^"]*"\/>/,
        '<cfdi:CfdiRelacionado UUID=" aaaaaaaa-0000-4000-8000-000000000009 "/>',
      );
    const xml = egreso.replace(original, `${original}\n  ${second}`);
    expect(parseOk(xml).relacionados).toEqual([
      { tipoRelacion: "07", uuids: ["AAAAAAAA-0000-4000-8000-000000000001"] },
      { tipoRelacion: "01", uuids: ["AAAAAAAA-0000-4000-8000-000000000009"] },
    ]);
  });

  it("extracts the pago20 Pago and its DoctoRelacionado, ignoring Totales", () => {
    const invoice = parseOk(readFixture("pago-pago20.xml"));
    expect(invoice.tipo).toBe("P");
    expect(invoice.moneda).toBe("XXX");
    expect(invoice.total).toBe("0");
    expect(invoice.pagos).toEqual([
      {
        fechaPago: "2025-05-12T10:00:00",
        formaDePagoP: "03",
        monedaP: "MXN",
        monto: "116.00",
        doctos: [
          {
            idDocumento: "AAAAAAAA-0000-4000-8000-000000000001",
            monedaDR: "MXN",
            impPagado: "116.00",
          },
        ],
      },
    ]);
  });

  it("leaves relacionados and pagos empty on the Ingreso fixtures", () => {
    for (const name of [
      "ingreso-bom-decl.xml",
      "ingreso-multiconcepto-descuento.xml",
      "ingreso-sin-impuestos.xml",
    ]) {
      const invoice = parseOk(readFixture(name));
      expect(invoice.relacionados).toEqual([]);
      expect(invoice.pagos).toEqual([]);
    }
  });
});
