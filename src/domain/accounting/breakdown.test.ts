import { describe, expect, it } from "vitest";
import type { Concepto, Impuesto } from "../cfdi/types";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import { conceptBreakdown, invoiceBreakdown } from "./breakdown";

function tax(impuesto: string, importe: string | null): Impuesto {
  return { base: null, impuesto, tipoFactor: "Tasa", tasaOCuota: null, importe };
}

function concepto(overrides: Partial<Concepto> = {}): Concepto {
  return {
    claveProdServ: "01010101",
    noIdentificacion: null,
    cantidad: "1",
    claveUnidad: "H87",
    unidad: null,
    descripcion: "Concepto",
    valorUnitario: "100.00",
    importe: "100.00",
    descuento: null,
    objetoImp: null,
    traslados: [],
    retenciones: [],
    ...overrides,
  };
}

function text(value: { toFixed(): string } | null): string | null {
  return value === null ? null : value.toFixed();
}

describe("invoiceBreakdown (UI-SPEC Q7a, A-2, A-4)", () => {
  it("reads an MXN invoice as the XML states it, with no rate", () => {
    const invoice = makeInvoice({
      subTotal: "100.00",
      descuento: "10.00",
      total: "104.00",
      impuestos: {
        traslados: [tax("002", "14.40"), tax("003", "3.60"), tax("002", "0.00")],
        retenciones: [],
      },
    });
    const b = invoiceBreakdown(invoice);
    expect(text(b.subtotal)).toBe("100");
    expect(text(b.descuento)).toBe("10");
    expect(text(b.iva)).toBe("14.4");
    expect(text(b.ieps)).toBe("3.6");
    expect(text(b.total)).toBe("104");
    expect(b.rate).toBeNull();
  });

  it("leaves Descuento null when the invoice has none", () => {
    expect(invoiceBreakdown(makeInvoice({ descuento: null })).descuento).toBeNull();
  });

  it("counts an exempt tax (no Importe) as zero", () => {
    const invoice = makeInvoice({
      impuestos: { traslados: [tax("002", null)], retenciones: [] },
    });
    expect(text(invoiceBreakdown(invoice).iva)).toBe("0");
  });

  it("converts a foreign currency invoice with its own TipoCambio", () => {
    const invoice = makeInvoice({
      moneda: "USD",
      tipoCambio: "18.5",
      subTotal: "10.00",
      descuento: "1.00",
      total: "10.44",
      impuestos: { traslados: [tax("002", "1.44")], retenciones: [] },
    });
    const b = invoiceBreakdown(invoice);
    expect(text(b.subtotal)).toBe("185");
    expect(text(b.descuento)).toBe("18.5");
    expect(text(b.iva)).toBe("26.64");
    expect(text(b.ieps)).toBe("0");
    expect(text(b.total)).toBe("193.14");
    expect(text(b.rate)).toBe("18.5");
  });

  it("returns every value null when the foreign rate is unusable", () => {
    for (const tipoCambio of [null, "", "abc", "0", "-3"]) {
      const b = invoiceBreakdown(makeInvoice({ moneda: "USD", tipoCambio }));
      expect(b).toEqual({
        subtotal: null,
        descuento: null,
        iva: null,
        ieps: null,
        total: null,
        rate: null,
      });
    }
  });

  it("keeps the values of a credit note positive", () => {
    const invoice = makeInvoice({ tipo: "E", subTotal: "50.00", total: "58.00" });
    const b = invoiceBreakdown(invoice);
    expect(text(b.subtotal)).toBe("50");
    expect(text(b.total)).toBe("58");
  });
});

describe("conceptBreakdown", () => {
  it("returns Importe, Descuento, IVA (002) and IEPS (003), unsigned", () => {
    const invoice = makeInvoice({ tipo: "E" });
    const line = concepto({
      importe: "100.00",
      descuento: "5.00",
      traslados: [tax("002", "15.20"), tax("003", "2.00")],
    });
    const b = conceptBreakdown(line, invoice);
    expect(text(b.importe)).toBe("100");
    expect(text(b.descuento)).toBe("5");
    expect(text(b.iva)).toBe("15.2");
    expect(text(b.ieps)).toBe("2");
  });

  it("multiplies by the rate of a foreign currency invoice", () => {
    const invoice = makeInvoice({ moneda: "USD", tipoCambio: "20" });
    const b = conceptBreakdown(concepto({ importe: "10.00", traslados: [tax("002", "1.60")] }), invoice);
    expect(text(b.importe)).toBe("200");
    expect(text(b.iva)).toBe("32");
    expect(b.descuento).toBeNull();
  });

  it("returns nulls when the rate or the Importe is unusable", () => {
    const noRate = makeInvoice({ moneda: "USD", tipoCambio: null });
    expect(conceptBreakdown(concepto(), noRate).importe).toBeNull();
    expect(conceptBreakdown(concepto({ importe: "abc" }), makeInvoice()).importe).toBeNull();
  });
});
