/**
 * Static es-MX copy of the UI-SPEC Copywriting Contract (Phase 1, extended in Phase 2).
 *
 * Only fixed strings live here. Interpolated sentences (batch toast, "Procesando N de M",
 * duplicate and receptor rows, pagination text, ...) live in `src/lib/copy/messages.ts`
 * and value formatting (dates, money, folio) in `src/lib/format.ts`.
 * Phase 2 adds new keys (`tabs`, `dashboard`, ...) and never renames existing ones.
 */
export const es = {
  global: {
    appName: "InvoiceChecker",
    subtitle: "Análisis de gastos del Coworking Café",
    addInvoices: "Agregar facturas",
    selectFiles: "Seleccionar archivos",
    selectFolder: "Seleccionar carpeta",
    logout: "Cerrar sesión",
    resetAll: "Quitar todas",
    themeToggle: {
      fallback: "Cambiar tema",
      toDark: "Cambiar a tema oscuro",
      toLight: "Cambiar a tema claro",
    },
    privacyLine:
      "Tus facturas se procesan en este navegador. Solo si lo pides, se envían a DeepSeek descripciones de conceptos y nombres de proveedor (nunca RFC, UUID ni montos).",
    reloadNote:
      "Por privacidad, las facturas no se guardan; vuelve a soltarlas para analizarlas",
  },

  login: {
    title: "Entrar · InvoiceChecker",
    fieldLabel: "Contraseña",
    submit: "Entrar",
    submitPending: "Entrando…",
    showPassword: "Mostrar contraseña",
    hidePassword: "Ocultar contraseña",
    wrongPassword: "Contraseña incorrecta. Revísala e inténtalo de nuevo.",
    emptyPassword: "Escribe la contraseña.",
    networkError:
      "No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo.",
    serverNotConfigured:
      "El servidor no está configurado. Avisa a quien administra la app.",
  },

  empty: {
    heading: "Arrastra tus XML o la carpeta aquí",
    body: "Solo se leen los archivos XML (CFDI 4.0). Los PDF y otros archivos se ignoran.",
    selectFiles: "Seleccionar archivos",
    selectFolder: "Seleccionar carpeta",
    dragOver: "Suelta los archivos para cargarlos",
    windowOverlay: "Suelta para agregar facturas",
    readingFiles: "Leyendo archivos…",
    progressLabel: "Progreso de importación",
  },

  report: {
    heading: "Reporte de importación",
    cards: {
      income: "Ingreso",
      expense: "Egreso",
      payment: "Pago",
      transferAndPayroll: "Traslado y nómina",
      duplicates: "Duplicados",
      rejected: "Rechazados",
      ignored: "Ignorados",
    },
    groups: {
      rejected: "Rechazados",
      differentReceptor: "Receptor distinto",
      duplicates: "Duplicados",
      ignored: "Ignorados",
      income: "Ingreso",
      expense: "Egreso",
      payment: "Pago",
      transferAndPayroll: "Traslado y nómina",
    },
    rejectedReasons: {
      cfdi33: "Es CFDI 3.3; solo se acepta 4.0",
      notCfdi: "No es un CFDI",
      malformed: "XML dañado",
      noStamp: "Sin timbre fiscal (no es válido ante el SAT)",
      unreadable: "No se pudo leer el archivo",
    },
    ignoredReasons: {
      pdf: "PDF (solo se leen los XML)",
      other: "No es un archivo XML",
      zip: "Descomprime el ZIP y suelta la carpeta",
    },
  },

  table: {
    previous: "Anterior",
    next: "Siguiente",
  },

  invoices: {
    note: "Incluye notas de crédito y facturas que no suman (atenuadas). El monto sigue el modo Con IVA / Sin IVA.",
    /** Extra sentence of the note, only while the category filter is active (D-14). */
    categoryNote:
      "Con filtro de categoría, el monto es la parte de esas categorías y debajo se muestra el total de la factura.",
    /** `sr-only` label of a concept line outside the category filter (D-14). */
    notInCategoryFilter: "No cuenta en el filtro de categoría",
    columns: {
      date: "Fecha",
      supplier: "Proveedor",
      folio: "Folio",
      forma: "Forma de pago",
      type: "Tipo",
      amount: "Monto",
      concepts: "Conceptos",
      actions: "Acciones",
    },
    kinds: {
      ingreso: "Ingreso",
      notaCredito: "Nota de crédito",
      pago: "Pago",
      traslado: "Traslado",
      nomina: "Nómina",
    },
    states: {
      noSuma: "No suma",
      excluida: "Excluida",
      sustituida: "Sustituida",
    },
    noRelated: "sin factura relacionada",
    conceptColumns: {
      description: "Descripción",
      quantity: "Cantidad",
      unit: "Unidad",
      unitPrice: "Precio unitario",
      amount: "Monto",
      category: "Categoría",
    },
    fromSupplier: "· del proveedor",
    fromProduct: "· del producto",
    /** First line of the open popup of a product-derived concept, before the product name. */
    productOrigin: "del producto",
    conceptLimit: "Llegaste al máximo de 20,000 conceptos ajustados.",
    adjustmentRemoved: "Ajuste quitado",
    removeAdjustment: "Quitar ajuste",
    exclude: "Excluir factura",
    reinclude: "Volver a incluir",
    excludedToast: "Factura excluida",
    undo: "Deshacer exclusión",
    reincludedToast: "Factura incluida de nuevo",
    show: "Ver conceptos",
    hide: "Ocultar conceptos",
  },

  tabs: {
    ariaLabel: "Secciones",
    dashboard: "Dashboard",
    categories: "Categorías",
    products: "Productos",
    prices: "Precios",
    quality: "Calidad de datos",
    import: "Importación",
  },

  iva: {
    groupLabel: "Montos con o sin IVA",
    con: "Con IVA",
    sin: "Sin IVA",
    conShort: "c/IVA",
    sinShort: "s/IVA",
    conTooltip: "Total de cada factura",
    sinTooltip: "Subtotal − Descuento + IEPS (quita solo el IVA)",
    captionCon: "Montos con IVA (Total de cada factura)",
    captionSin: "Montos sin IVA (Subtotal − Descuento + IEPS)",
  },

  filters: {
    dates: "Fechas",
    supplier: "Proveedor",
    forma: "Forma de pago",
    category: "Categoría",
    from: "Desde",
    to: "Hasta",
    all: "Todo",
    thisYear: "Este año",
    last3: "Últimos 3 meses",
    dateHelper: "Para ver un solo mes, elige el mismo mes en Desde y Hasta.",
    searchSupplier: "Buscar proveedor",
    searchForma: "Buscar forma de pago",
    searchCategory: "Buscar categoría",
    clearSuppliers: "Limpiar proveedores",
    clearFormas: "Limpiar formas de pago",
    clearCategories: "Limpiar categorías",
    categoryCaption:
      "Con filtro de categoría, los montos suman solo las líneas de esas categorías.",
    reset: "Quitar filtros",
    mobile: "Filtros",
  },

  dashboard: {
    kpis: {
      gasto: "Gasto total",
      facturas: "Facturas",
      ticket: "Ticket promedio",
      promedio: "Promedio mensual",
      noPrevious: "Sin datos del periodo anterior",
      increased: "subió",
      decreased: "bajó",
    },
    emptyFilteredHeading: "Ninguna factura coincide con los filtros",
    emptyFilteredBody: "Cambia o quita los filtros para ver el gasto.",
    noInvoicesHeading: "Ninguna factura válida",
    noInvoicesBody:
      "Revisa los archivos rechazados en Importación y vuelve a soltarlos.",
    incidentsNotice: "Hay incidencias que cambian los montos.",
    seeQuality: "Ver Calidad de datos",
  },

  quality: {
    heading: "Calidad de datos",
    intro: "Revisa las facturas que pueden cambiar o limitar el análisis.",
    emptyHeading: "Sin incidencias",
    emptyBody: "No encontramos nada que revisar en las facturas cargadas.",
    seeInvoice: "Ver factura",
    reinclude: "Volver a incluir",
    seeInImport: "Ver en Importación",
    titles: {
      ncSinRelacionada: "Notas de crédito sin factura relacionada",
      ncVariasRelacionadas: "Notas de crédito con varias relacionadas",
      sustituciones: "Sustituciones",
      monedaSinTc: "Moneda sin tipo de cambio",
      datosInvalidos: "Datos inválidos",
      cero: "Facturas en $0",
      redondeo: "Diferencias de redondeo",
      ppd: "PPD sin complemento de pago",
      excluidas: "Excluidas",
      sustituidas: "Sustituidas",
      duplicados: "Duplicados",
      rechazados: "Archivos con error",
    },
    // Each label already carries the gender of its field (D-47): "Fecha inválida", "Total inválido".
    invalidFields: [
      ["Total", "Total inválido"],
      ["SubTotal", "SubTotal inválido"],
      ["Descuento", "Descuento inválido"],
      ["Importe", "Importe inválido"],
      ["Fecha", "Fecha inválida"],
    ],
    invalidFieldFallback: "Dato inválido",
  },

  charts: {
    trendHeading: "Gasto por mes",
    trendLegendBars: "Gasto mensual",
    trendTooltipRow: "Gasto",
    trendTableMonth: "Mes",
    categoryHeading: "Gasto por categoría",
    rankingHeading: "Gasto por proveedor",
    rankingSub: "Top 10",
    rankingAria: "Top 10 de proveedores por gasto neto",
    seeAll: "Ver todos",
    negativeNet: "Neto negativo: las notas de crédito superan las compras",
    noPreviousMonth: "Sin dato del mes anterior",
    categoryHint:
      "Todavía no clasificaste ningún proveedor ni concepto. Asigna categorías en la pestaña Categorías.",
    goToCategories: "Ir a Categorías",
    dialogDescription: "Todos los proveedores del filtro actual, ordenados por gasto neto.",
    close: "Cerrar",
    columns: {
      supplier: "Proveedor",
      net: "Gasto neto",
      pct: "% del total",
      invoices: "Facturas",
      ticket: "Ticket promedio",
    },
  },

  categories: {
    none: "Sin categoría",
    heading: "Categorías",
    intro:
      "Organiza tu gasto en categorías. Se guardan en este navegador; descarga tus ajustes para respaldarlos o usarlos en otro.",
    supplierHeading: "Categoría por proveedor",
    supplierIntro:
      "La categoría por defecto de cada proveedor. Para cambiar un concepto, ábrelo en la tabla de facturas del Dashboard.",
    columns: {
      supplier: "Proveedor",
      rfc: "RFC",
      invoices: "Facturas",
      category: "Categoría por defecto",
      actions: "Acciones",
    },
    /** «Mis categorías» card (UI-SPEC, Copywriting). */
    list: {
      heading: "Mis categorías",
      newLabel: "Nueva categoría",
      newHint: "Nombre de la categoría",
      add: "Agregar categoría",
      errors: {
        empty: "Escribe un nombre para la categoría.",
        duplicate: "Ya existe una categoría con ese nombre.",
        reserved: "«Sin categoría» es un nombre reservado.",
        tooLong: "El nombre puede tener hasta 60 caracteres.",
        limit: "Llegaste al máximo de 200 categorías.",
      },
      unused: "Sin uso",
      lockedCaption:
        "Es el valor cuando no hay otra categoría. No se puede renombrar ni borrar.",
      saveName: "Guardar nombre",
      cancelRename: "Cancelar cambio de nombre",
      emptyHeading: "No tienes categorías",
      emptyBody:
        "Crea una arriba para empezar a clasificar tu gasto. Mientras tanto, todo queda en «Sin categoría».",
    },
    deletedToast: "Categoría borrada",
    undo: "Deshacer",
    savedOnly: "Sin facturas cargadas",
    removeAssignment: "Quitar asignación",
    assignmentRemoved: "Asignación quitada",
    supplierLimit: "Llegaste al máximo de 5,000 proveedores con categoría.",
    readFailedToast:
      "No se pudieron leer tus ajustes guardados y se usaron los valores iniciales. Si tienes un archivo de respaldo, súbelo.",
    writeFailedAlert:
      "Este navegador no permite guardar tus ajustes. Los cambios se perderán al cerrar la página; descarga tus ajustes para no perderlos.",
    /** Settings file: download, upload, replace dialog and invalid-file Alert (D-07, D-08). */
    backup: {
      download: "Descargar ajustes",
      upload: "Subir ajustes",
      closeAlert: "Cerrar aviso",
      replaceTitle: "¿Reemplazar tus ajustes?",
      keepMine: "Conservar los míos",
      replaceConfirm: "Reemplazar mis ajustes",
      replacedToast: "Ajustes reemplazados",
      /** The {motivo} of the invalid-file Alert, one per refusal reason. */
      reasons: {
        notInvoiceChecker: "no es un archivo de ajustes de InvoiceChecker",
        damaged: "está dañado o incompleto",
        newer: "es de una versión más nueva de la app",
        tooLarge: "es demasiado grande (máx. 4 MB)",
      },
    },
  },

  export: {
    button: "Exportar a Excel",
    pending: "Exportando…",
    disabledReason: "No hay facturas con los filtros actuales",
    failed: "No se pudo generar el Excel. Inténtalo de nuevo.",
    sheets: {
      facturas: "Facturas",
      conceptos: "Conceptos",
      resumenCategoria: "Resumen por categoría",
      resumenProveedor: "Resumen por proveedor",
      resumenMes: "Resumen por mes",
      parametros: "Parámetros",
    },
    total: "Total",
    month: "Mes",
    invoices: "Facturas",
    amountCon: "Monto (con IVA)",
    amountSin: "Monto (sin IVA)",
    /** Estado column of Facturas and Conceptos, one text per row state (D-20). */
    status: {
      suma: "Suma",
      pago: "No suma: Pago",
      traslado: "No suma: Traslado",
      nomina: "No suma: Nómina",
      cero: "No suma: total en $0",
      monedaSinTc: "No suma: moneda sin tipo de cambio",
      invalido: "No suma: datos inválidos",
      excluida: "Excluida",
      sustituida: "Sustituida",
    },
    /** Column headers of the detail sheets (D-22, UI-SPEC Workbook contract). */
    columns: {
      date: "Fecha",
      supplier: "Proveedor",
      rfc: "RFC emisor",
      folio: "Folio",
      uuid: "UUID",
      type: "Tipo",
      status: "Estado",
      forma: "Forma de pago",
      fullAmountCon: "Monto de la factura completa (con IVA)",
      fullAmountSin: "Monto de la factura completa (sin IVA)",
      subtotal: "Subtotal",
      discount: "Descuento",
      iva: "IVA",
      ieps: "IEPS",
      total: "Total",
      currency: "Moneda",
      exchangeRate: "Tipo de cambio",
      description: "Descripción",
      quantity: "Cantidad",
      unit: "Unidad",
      claveProdServ: "ClaveProdServ",
      unitPrice: "Precio unitario",
      amount: "Importe",
      category: "Categoría",
      origin: "Origen de la categoría",
    },
    /** Extra headers of the summary sheets (D-23, UI-SPEC Workbook contract). */
    summary: {
      rfc: "RFC",
      pct: "% del total",
      monthlyAverage: "Promedio mensual",
      variation: "Variación % (último mes vs. mes anterior)",
      ticket: "Ticket promedio",
    },
    /** Text of the variation cell when there is no comparable previous month. */
    noPreviousMonth: "Sin dato del mes anterior",
    /** «Parámetros» sheet: header, parameter names, fixed texts (XLS-01, UI-SPEC Workbook contract). */
    params: {
      parameter: "Parámetro",
      value: "Valor",
      exportedAt: "Exportado el",
      mode: "Modo de montos",
      modeCon: "Con IVA (Total de cada factura)",
      modeSin: "Sin IVA (Subtotal − Descuento + IEPS)",
      range: "Rango de fechas",
      suppliers: "Proveedores",
      categories: "Categorías",
      formas: "Formas de pago",
      invoices: "Facturas incluidas en el gasto",
      total: "Gasto total",
      variationMonth: "Mes de la variación",
      note: "Nota",
      noteText:
        "Las facturas excluidas a mano se listan con Estado «Excluida» y no suman. Cada monto está redondeado a centavos, por lo que la suma de una columna de montos puede diferir en unos centavos del Gasto total y de la fila Total de los resúmenes, que redondean la suma exacta.",
      all: "Todos",
      allFem: "Todas",
      none: "—",
    },
    /** Origen de la categoría of a line, from where the resolver took it (D-22, Q6). */
    origin: {
      regla: "Ajuste del concepto",
      producto: "Del producto",
      proveedor: "Del proveedor",
      ninguna: "Sin categoría",
    },
    /** Description of the line that makes the rounded lines of an invoice add up (D-13, Q7b). */
    roundingLine: "Diferencia de redondeo",
  },

  /** Productos tab: grouping with DeepSeek (Phase 4, UI-SPEC Copywriting Contract). */
  products: {
    heading: "Productos",
    intro1:
      "Pide a DeepSeek que junte las descripciones que son el mismo producto en distintas tiendas y que sugiera categorías. Tú revisas cada sugerencia: nada cambia en el Dashboard hasta que la aceptas.",
    intro2:
      "Lo que aceptas se guarda en este navegador y va en tu archivo de ajustes. Las sugerencias pendientes también se guardan aquí, pero no van en el archivo.",
    groupButton: "Agrupar productos",
    noneFree: "No hay descripciones nuevas para agrupar",
    /** «Sugerir categorías» (UI-SPEC lines 182-186): the second entry button and its caption when nothing qualifies. */
    categorizeButton: "Sugerir categorías",
    categorizeNone: "No hay proveedores ni productos sin categoría",
    /** «Sugerencias de categoría» (UI-SPEC lines 280-286): the intro and the badges of the type column. */
    categoryRowsIntro:
      "DeepSeek propone una categoría para cada proveedor y producto que aún no tiene. Puedes cambiarla antes de aceptar.",
    /** Value shown when the suggested category no longer exists (UI-SPEC line 285). */
    categoryChoose: "Elige una categoría",
    categoryTypeSupplier: "Proveedor",
    categoryTypeProduct: "Producto",
    /** Column headers of the «Sugerencias de categoría» table (UI-SPEC line 282); the last one is `sr-only`. */
    categoryColumns: {
      type: "Tipo",
      name: "Nombre",
      category: "Categoría sugerida",
      actions: "Acciones",
    },
    /** Toast after «Rechazar» on a category row (UI-SPEC line 292); its action is «Deshacer». */
    categoryRejected: "Sugerencia rechazada",
    /** «Aceptar todas» at the header of the category table (D-23, UI-SPEC line 289). */
    categoryAcceptAll: "Aceptar todas",
    runActive: "Hay un proceso en curso",
    noLines: "Sin líneas cargadas",
    queueIntro:
      "Revisa cada grupo. Puedes cambiar el nombre, separar descripciones o unir grupos antes de aceptar.",
    closeAlert: "Cerrar aviso",
    signIn: "Iniciar sesión",
    /** Storage notices of the pending queue (UI-SPEC Storage notices); the settings keep theirs under categories. */
    queueReadFailedToast:
      "No se pudieron leer tus sugerencias pendientes guardadas. Puedes volver a pedirlas con «Agrupar productos».",
    queueWriteFailedAlert:
      "Este navegador no permite guardar las sugerencias pendientes. Se perderán al recargar la página; revísalas antes.",
    /** «Mis productos» (UI-SPEC lines 296-318): the accepted products and their members. */
    list: {
      intro:
        "Cada producto junta descripciones de distintas tiendas. Su categoría gana a la del proveedor, pero no a la que ajustes en un concepto.",
      emptyHeading: "Todavía no hay productos agrupados",
      emptyBody:
        "Pulsa «Agrupar productos» para que DeepSeek junte las descripciones que son el mismo producto en distintas tiendas. Antes de enviar verás exactamente qué datos salen.",
      columns: {
        expander: "Miembros",
        product: "Producto",
        category: "Categoría",
        members: "Miembros",
        suppliers: "Proveedores",
        actions: "Acciones",
      },
      memberColumns: {
        description: "Descripción",
        supplier: "Proveedor",
        lines: "Líneas",
        actions: "Acciones",
      },
      saveName: "Guardar nombre",
      cancelRename: "Cancelar cambio de nombre",
      undo: "Deshacer",
    },
    /** Searchable product picker used by «Mover a…» (and «Unir con…» later). */
    picker: {
      search: "Buscar producto",
      groupHeading: "Productos",
    },
    /** Product-suggestion cards (UI-SPEC lines 261-273): the accept button and its refusals. */
    queue: {
      accept: "Aceptar",
      reject: "Rechazar",
      /** `aria-label` of the editable proposed name of every card (UI-SPEC line 256). */
      nameAria: "Nombre del producto sugerido",
      /** Tooltip and `aria-label` of the member button that excludes a description for good (D-19). */
      ungroup: "No agrupar esta descripción",
      undo: "Deshacer",
      /** Footer buttons that join a card with another one or with a product, and split checked members (UI-SPEC lines 261, 414). */
      merge: "Unir con…",
      split: "Separar en producto nuevo",
      /** Groups of the «Unir con…» picker (UI-SPEC line 272). */
      otherSuggestions: "Otras sugerencias",
      ownProducts: "Productos que ya tienes",
      /** Toast after a join, whichever the destination (UI-SPEC line 273). */
      merged: "Sugerencias unidas",
      /** Search field, filter toggles and the text of an empty result (UI-SPEC lines 240-243, 403-406). */
      searchLabel: "Buscar sugerencia",
      searchPlaceholder: "Producto, descripción o proveedor",
      filterGroupLabel: "Filtrar sugerencias",
      filters: {
        todas: "Todas",
        varios: "Varios",
        deUno: "De uno",
        paraAgregar: "Para agregar",
      },
      noMatchNoText: "No hay sugerencias en este filtro.",
      /** Bulk bar and the confirmation of «Aceptar todas las visibles» (D-20, UI-SPEC lines 244-250). */
      selectVisible: "Seleccionar visibles",
      acceptSelected: "Aceptar seleccionadas",
      rejectSelected: "Rechazar seleccionadas",
      acceptAllVisible: "Aceptar todas las visibles",
      bulkDismiss: "Volver a revisar",
      /** Discretion text, the same form as the Phase 3 limit toasts (LIMITS.ungroupedConcepts). */
      ungroupLimit: "Llegaste al máximo de 5,000 descripciones marcadas.",
      /** Note under the title of an «Agregar a» card (D-21, UI-SPEC line 262). */
      addToNote:
        "Solo se suman estas descripciones nuevas; el producto conserva sus miembros y su categoría.",
      /**
       * Refusals of an «Agregar a» card. «gone» is the planner's text; «limit» and «noneChosen» are
       * Claude's discretion (the UI-SPEC defines neither): the first follows the form of the other
       * limit texts, the second explains why «Aceptar» did nothing with no checked description.
       */
      addToErrors: {
        gone: "Ese producto ya no existe. Rechaza la sugerencia o únela con otro producto.",
        limit:
          "Alcanzaste el límite de 5,000 descripciones en tus productos. Quita alguna para agregar más.",
        noneChosen: "Elige al menos una descripción para agregar.",
      },
      errors: {
        empty: "Escribe un nombre para el producto.",
        duplicate: "Ya existe un producto con ese nombre. Cambia el nombre o usa «Unir con…».",
        reserved: "«Sin categoría» es un nombre reservado.",
        tooLong: "El nombre puede tener hasta 60 caracteres.",
        membersTaken:
          "Algunas descripciones de esta sugerencia ya están en otro producto. Revisa «Mis productos».",
      },
    },
    /** Descripciones «No agrupar» (UI-SPEC lines 322-327). */
    ungrouped: {
      intro:
        "DeepSeek no vuelve a recibir estas descripciones. Quita la marca si quieres que se consideren de nuevo.",
      remove: "Quitar marca",
      removedAnnouncement:
        "Marca quitada. La descripción se enviará en el próximo «Agrupar productos».",
    },
    dialog: {
      title: "¿Enviar estos datos a DeepSeek?",
      /** With more than one batch (D-33): the names DeepSeek proposed travel back to it in the same run. */
      earlierNamesLine:
        "Cada lote lleva también los nombres que DeepSeek propuso en los anteriores.",
      peopleLine:
        "Algunos nombres de proveedor pueden ser nombres de personas. DeepSeek es un servicio externo a esta aplicación.",
      disclosure: "Ver exactamente qué se envía",
      dismiss: "No enviar",
      confirm: "Enviar a DeepSeek",
    },
    /** Run card, stop button and result Alerts (UI-SPEC Run progress, cancel and result). */
    run: {
      stop: "Detener lotes",
      stopping: "Deteniendo…",
      progressLabel: "Progreso de los lotes",
      captionWaiting: "Esperando la respuesta de DeepSeek. Puede tardar hasta un minuto.",
      retry: "Reintentar",
      review: "Revisar",
    },
    /** One message per condition of the error taxonomy; each states the problem and the next step. */
    failures: {
      unauthorized: "Tu sesión terminó. Vuelve a iniciar sesión para continuar.",
      serverNotConfigured:
        "DeepSeek no está configurado en el servidor. Avisa a quien administra la aplicación.",
      upstreamAuth:
        "DeepSeek rechazó la clave de acceso del servidor. Avisa a quien administra la aplicación.",
      upstreamBalance:
        "La cuenta de DeepSeek no tiene saldo. Recárgala y vuelve a intentarlo.",
      overloaded:
        "DeepSeek está saturado o no responde. Espera un momento y pulsa «Reintentar».",
      timeout: "DeepSeek tardó demasiado en responder. Pulsa «Reintentar».",
      invalid: "DeepSeek respondió algo que no se pudo usar. Pulsa «Reintentar».",
      incomplete: "DeepSeek dejó descripciones sin agrupar. Pulsa «Reintentar».",
      offline:
        "No hay conexión con el servidor. Revisa tu internet y pulsa «Reintentar».",
      badRequest:
        "No se pudo enviar la solicitud. Recarga la página; si sigue igual, avisa a quien administra la aplicación.",
    },
  },

  /** Precios tab: price comparison between stores (Phase 5, UI-SPEC Copywriting Contract). */
  prices: {
    heading: "Precios",
    intro:
      "Compara el precio unitario de cada producto agrupado en cada tienda: neto de descuento y solo entre cantidades de la misma unidad (kilogramo, litro o pieza). Los filtros de arriba aplican a todo.",
    savings: {
      label: "Ahorro estimado",
      badge: "estimado",
      note: "Es lo que se habría ahorrado si cada compra se hubiera hecho al precio mediano de la tienda más barata de ese producto. Solo cuenta productos comparables con 2 o más tiendas, dentro de los filtros.",
    },
    columns: {
      product: "Producto",
      cheapest: "Tienda más barata",
      price: "Precio",
      stores: "Tiendas",
      saving: "Ahorro estimado",
    },
    /** Unit labels that follow a price: «$35.20 / kg». */
    units: {
      mass: "kg",
      volume: "L",
      piece: "pieza",
    },
    /** Value of a cell with nothing to show (no cheapest store, no saving). */
    none: "—",
    /** Price cell of a product whose purchases cannot be normalized. */
    notNormalized: "No normalizado",
  },

  errors: {
    importFailed:
      "No se pudieron procesar los archivos. Recarga la página y vuelve a intentarlo.",
  },

  dialogs: {
    logout: {
      title: "¿Cerrar sesión?",
      body: "Se borrarán las facturas cargadas. Tendrás que volver a soltar los archivos.",
      dismiss: "Seguir en la sesión",
      confirm: "Cerrar sesión",
    },
    resetAll: {
      title: "¿Quitar todas las facturas?",
      body: "Se borrarán las facturas cargadas y el reporte de esta sesión.",
      dismiss: "Conservar facturas",
      confirm: "Quitar todas",
    },
    deleteCategory: {
      unusedBody: "No está asignada a ningún proveedor ni concepto.",
      moveLabel: "Pasarlos a",
      dismiss: "Conservar categoría",
      confirm: "Borrar categoría",
    },
  },
} as const;
