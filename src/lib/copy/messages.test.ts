import { describe, expect, it } from "vitest";
import type { DuplicateFile } from "@/domain/import/types";
import {
  averageLegend,
  batchToastText,
  chipText,
  deltaLine,
  duplicateRowText,
  facturasCargadasHeading,
  filtersButtonText,
  groupTriggerText,
  ignoradosSubLabel,
  ignoredReasonText,
  monthsSubLabel,
  noFormaMatch,
  noSupplierMatch,
  notasSubLabel,
  optionLabel,
  paginationPageText,
  paginationRangeText,
  processingText,
  receptorDistintoText,
  rejectReasonText,
  removeChipAria,
  tipoLabel,
  trasladoNominaSubLabel,
  trendAriaLabel,
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

describe("pagination texts", () => {
  it("formats the range with an en dash", () => {
    expect(paginationRangeText(51, 100, 120)).toBe("Mostrando 51–100 de 120");
    expect(paginationRangeText(101, 120, 120)).toBe("Mostrando 101–120 de 120");
  });

  it("uses the singular form for a one-row range", () => {
    expect(paginationRangeText(1, 1, 1)).toBe("Mostrando 1 de 1");
    expect(paginationRangeText(51, 51, 51)).toBe("Mostrando 51 de 51");
  });

  it("formats the page indicator", () => {
    expect(paginationPageText(2, 3)).toBe("Página 2 de 3");
  });
});

describe("filter messages", () => {
  it("explains an empty supplier search", () => {
    expect(noSupplierMatch("xyz")).toBe(
      "Ningún proveedor coincide con «xyz». Revisa la búsqueda.",
    );
  });

  it("explains an empty forma de pago search", () => {
    expect(noFormaMatch("xyz")).toBe(
      "Ninguna forma de pago coincide con «xyz». Revisa la búsqueda.",
    );
  });

  it("appends the invoice count to an option", () => {
    expect(optionLabel("Nueva Wal-Mart de México", 39)).toBe(
      "Nueva Wal-Mart de México (39)",
    );
  });

  it("shows the first names of a chip and counts the rest", () => {
    expect(chipText("Proveedor", ["A", "B", "C", "D"], 2)).toBe("Proveedor: A, B +2");
    expect(chipText("Forma de pago", ["Efectivo", "Tarjeta"], 1)).toBe(
      "Forma de pago: Efectivo +1",
    );
  });

  it("has no plus part when every name fits", () => {
    expect(chipText("Proveedor", ["A"], 2)).toBe("Proveedor: A");
    expect(chipText("Proveedor", ["A", "B"], 2)).toBe("Proveedor: A, B");
  });

  it("names the filter in the remove-chip label", () => {
    expect(removeChipAria("Fechas")).toBe("Quitar filtro Fechas");
  });

  it("counts the active filters on the mobile button", () => {
    expect(filtersButtonText(0)).toBe("Filtros");
    expect(filtersButtonText(2)).toBe("Filtros \u00b7 2");
  });
});

describe("KPI sub-labels and delta line (D-18, D-20, DASH-06)", () => {
  it("counts credit notes in singular and plural", () => {
    expect(notasSubLabel(1)).toBe("+1 nota de crédito");
    expect(notasSubLabel(3)).toBe("+3 notas de crédito");
  });

  it("states the calendar months used as the divisor", () => {
    expect(monthsSubLabel(1)).toBe("Entre 1 mes del calendario");
    expect(monthsSubLabel(12)).toBe("Entre 12 meses del calendario");
  });

  it("joins the signed percent and the previous period", () => {
    expect(deltaLine("+12.4 %", "ene\u2013jun 2025")).toBe("+12.4 % vs. ene\u2013jun 2025");
  });
});

describe("trend chart texts (D-21)", () => {
  it("names the chart by its first and last month", () => {
    expect(trendAriaLabel("2025-01", "2025-12")).toBe("Gasto por mes de ene 2025 a dic 2025");
    expect(trendAriaLabel("2024-11", "2025-02")).toBe("Gasto por mes de nov 2024 a feb 2025");
  });

  it("states the average with its exact amount", () => {
    expect(averageLegend("$1,500.00")).toBe("Promedio mensual: $1,500.00");
  });
});
