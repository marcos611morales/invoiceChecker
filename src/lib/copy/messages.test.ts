import { describe, expect, it } from "vitest";
import { rejectReasonText, tipoLabel } from "./messages";

describe("rejectReasonText", () => {
  it("names the CFDI version for cfdi-3x", () => {
    expect(rejectReasonText("cfdi-3x", "3.3")).toBe("Es CFDI 3.3; solo se acepta 4.0");
    expect(rejectReasonText("cfdi-3x", "4.1")).toBe("Es CFDI 4.1; solo se acepta 4.0");
  });

  it("falls back when the version detail is missing or empty", () => {
    expect(rejectReasonText("cfdi-3x", "")).toBe(
      "Versión de CFDI no admitida; solo se acepta 4.0",
    );
    expect(rejectReasonText("cfdi-3x")).toBe(
      "Versión de CFDI no admitida; solo se acepta 4.0",
    );
  });

  it("maps the other reasons to their Spanish text", () => {
    expect(rejectReasonText("not-cfdi")).toBe("No es un CFDI");
    expect(rejectReasonText("malformed")).toBe("XML dañado");
    expect(rejectReasonText("malformed", "dtd")).toBe("XML dañado");
    expect(rejectReasonText("no-timbre")).toBe("Sin timbre fiscal (no es válido ante el SAT)");
    expect(rejectReasonText("unreadable")).toBe("No se pudo leer el archivo");
    expect(rejectReasonText("too-large")).toBe("Archivo demasiado grande (máx. 2 MB)");
  });
});

describe("tipoLabel", () => {
  it("maps each TipoDeComprobante to its Spanish label", () => {
    expect(tipoLabel("I")).toBe("Ingreso");
    expect(tipoLabel("E")).toBe("Egreso");
    expect(tipoLabel("P")).toBe("Pago");
    expect(tipoLabel("T")).toBe("Traslado");
    expect(tipoLabel("N")).toBe("Nómina");
  });
});
