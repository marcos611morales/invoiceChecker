import { describe, expect, it } from "vitest";
import {
  FORMA_PAGO,
  TIPO_RELACION,
  formaPagoName,
  tipoRelacionName,
} from "./catalogs";

describe("FORMA_PAGO (c_FormaPago)", () => {
  it("has exactly the 22 codes of the SAT mirror", () => {
    expect(Object.keys(FORMA_PAGO)).toHaveLength(22);
  });

  it("resolves the seven codes present in the sample with the UI-SPEC labels", () => {
    expect(formaPagoName("01")).toBe("Efectivo");
    expect(formaPagoName("03")).toBe("Transferencia electrónica de fondos");
    expect(formaPagoName("04")).toBe("Tarjeta de crédito");
    expect(formaPagoName("28")).toBe("Tarjeta de débito");
    expect(formaPagoName("30")).toBe("Aplicación de anticipos");
    expect(formaPagoName("31")).toBe("Intermediario pagos");
    expect(formaPagoName("99")).toBe("Por definir");
  });

  it("returns null for an unknown code", () => {
    expect(formaPagoName("77")).toBeNull();
    expect(formaPagoName("")).toBeNull();
  });

  it("never reaches Object.prototype with a hostile code", () => {
    expect(formaPagoName("__proto__")).toBeNull();
    expect(formaPagoName("constructor")).toBeNull();
    expect(formaPagoName("toString")).toBeNull();
  });
});

describe("TIPO_RELACION (c_TipoRelacion)", () => {
  it("has exactly 7 codes", () => {
    expect(Object.keys(TIPO_RELACION)).toHaveLength(7);
  });

  it("resolves the labels accepted as written (D-45)", () => {
    expect(tipoRelacionName("01")).toBe(
      "Nota de crédito de los documentos relacionados",
    );
    expect(tipoRelacionName("04")).toBe("Sustitución de los CFDI previos");
    expect(tipoRelacionName("07")).toBe("CFDI por aplicación de anticipo");
  });

  it("returns null for an unknown or hostile code", () => {
    expect(tipoRelacionName("08")).toBeNull();
    expect(tipoRelacionName("__proto__")).toBeNull();
    expect(tipoRelacionName("hasOwnProperty")).toBeNull();
  });
});
