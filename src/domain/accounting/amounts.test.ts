// @vitest-environment jsdom
import Big from "big.js";
import { describe, expect, it } from "vitest";
import {
  readFixture,
  withDescuento,
  withFecha,
  withFormaPago,
  withMetodoPago,
  withMoneda,
  withSubTotal,
  withTipo,
  withTipoCambio,
  withTipoRelacion,
  withTotal,
} from "../../../tests/support/cfdiVariants";
import { parseCfdi } from "../cfdi/parseCfdi";
import type { Concepto, ParsedInvoice } from "../cfdi/types";
import { conceptAmounts, invoiceAmounts, iepsOf } from "./amounts";
import type { AmountResult } from "./amounts";
import { ZERO, parseDecimal, sum } from "./decimal";

const DESCUENTO = readFixture("anon/anon-ingreso-descuento.xml");
const IEPS = readFixture("anon/anon-ingreso-ieps.xml");

function parseOk(xml: string): ParsedInvoice {
  const result = parseCfdi(xml);
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.reason} ${result.detail ?? ""}`);
  }
  return result.invoice;
}

function amountsOf(invoice: ParsedInvoice): { conIva: string; sinIva: string; totalMxn: string } {
  const result: AmountResult = invoiceAmounts(invoice);
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.reason}`);
  }
  return {
    conIva: result.amounts.conIva.toString(),
    sinIva: result.amounts.sinIva.toString(),
    totalMxn: result.amounts.totalMxn.toString(),
  };
}

function conceptOf(invoice: ParsedInvoice, index: number): Concepto {
  const concepto = invoice.conceptos[index];
  if (concepto === undefined) throw new Error(`no concepto ${index}`);
  return concepto;
}

function strings(invoice: ParsedInvoice, index: number): {
  precioUnitario: string | null;
  conIva: string | null;
  sinIva: string | null;
} {
  const a = conceptAmounts(conceptOf(invoice, index), invoice);
  return {
    precioUnitario: a.precioUnitario === null ? null : a.precioUnitario.toString(),
    conIva: a.conIva === null ? null : a.conIva.toString(),
    sinIva: a.sinIva === null ? null : a.sinIva.toString(),
  };
}

function withIepsImporte(invoice: ParsedInvoice, importe: string): ParsedInvoice {
  return {
    ...invoice,
    impuestos: {
      ...invoice.impuestos,
      traslados: invoice.impuestos.traslados.map((t) =>
        t.impuesto === "003" ? { ...t, importe } : t,
      ),
    },
  };
}

describe("test-support variants", () => {
  it("replace only the root attribute they name", () => {
    const total = withTotal(DESCUENTO, "99.00");
    expect(total).toContain('Total="99.00"');
    expect(total).toContain('SubTotal="1377.29"');
    expect(parseOk(total).total).toBe("99.00");
    expect(parseOk(withSubTotal(DESCUENTO, "5.00")).subTotal).toBe("5.00");
    expect(parseOk(withDescuento(DESCUENTO, "1.00")).descuento).toBe("1.00");
    expect(parseOk(withFecha(DESCUENTO, "2024-01-02T03:04:05")).fecha).toBe(
      "2024-01-02T03:04:05",
    );
    expect(parseOk(withMoneda(DESCUENTO, "USD")).moneda).toBe("USD");
    expect(parseOk(withTipoCambio(DESCUENTO, "18.2")).tipoCambio).toBe("18.2");
    expect(parseOk(withMetodoPago(DESCUENTO, "PPD")).metodoPago).toBe("PPD");
    expect(parseOk(withFormaPago(DESCUENTO, "03")).formaPago).toBe("03");
  });

  it("do not touch concept-level attributes with the same name", () => {
    const changed = withDescuento(DESCUENTO, "0.01");
    expect(changed).toContain('Descuento="40.34"');
  });

  it("throw when the attribute is missing", () => {
    expect(() => withTipoCambio(IEPS, "18.2")).toThrow(/not found/);
    expect(() => withTipoRelacion(DESCUENTO, "04")).toThrow(/not found/);
  });

  it("withTipoRelacion rewrites the first CfdiRelacionados", () => {
    const xml =
      '<cfdi:Comprobante><cfdi:CfdiRelacionados TipoRelacion="01"><cfdi:CfdiRelacionado UUID="X"/></cfdi:CfdiRelacionados></cfdi:Comprobante>';
    expect(withTipoRelacion(xml, "04")).toContain('TipoRelacion="04"');
  });
});

