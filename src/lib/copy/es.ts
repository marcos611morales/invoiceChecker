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
      "Tus facturas se procesan en este navegador y no se suben a ningún servidor",
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
    },
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
    from: "Desde",
    to: "Hasta",
    all: "Todo",
    thisYear: "Este año",
    last3: "Últimos 3 meses",
    dateHelper: "Para ver un solo mes, elige el mismo mes en Desde y Hasta.",
    searchSupplier: "Buscar proveedor",
    searchForma: "Buscar forma de pago",
    clearSuppliers: "Limpiar proveedores",
    clearFormas: "Limpiar formas de pago",
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
  },
} as const;
