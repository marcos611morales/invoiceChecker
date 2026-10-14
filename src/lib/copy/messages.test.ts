import { describe, expect, it } from "vitest";
import type { DuplicateFile } from "@/domain/import/types";
import {
  batchToastText,
  duplicateRowText,
  facturasCargadasHeading,
  groupTriggerText,
  ignoradosSubLabel,
  ignoredReasonText,
  processingText,
  receptorDistintoText,
  rejectReasonText,
  tipoLabel,
  trasladoNominaSubLabel,
} from "./messages";

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

describe("batchToastText", () => {
  it("lists added and duplicates, omitting zero parts", () => {
    expect(batchToastText({ added: 20, duplicates: 3, rejected: 0, ignored: 0 })).toBe(
      "Se agregaron 20, 3 duplicadas",
    );
  });

  it("uses the singular for one added invoice", () => {
    expect(batchToastText({ added: 1, duplicates: 0, rejected: 0, ignored: 0 })).toBe(
      "Se agregó 1",
    );
  });

  it("uses singular and plural forms for every trailing part", () => {
    expect(
      batchToastText({ added: 140, duplicates: 1, rejected: 2, ignored: 143 }),
    ).toBe("Se agregaron 140, 1 duplicada, 2 rechazadas, 143 ignorados");
    expect(batchToastText({ added: 2, duplicates: 2, rejected: 1, ignored: 1 })).toBe(
      "Se agregaron 2, 2 duplicadas, 1 rechazada, 1 ignorado",
    );
  });

  it("says nothing was added when only other parts are present", () => {
    expect(batchToastText({ added: 0, duplicates: 2, rejected: 0, ignored: 0 })).toBe(
      "No se agregó ninguna factura nueva, 2 duplicadas",
    );
    expect(batchToastText({ added: 0, duplicates: 0, rejected: 1, ignored: 1 })).toBe(
      "No se agregó ninguna factura nueva, 1 rechazada, 1 ignorado",
    );
  });

  it("handles an empty batch", () => {
    expect(batchToastText({ added: 0, duplicates: 0, rejected: 0, ignored: 0 })).toBe(
      "No se agregó ninguna factura nueva",
    );
  });
});

describe("ignoredReasonText", () => {
  it("maps each ignored kind to its Spanish reason", () => {
    expect(ignoredReasonText("pdf")).toBe("PDF (solo se leen los XML)");
    expect(ignoredReasonText("zip")).toBe("Descomprime el ZIP y suelta la carpeta");
    expect(ignoredReasonText("other")).toBe("No es un archivo XML");
  });
});

describe("duplicateRowText", () => {
  it("names the copy, the original and the first 8 characters of the UUID", () => {
    const duplicate: DuplicateFile = {
      file: { name: "copia.xml", path: "b/copia.xml" },
      originalFile: { name: "original.xml", path: "a/original.xml" },
      uuid: "AAAAAAAA-0000-4000-8000-000000000001",
    };
    expect(duplicateRowText(duplicate)).toBe(
      "copia.xml es la misma factura que original.xml (UUID AAAAAAAA…)",
    );
  });
});

describe("receptorDistintoText", () => {
  it("joins the file name and the receptor RFC", () => {
    expect(receptorDistintoText("a.xml", "XEXX010101000")).toBe(
      "a.xml: Receptor distinto: XEXX010101000",
    );
  });
});

describe("progress and label texts", () => {
  it("formats the processing progress", () => {
    expect(processingText(3, 143)).toBe("Procesando 3 de 143");
  });

  it("formats the accordion trigger", () => {
    expect(groupTriggerText("Rechazados", 2)).toBe("Rechazados (2)");
  });

  it("formats the card sub-labels", () => {
    expect(trasladoNominaSubLabel(1, 0)).toBe("Traslado: 1, Nómina: 0");
    expect(ignoradosSubLabel(143, 2)).toBe("PDF: 143, otros: 2");
  });
});

describe("facturasCargadasHeading", () => {
  it("formats the table heading with the invoice count", () => {
    expect(facturasCargadasHeading(4)).toBe("Facturas cargadas (4)");
    expect(facturasCargadasHeading(0)).toBe("Facturas cargadas (0)");
  });
});
