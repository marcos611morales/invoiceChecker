// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseCfdi } from "@/domain/cfdi/parseCfdi";
import type { ParsedInvoice } from "@/domain/cfdi/types";
import { buildPriceXml, type PriceInvoiceSpec } from "./pricesXml";

function parseOk(xml: string): ParsedInvoice {
  const result = parseCfdi(xml);
  if (!result.ok) throw new Error(`expected ok, got ${result.reason} ${result.detail ?? ""}`);
  return result.invoice;
}

const spec: PriceInvoiceSpec = {
  rfc: "AAA010101AAA",
  nombre: "ABARROTES & PRUEBA \"SA\" DE CV",
  folio: "PRC-FOLIO-T",
  fecha: "2025-03-05T10:15:00",
  uuid: "aaaaaaaa-0000-4000-8000-00000000f001",
  lines: [
    {
      descripcion: "LECHE <ENTERA> 1L",
      claveProdServ: "50131700",
      claveUnidad: "H87",
      cantidad: "12",
      importe: "300.10",
      descuento: "0.10",
    },
    {
      descripcion: "MAGNA",
      claveProdServ: "15101514",
      claveUnidad: "LTR",
      cantidad: "40",
      importe: "912.40",
    },
  ],
};

describe("buildPriceXml", () => {
  it("builds a CFDI 4.0 Ingreso that the parser reads, with exact totals", () => {
    const invoice = parseOk(buildPriceXml(spec));
    expect(invoice.tipo).toBe("I");
    expect(invoice.uuid).toBe(spec.uuid.toUpperCase());
    expect(invoice.folio).toBe("PRC-FOLIO-T");
    expect(invoice.subTotal).toBe("1212.50");
    expect(invoice.descuento).toBe("0.10");
    expect(invoice.total).toBe("1212.40");
    expect(invoice.conceptos).toHaveLength(2);
    expect(invoice.conceptos[0]?.claveUnidad).toBe("H87");
    expect(invoice.conceptos[0]?.valorUnitario).toBe("25.008333");
    expect(invoice.conceptos[1]?.claveProdServ).toBe("15101514");
  });

  it("escapes the XML special characters of names and descriptions", () => {
    const invoice = parseOk(buildPriceXml(spec));
    expect(invoice.emisor.nombre).toBe(spec.nombre);
    expect(invoice.conceptos[0]?.descripcion).toBe("LECHE <ENTERA> 1L");
  });

  it("writes no Descuento attribute when no line has one", () => {
    const [, magna] = spec.lines;
    if (magna === undefined) throw new Error("spec has no second line");
    const xml = buildPriceXml({ ...spec, lines: [magna] });
    expect(xml).not.toContain("Descuento");
    const invoice = parseOk(xml);
    expect(invoice.descuento).toBeNull();
    expect(invoice.total).toBe("912.40");
  });
});