describe("invoiceAmounts: Con IVA, Sin IVA and sign (REGLA-03)", () => {
  it("Ingreso with descuento: Con IVA is Total and Sin IVA is SubTotal minus Descuento", () => {
    expect(amountsOf(parseOk(DESCUENTO))).toEqual({
      conIva: "1345.98",
      sinIva: "1290.81",
      totalMxn: "1345.98",
    });
  });

  it("the same document typed as Egreso is negative, totalMxn stays unsigned", () => {
    const egreso = parseOk(withTipo(DESCUENTO, "E"));
    expect(amountsOf(egreso)).toEqual({
      conIva: "-1345.98",
      sinIva: "-1290.81",
      totalMxn: "1345.98",
    });
  });

  it("Sin IVA adds the invoice-level IEPS, and the identity with IVA reaches Total", () => {
    const invoice = parseOk(IEPS);
    const ieps = iepsOf(invoice);
    expect(ieps).not.toBeNull();
    expect(ieps?.gt(ZERO)).toBe(true);
    expect(ieps?.toString()).toBe("40.59");

    const subTotal = parseDecimal(invoice.subTotal);
    const descuento = parseDecimal(invoice.descuento);
    const total = parseDecimal(invoice.total);
    if (subTotal === null || descuento === null || total === null || ieps === null) {
      throw new Error("fixture amounts must be valid decimals");
    }
    const iva = sum(
      invoice.impuestos.traslados
        .filter((t) => t.impuesto === "002")
        .map((t) => parseDecimal(t.importe) ?? ZERO),
    );
    expect(subTotal.minus(descuento).plus(ieps).plus(iva).eq(total)).toBe(true);

    const amounts = amountsOf(invoice);
    expect(amounts.conIva).toBe("2319.01");
    expect(amounts.sinIva).toBe(subTotal.minus(descuento).plus(ieps).toString());
    expect(amounts.sinIva).toBe("1999.14");
  });

  it("iepsOf is zero when the invoice has no IEPS", () => {
    expect(iepsOf(parseOk(DESCUENTO))?.eq(ZERO)).toBe(true);
  });

  it("iepsOf is null when an IEPS Importe is not a decimal", () => {
    expect(iepsOf(withIepsImporte(parseOk(IEPS), "n/a"))).toBeNull();
  });

  it("an IEPS traslado without Importe counts as zero", () => {
    const invoice = parseOk(IEPS);
    const noImporte: ParsedInvoice = {
      ...invoice,
      impuestos: {
        ...invoice.impuestos,
        traslados: invoice.impuestos.traslados.map((t) =>
          t.impuesto === "003" ? { ...t, importe: null } : t,
        ),
      },
    };
    expect(iepsOf(noImporte)?.eq(ZERO)).toBe(true);
  });
});

