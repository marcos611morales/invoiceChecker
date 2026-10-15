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
    heading: "Facturas cargadas",
    note: "Montos tal como vienen en cada XML; el cálculo de gasto llega después",
    columns: {
      date: "Fecha",
      supplier: "Proveedor",
      type: "Tipo",
      folio: "Folio",
      total: "Total",
      concepts: "Conceptos",
    },
    types: {
      income: "Ingreso",
      expense: "Egreso",
      payment: "Pago",
      transfer: "Traslado",
      payroll: "Nómina",
    },
    missingValue: "—",
    previous: "Anterior",
    next: "Siguiente",
    emptyHeading: "Ninguna factura válida",
    emptyBody: "Revisa los archivos rechazados arriba y vuelve a soltarlos.",
  },

  tabs: {
    ariaLabel: "Secciones",
    dashboard: "Dashboard",
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
  },

  charts: {
    trendHeading: "Gasto por mes",
    trendLegendBars: "Gasto mensual",
    trendTooltipRow: "Gasto",
    trendTableMonth: "Mes",
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
