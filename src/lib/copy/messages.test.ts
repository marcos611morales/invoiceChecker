import { describe, expect, it } from "vitest";
import type { DuplicateFile } from "@/domain/import/types";
import { INCIDENT_ORDER } from "@/domain/accounting/quality";
import { es } from "./es";
import {
  categoryAddedText,
  categoryCountLabel,
  categoryRenamedText,
  appliesToLinesText,
  categoryChangedToast,
  conceptCategoryAria,
  deleteCategoryAria,
  deleteCategoryBody,
  deleteCategoryTitle,
  renameCategoryAria,
  renameInputAria,
  usageCaption,
  incidentTitle,
  appliesToText,
  averageLegend,
  batchToastText,
  categorySubCaption,
  ceroRow,
  chipText,
  conceptsPanelTitle,
  datosInvalidosRow,
  deltaLine,
  duplicateRowText,
  excluidaRow,
  monedaRow,
  ncSinRelacionadaRow,
  ncVariasRelacionadasRow,
  ppdRow,
  redondeoConceptosRow,
  redondeoTotalRow,
  sustitucionRow,
  sustituidaRow,
  filtersButtonText,
  foreignAmountLine,
  groupTriggerText,
  ignoradosSubLabel,
  ignoredReasonText,
  invoicesHeading,
  monthsSubLabel,
  noCategoryMatch,
  noFormaMatch,
  noSupplierMatch,
  notasSubLabel,
  optionLabel,
  originalCurrencyLine,
  paidLine,
  partOfTotalText,
  paginationPageText,
  paginationRangeText,
  hiddenInvoiceNotice,
  processingText,
  qualityTabAria,
  qualityTabLabel,
  receptorDistintoText,
  rankingCaption,
  rejectReasonText,
  removeChipAria,
  roundingLine,
  rowMenuAria,
  substitutedLine,
  tipoLabel,
  trasladoNominaSubLabel,
  trendAriaLabel,
  backupReasonText,
  invalidFileText,
  replaceSettingsBody,
  replaceSummaryText,
  settingsDownloadedToast,
  viewCategoryInvoicesAria,
  viewSupplierInvoicesAria,
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

  it("explains an empty category search (D-15)", () => {
    expect(noCategoryMatch("xyz")).toBe(
      "Ninguna categoría coincide con «xyz». Revisa la búsqueda.",
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

describe("category block sub-caption (D-16, D-17)", () => {
  it("states the divisor months and the pair of months of the variation", () => {
    expect(categorySubCaption(12, "dic 2025", "nov 2025")).toBe(
      "Promedio mensual entre 12 meses del calendario \u00b7 Variaci\u00f3n: dic 2025 vs. nov 2025",
    );
  });

  it("uses the singular for one month", () => {
    expect(categorySubCaption(1, "ene 2025", "dic 2024")).toBe(
      "Promedio mensual entre 1 mes del calendario \u00b7 Variaci\u00f3n: ene 2025 vs. dic 2024",
    );
  });

  it("keeps only the average part when there is no variation pair", () => {
    expect(categorySubCaption(3, null, null)).toBe("Promedio mensual entre 3 meses del calendario");
    expect(categorySubCaption(1, null, null)).toBe("Promedio mensual entre 1 mes del calendario");
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

describe("ranking caption (D-23)", () => {
  it("joins the share of the total and the average ticket", () => {
    expect(rankingCaption("25.0 %", "$500.00")).toBe("25.0 % del total · Ticket promedio $500.00");
  });

  it("keeps the dashes it is given for a missing share or ticket", () => {
    expect(rankingCaption("—", "—")).toBe("— del total · Ticket promedio —");
  });
});

describe("row button accessible names (D-18, UI-SPEC accessibility)", () => {
  it("names a category row after the category", () => {
    expect(viewCategoryInvoicesAria("Limpieza e higiene")).toBe(
      "Ver facturas de la categoría Limpieza e higiene",
    );
  });

  it("names a supplier row after the supplier", () => {
    expect(viewSupplierInvoicesAria("Abarrotes del Sur")).toBe("Ver facturas de Abarrotes del Sur");
  });

  it("keeps a long name whole, as the visible text does", () => {
    const long = "Comercializadora ".repeat(8).trim();
    expect(viewSupplierInvoicesAria(long)).toBe(`Ver facturas de ${long}`);
    expect(viewCategoryInvoicesAria(long)).toBe(`Ver facturas de la categoría ${long}`);
  });
});

describe("invoice table texts", () => {
  it("formats the heading with the count of rows", () => {
    expect(invoicesHeading(3)).toBe("Facturas (3)");
    expect(invoicesHeading(0)).toBe("Facturas (0)");
  });

  it("formats the credit note caption", () => {
    expect(appliesToText("jun 2025")).toBe("aplica a jun 2025");
  });

  it("formats the panel lines", () => {
    expect(roundingLine("$0.01")).toBe("Diferencia de redondeo: $0.01");
    expect(paidLine("15/03/2025", "Tarjeta de crédito")).toBe(
      "Pagada el 15/03/2025 con Tarjeta de crédito",
    );
    expect(substitutedLine("A-1")).toBe("Sustituida por la factura A-1. No se suma.");
    expect(originalCurrencyLine("USD", "18.20")).toBe("Moneda original: USD · TC 18.20");
    expect(conceptsPanelTitle("A-1")).toBe("Conceptos de la factura A-1");
  });

  it("formats the line under a category-partial amount (D-14)", () => {
    expect(partOfTotalText("$150.00")).toBe("de $150.00 total");
  });

  it("has the category filter note and the dimmed-line label (UI-SPEC)", () => {
    expect(es.invoices.categoryNote).toBe(
      "Con filtro de categoría, el monto es la parte de esas categorías y debajo se muestra el total de la factura.",
    );
    expect(es.invoices.notInCategoryFilter).toBe("No cuenta en el filtro de categoría");
  });

  it("formats the foreign amount line with and without a rate", () => {
    expect(foreignAmountLine("USD", "100.00", "18.20")).toBe("USD 100.00 · TC 18.20");
    expect(foreignAmountLine("USD", "100.00", null)).toBe("USD 100.00");
  });

  it("formats the accessible name of the row menu", () => {
    expect(rowMenuAria("A-1")).toBe("Acciones de la factura A-1");
  });
});

describe("incidentTitle", () => {
  it("names the ten incident types in the order of INCIDENT_ORDER", () => {
    expect(INCIDENT_ORDER.map((type) => incidentTitle(type))).toEqual([
      "Notas de crédito sin factura relacionada",
      "Notas de crédito con varias relacionadas",
      "Sustituciones",
      "Moneda sin tipo de cambio",
      "Datos inválidos",
      "Facturas en $0",
      "Diferencias de redondeo",
      "PPD sin complemento de pago",
      "Excluidas",
      "Sustituidas",
    ]);
  });
});

describe("Calidad de datos row sentences", () => {
  it("explains a credit note without a loaded related invoice", () => {
    expect(ncSinRelacionadaRow("jun 2025")).toBe(
      "Se resta en su propia fecha (jun 2025) porque la factura relacionada no está cargada.",
    );
  });

  it("explains the oldest-related rule exactly as D-46 words it", () => {
    expect(ncVariasRelacionadasRow("may 2025", 2)).toBe(
      "Aplica a may 2025: la relacionada más antigua de 2",
    );
    expect(ncVariasRelacionadasRow("jun 2025", 3)).toBe(
      "Aplica a jun 2025: la relacionada más antigua de 3",
    );
  });

  it("says what happened to the original of a substitution", () => {
    expect(sustitucionRow("0A1B2C3D", "excluida")).toBe(
      "Sustituye a la factura 0A1B2C3D…. La original quedó excluida.",
    );
    expect(sustitucionRow("0A1B2C3D", "no-cargada")).toBe(
      "Sustituye a la factura 0A1B2C3D…. La original no está cargada.",
    );
    expect(sustitucionRow("0A1B2C3D", "reincluida")).toBe(
      "Sustituye a la factura 0A1B2C3D…. La original se volvió a incluir.",
    );
  });

  it("formats the $0, rounding, PPD, currency, excluded and substituted rows", () => {
    expect(ceroRow()).toBe(
      "Total en $0: no cuenta en el número de facturas ni en los promedios.",
    );
    expect(redondeoTotalRow("$0.02")).toBe(
      "El Total del XML difiere en $0.02 de Subtotal − Descuento + traslados − retenciones.",
    );
    expect(redondeoConceptosRow("$0.02")).toBe(
      "La suma de los conceptos difiere en $0.02 del Subtotal.",
    );
    expect(ppdRow()).toBe(
      'Pago en parcialidades o diferido sin complemento de pago cargado; en filtros aparece como "Por definir (sin complemento de pago)".',
    );
    expect(monedaRow("USD")).toBe("USD sin tipo de cambio: no se suma");
    expect(excluidaRow()).toBe("Excluida por ti en esta sesión.");
    expect(sustituidaRow("A-1")).toBe("Sustituida por la factura A-1. No se suma.");
  });
});

describe("datosInvalidosRow (D-35, D-47)", () => {
  it("agrees in gender with every field of the copy table", () => {
    expect(es.quality.invalidFields.length).toBe(5);
    for (const [field, label] of es.quality.invalidFields) {
      expect(datosInvalidosRow(field)).toBe(`${label}: no se suma`);
    }
  });

  it("writes the five full sentences", () => {
    expect(datosInvalidosRow("Total")).toBe("Total inválido: no se suma");
    expect(datosInvalidosRow("SubTotal")).toBe("SubTotal inválido: no se suma");
    expect(datosInvalidosRow("Descuento")).toBe("Descuento inválido: no se suma");
    expect(datosInvalidosRow("Importe")).toBe("Importe inválido: no se suma");
    expect(datosInvalidosRow("Fecha")).toBe("Fecha inválida: no se suma");
  });

  it("falls back to the neutral wording for a missing or unknown field", () => {
    expect(datosInvalidosRow(null)).toBe("Dato inválido: no se suma");
    expect(datosInvalidosRow("Folio")).toBe("Dato inválido: no se suma");
  });

  it("does not treat inherited object keys as fields", () => {
    expect(datosInvalidosRow("__proto__")).toBe("Dato inválido: no se suma");
    expect(datosInvalidosRow("constructor")).toBe("Dato inválido: no se suma");
  });
});

describe("Calidad de datos tab texts (D-04, A-7)", () => {
  it("shows the counter only above zero", () => {
    expect(qualityTabLabel(0)).toBe("Calidad de datos");
    expect(qualityTabLabel(1)).toBe("Calidad de datos · 1");
    expect(qualityTabLabel(5)).toBe("Calidad de datos · 5");
    expect(qualityTabLabel(99)).toBe("Calidad de datos · 99");
  });

  it("uses the singular for one incident in the accessible name", () => {
    expect(qualityTabAria(0)).toBe("Calidad de datos");
    expect(qualityTabAria(1)).toBe("Calidad de datos, 1 incidencia");
    expect(qualityTabAria(5)).toBe("Calidad de datos, 5 incidencias");
  });

  it("builds the label from the same words as the tab copy", () => {
    expect(qualityTabLabel(0)).toBe(es.tabs.quality);
    expect(qualityTabAria(0)).toBe(es.tabs.quality);
  });
});

describe("hiddenInvoiceNotice (UI-SPEC decision 6)", () => {
  it("names the invoice by the reference it is given", () => {
    expect(hiddenInvoiceNotice("A-12")).toBe(
      "La factura A-12 no se ve porque los filtros la ocultan.",
    );
    expect(hiddenInvoiceNotice("1a2b3c4d")).toBe(
      "La factura 1a2b3c4d no se ve porque los filtros la ocultan.",
    );
  });

  it("keeps markup-like text as plain characters", () => {
    expect(hiddenInvoiceNotice("<b>x</b>")).toBe(
      "La factura <b>x</b> no se ve porque los filtros la ocultan.",
    );
  });
});

describe("Mis categorías copy (UI-SPEC)", () => {
  it("counts the categories with the singular for one", () => {
    expect(categoryCountLabel(0)).toBe("0 categorías");
    expect(categoryCountLabel(1)).toBe("1 categoría");
    expect(categoryCountLabel(9)).toBe("9 categorías");
  });

  it("builds the usage caption with singular forms and omits a zero part", () => {
    expect(usageCaption(1, 1)).toBe("1 proveedor · 1 concepto");
    expect(usageCaption(2, 3)).toBe("2 proveedores · 3 conceptos");
    expect(usageCaption(1, 2)).toBe("1 proveedor · 2 conceptos");
    expect(usageCaption(3, 0)).toBe("3 proveedores");
    expect(usageCaption(0, 1)).toBe("1 concepto");
    expect(usageCaption(0, 4)).toBe("4 conceptos");
  });

  it("reads Sin uso when both parts are zero", () => {
    expect(usageCaption(0, 0)).toBe("Sin uso");
    expect(usageCaption(0, 0)).toBe(es.categories.list.unused);
  });

  it("names the row actions and the rename input with the category", () => {
    expect(renameCategoryAria("Limpieza")).toBe("Renombrar categoría Limpieza");
    expect(deleteCategoryAria("Limpieza")).toBe("Borrar categoría Limpieza");
    expect(renameInputAria("Limpieza")).toBe("Nuevo nombre de la categoría Limpieza");
  });

  it("builds the polite announcements with guillemets", () => {
    expect(categoryAddedText("Café")).toBe("Categoría «Café» agregada");
    expect(categoryRenamedText("Café")).toBe("Categoría renombrada a «Café»");
  });

  it("keeps markup-like names as plain characters", () => {
    expect(categoryAddedText("<b>x</b>")).toBe("Categoría «<b>x</b>» agregada");
  });
});

describe("Delete category dialog copy (D-05)", () => {
  it("names the category in the title", () => {
    expect(deleteCategoryTitle("Otros")).toBe("¿Borrar la categoría «Otros»?");
  });

  it("says nothing points at an unused category", () => {
    expect(deleteCategoryBody(0, 0)).toBe("No está asignada a ningún proveedor ni concepto.");
    expect(deleteCategoryBody(0, 0)).toBe(es.dialogs.deleteCategory.unusedBody);
  });

  it("lists both parts with plurals and the singular for one", () => {
    expect(deleteCategoryBody(2, 1)).toBe("La usan 2 proveedores y 1 concepto.");
    expect(deleteCategoryBody(1, 3)).toBe("La usan 1 proveedor y 3 conceptos.");
    expect(deleteCategoryBody(1, 1)).toBe("La usan 1 proveedor y 1 concepto.");
  });

  it("omits a zero part", () => {
    expect(deleteCategoryBody(1, 0)).toBe("La usan 1 proveedor.");
    expect(deleteCategoryBody(4, 0)).toBe("La usan 4 proveedores.");
    expect(deleteCategoryBody(0, 1)).toBe("La usan 1 concepto.");
    expect(deleteCategoryBody(0, 5)).toBe("La usan 5 conceptos.");
  });
});

describe("Concept category Select copy (UI-SPEC E7)", () => {
  it("names the selector with the description between guillemets", () => {
    expect(conceptCategoryAria("CLORO 1L")).toBe("Categoría del concepto «CLORO 1L»");
  });

  it("keeps a description of exactly 60 characters whole", () => {
    const sixty = "x".repeat(60);
    expect(conceptCategoryAria(sixty)).toBe(`Categoría del concepto «${sixty}»`);
  });

  it("caps a longer description at 60 characters, the last one being «…»", () => {
    const text = conceptCategoryAria("y".repeat(200));
    expect(text).toBe(`Categoría del concepto «${"y".repeat(59)}…»`);
    const shown = text.slice("Categoría del concepto «".length, -1);
    expect(Array.from(shown)).toHaveLength(60);
  });

  it("does not split a character made of two UTF-16 units", () => {
    const text = conceptCategoryAria("😀".repeat(61));
    expect(text).toBe(`Categoría del concepto «${"😀".repeat(59)}…»`);
  });

  it("keeps markup-like text as plain characters", () => {
    expect(conceptCategoryAria("<img src=x>")).toBe("Categoría del concepto «<img src=x>»");
  });

  it("holds the fixed copy of the selector", () => {
    expect(es.invoices.conceptColumns.category).toBe("Categoría");
    expect(es.invoices.fromSupplier).toBe("· del proveedor");
    expect(es.invoices.conceptLimit).toBe("Llegaste al máximo de 20,000 conceptos ajustados.");
  });
});

describe("Concept change toast and reach caption (UI-SPEC E7, Q5)", () => {
  it("names the description between guillemets and the new category", () => {
    expect(categoryChangedToast("CLORO 1L", "Limpieza e higiene")).toBe(
      "Categoría de «CLORO 1L» cambiada a Limpieza e higiene",
    );
  });

  it("keeps a description of exactly 40 characters whole", () => {
    const forty = "x".repeat(40);
    expect(categoryChangedToast(forty, "Otros")).toBe(`Categoría de «${forty}» cambiada a Otros`);
  });

  it("caps a longer description at 40 characters including the «…»", () => {
    const text = categoryChangedToast("y".repeat(80), "Otros");
    expect(text).toBe(`Categoría de «${"y".repeat(39)}…» cambiada a Otros`);
    const shown = text.slice("Categoría de «".length, text.indexOf("» cambiada"));
    expect(Array.from(shown)).toHaveLength(40);
  });

  it("does not split a character made of two UTF-16 units", () => {
    expect(categoryChangedToast("😀".repeat(41), "Otros")).toBe(
      `Categoría de «${"😀".repeat(39)}…» cambiada a Otros`,
    );
  });

  it("keeps markup-like text as plain characters and never cuts the category name", () => {
    const longName = "Servicios de mantenimiento preventivo y correctivo de equipo";
    expect(categoryChangedToast("<img src=x>", longName)).toBe(
      `Categoría de «<img src=x>» cambiada a ${longName}`,
    );
  });

  it("reads «Aplica a 1 línea de» for one line and «Aplica a {n} líneas de» otherwise", () => {
    expect(appliesToLinesText(1)).toBe("Aplica a 1 línea de");
    expect(appliesToLinesText(2)).toBe("Aplica a 2 líneas de");
    expect(appliesToLinesText(37)).toBe("Aplica a 37 líneas de");
    expect(appliesToLinesText(0)).toBe("Aplica a 0 líneas de");
  });

  it("holds the fixed copy of the removal", () => {
    expect(es.invoices.removeAdjustment).toBe("Quitar ajuste");
    expect(es.invoices.adjustmentRemoved).toBe("Ajuste quitado");
  });
});

describe("settings file messages (D-07, D-08)", () => {
  it("builds the download toast with the file name", () => {
    expect(settingsDownloadedToast("invoicechecker-ajustes-2026-10-06.json")).toBe(
      "Ajustes descargados: invoicechecker-ajustes-2026-10-06.json",
    );
  });

  it("maps each refusal reason to its UI-SPEC sentence", () => {
    expect(backupReasonText("not-invoicechecker")).toBe(
      "no es un archivo de ajustes de InvoiceChecker",
    );
    expect(backupReasonText("damaged")).toBe("está dañado o incompleto");
    expect(backupReasonText("newer")).toBe("es de una versión más nueva de la app");
    expect(backupReasonText("too-large")).toBe("es demasiado grande (máx. 1 MB)");
  });

  it("builds the invalid-file text with the full file name and the closing sentence", () => {
    expect(invalidFileText("x.json", "está dañado o incompleto")).toBe(
      "No se pudo usar el archivo «x.json»: está dañado o incompleto. Tus ajustes actuales no cambiaron.",
    );
  });

  it("never cuts a long file name", () => {
    const longName = `${"a".repeat(200)}.json`;
    expect(invalidFileText(longName, "es demasiado grande (máx. 1 MB)")).toContain(`«${longName}»`);
    expect(
      replaceSettingsBody(longName, "1 categoría, 0 proveedores, 0 conceptos ajustados"),
    ).toContain(`«${longName}»`);
  });

  it("keeps markup-like text as plain characters", () => {
    expect(invalidFileText("<img src=x>.json", "está dañado o incompleto")).toContain(
      "«<img src=x>.json»",
    );
  });

  it("lists the three parts of the summary, plurals included", () => {
    expect(replaceSummaryText({ categories: 9, suppliers: 24, concepts: 7 })).toBe(
      "9 categorías, 24 proveedores, 7 conceptos ajustados",
    );
  });

  it("reads the singular forms for one and «0 …» for zero, never omitting a part", () => {
    expect(replaceSummaryText({ categories: 1, suppliers: 0, concepts: 1 })).toBe(
      "1 categoría, 0 proveedores, 1 concepto ajustado",
    );
    expect(replaceSummaryText({ categories: 0, suppliers: 1, concepts: 0 })).toBe(
      "0 categorías, 1 proveedor, 0 conceptos ajustados",
    );
  });

  it("builds the replace body from the UI-SPEC sentence", () => {
    expect(replaceSettingsBody("x.json", "3 categorías, 2 proveedores, 1 concepto ajustado")).toBe(
      "El archivo «x.json» contiene 3 categorías, 2 proveedores, 1 concepto ajustado. Se reemplazarán tus categorías, las categorías de proveedores, los conceptos ajustados y el modo de IVA actuales. Si quieres conservarlos, descárgalos antes.",
    );
  });

  it("holds the fixed copy", () => {
    expect(es.categories.backup.download).toBe("Descargar ajustes");
    expect(es.categories.backup.upload).toBe("Subir ajustes");
    expect(es.categories.backup.closeAlert).toBe("Cerrar aviso");
    expect(es.categories.backup.replaceTitle).toBe("¿Reemplazar tus ajustes?");
    expect(es.categories.backup.keepMine).toBe("Conservar los míos");
    expect(es.categories.backup.replaceConfirm).toBe("Reemplazar mis ajustes");
    expect(es.categories.backup.replacedToast).toBe("Ajustes reemplazados");
  });
});