describe("invoiceAmounts: foreign currency (REGLA-07, D-10, T-02-05)", () => {
  const usd = withMoneda(DESCUENTO, "USD");

  it("converts with the invoice's own TipoCambio as an exact product", () => {
    const invoice = parseOk(withTipoCambio(usd, "18.2"));
    expect(amountsOf(invoice)).toEqual({
      conIva: "24496.836",
      sinIva: "23492.742",
      totalMxn: "24496.836",
    });
  });

  it("converts a negative Egreso with the same rate", () => {
    const invoice = parseOk(withTipo(withTipoCambio(usd, "18.2"), "E"));
    expect(amountsOf(invoice).conIva).toBe("-24496.836");
  });

  it.each([
    ["zero", "0"],
    ["negative", "-3"],
    ["non-numeric", "abc"],
    ["exponent", "1e2"],
    ["empty", ""],
  ])("a USD invoice with a %s TipoCambio does not sum", (_label, rate) => {
    const invoice = parseOk(withTipoCambio(usd, rate));
    expect(invoiceAmounts(invoice)).toEqual({ ok: false, reason: "moneda-sin-tc" });
  });

  it("a USD invoice with no TipoCambio does not sum and gets no invented rate", () => {
    const invoice = parseOk(withMoneda(IEPS, "USD"));
    expect(invoice.tipoCambio).toBeNull();
    expect(invoiceAmounts(invoice)).toEqual({ ok: false, reason: "moneda-sin-tc" });
  });

  it("MXN ignores TipoCambio, even '1', damaged or absent", () => {
    const plain = amountsOf(parseOk(DESCUENTO));
    expect(amountsOf(parseOk(withTipoCambio(DESCUENTO, "1")))).toEqual(plain);
    expect(amountsOf(parseOk(withTipoCambio(DESCUENTO, "abc")))).toEqual(plain);
    expect(amountsOf(parseOk(withTipoCambio(DESCUENTO, "0")))).toEqual(plain);
    expect(amountsOf(parseOk(IEPS)).conIva).toBe("2319.01");
  });
});

describe("invoiceAmounts: damaged data is reported by field (D-35)", () => {
  function invalidField(xml: string): string | null {
    const result = invoiceAmounts(parseOk(xml));
    return !result.ok && result.reason === "invalido" ? result.field : null;
  }

  it("names Total, SubTotal, Descuento and Importe", () => {
    expect(invalidField(withTotal(DESCUENTO, "abc"))).toBe("Total");
    expect(invalidField(withSubTotal(DESCUENTO, "1e5"))).toBe("SubTotal");
    expect(invalidField(withDescuento(DESCUENTO, "x"))).toBe("Descuento");
    const result = invoiceAmounts(withIepsImporte(parseOk(IEPS), "n/a"));
    expect(result).toEqual({ ok: false, reason: "invalido", field: "Importe" });
  });

  it("reports invalido before moneda-sin-tc", () => {
    const xml = withTotal(withMoneda(IEPS, "USD"), "abc");
    expect(invalidField(xml)).toBe("Total");
  });

  it("checks Total, then SubTotal, then Descuento", () => {
    const both = withSubTotal(withTotal(DESCUENTO, "abc"), "abc");
    expect(invalidField(both)).toBe("Total");
    expect(invalidField(withDescuento(withSubTotal(DESCUENTO, "abc"), "x"))).toBe("SubTotal");
  });
});

describe("conceptAmounts (D-25, D-38)", () => {
  it("Sin IVA is importe minus descuento, Con IVA adds the IVA traslado", () => {
    const invoice = parseOk(DESCUENTO);
    expect(strings(invoice, 0)).toEqual({
      precioUnitario: "260.16",
      conIva: "254.99",
      sinIva: "219.82",
    });
  });

  it("a retention lowers Con IVA and not Sin IVA", () => {
    const invoice = parseOk(DESCUENTO);
    const base = conceptOf(invoice, 0);
    const withRetencion: Concepto = {
      ...base,
      retenciones: [
        {
          base: "219.83",
          impuesto: "001",
          tipoFactor: "Tasa",
          tasaOCuota: "0.0125",
          importe: "4.00",
        },
      ],
    };
    const a = conceptAmounts(withRetencion, invoice);
    expect(a.conIva?.toString()).toBe("250.99");
    expect(a.sinIva?.toString()).toBe("219.82");
  });

  it("Sin IVA adds the concept's own IEPS and Con IVA adds IEPS and IVA", () => {
    const invoice = parseOk(IEPS);
    expect(strings(invoice, 1)).toEqual({
      precioUnitario: "1997.69",
      conIva: "2289.01",
      sinIva: "1973.28",
    });
  });

  it("a concept without taxes (ObjetoImp 01) has Con IVA equal to Sin IVA", () => {
    const invoice = parseOk(IEPS);
    expect(strings(invoice, 0)).toEqual({
      precioUnitario: "102.59",
      conIva: "0",
      sinIva: "0",
    });
  });

  it("a damaged importe makes the whole concept unusable: all three fields null", () => {
    const invoice = parseOk(DESCUENTO);
    const broken: Concepto = { ...conceptOf(invoice, 0), importe: "z" };
    expect(conceptAmounts(broken, invoice)).toEqual({
      precioUnitario: null,
      conIva: null,
      sinIva: null,
    });
  });

  it("a damaged ValorUnitario only nulls the unit price", () => {
    const invoice = parseOk(DESCUENTO);
    const broken: Concepto = { ...conceptOf(invoice, 0), valorUnitario: "q" };
    const a = conceptAmounts(broken, invoice);
    expect(a.precioUnitario).toBeNull();
    expect(a.conIva?.toString()).toBe("254.99");
  });

  it("a damaged non-IEPS tax only nulls Con IVA", () => {
    const invoice = parseOk(DESCUENTO);
    const base = conceptOf(invoice, 0);
    const broken: Concepto = {
      ...base,
      traslados: base.traslados.map((t) => ({ ...t, importe: "n/a" })),
    };
    const a = conceptAmounts(broken, invoice);
    expect(a.conIva).toBeNull();
    expect(a.sinIva?.toString()).toBe("219.82");
  });

  it("a damaged descuento gives null amounts", () => {
    const invoice = parseOk(DESCUENTO);
    const broken: Concepto = { ...conceptOf(invoice, 0), descuento: "x" };
    const a = conceptAmounts(broken, invoice);
    expect(a.conIva).toBeNull();
    expect(a.sinIva).toBeNull();
  });

  it("an Egreso concept is negative and the unit price stays unsigned", () => {
    const invoice = parseOk(withTipo(DESCUENTO, "E"));
    expect(strings(invoice, 0)).toEqual({
      precioUnitario: "260.16",
      conIva: "-254.99",
      sinIva: "-219.82",
    });
  });

  it("converts with the invoice's TipoCambio, unit price included", () => {
    const invoice = parseOk(withTipoCambio(withMoneda(DESCUENTO, "USD"), "18.2"));
    expect(strings(invoice, 0)).toEqual({
      precioUnitario: "4734.912",
      conIva: "4640.818",
      sinIva: "4000.724",
    });
  });

  it("gives null everywhere when the exchange rate is unusable", () => {
    const invoice = parseOk(withMoneda(IEPS, "USD"));
    expect(conceptAmounts(conceptOf(invoice, 1), invoice)).toEqual({
      precioUnitario: null,
      conIva: null,
      sinIva: null,
    });
  });
});

describe("exact ledger sums (REGLA-04, precision)", () => {
  it("400 synthetic Ingreso invoices equal an independent BigInt-cents reference", () => {
    const base = parseOk(DESCUENTO);
    const hundred = BigInt(100);
    let referenceCents = BigInt(0);
    const conIvas: Big[] = [];
    for (let i = 0; i < 400; i += 1) {
      const cents = BigInt(((i * 7919 + 13) % 1_000_003) + 1);
      referenceCents += cents;
      const total = `${(cents / hundred).toString()}.${(cents % hundred).toString().padStart(2, "0")}`;
      const result = invoiceAmounts({ ...base, uuid: `U${i}`, descuento: null, subTotal: total, total });
      if (!result.ok) throw new Error("expected ok");
      conIvas.push(result.amounts.conIva);
    }
    const expected = `${(referenceCents / hundred).toString()}.${(referenceCents % hundred).toString().padStart(2, "0")}`;
    expect(sum(conIvas).toString()).toBe(new Big(expected).toString());
  });
});
