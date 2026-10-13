# Feature Research

**Domain:** Browser-only expense analytics from received Mexican CFDI 4.0 XML invoices (coworking café, small team + accountant)
**Researched:** 2026-10-13
**Confidence:** MEDIUM overall. HIGH for everything derived from the 143 sample XMLs and the SAT/CFDI mechanics. LOW to MEDIUM for competitor comparisons: few comparable products turned up in search and none are well documented, so the competitor section leans on general knowledge of expense and accounting tools.

## Evidence from the sample data (143 XML, 2025)

These facts were measured on `Facturas/2025/*.xml`. They decide which "edge" features are table stakes here rather than nice-to-have. No RFCs or personal data are reproduced.

| Finding | Measured | Consequence |
|---------|----------|-------------|
| Duplicate UUIDs in the set | 0 of 143 | Dedup costs almost nothing but is still needed, because users re-drag folders. |
| `Descuento` present | 68 invoices at header level, 195 of 362 concepts (header discount = sum of concept discounts in every case) | Discounts are common (Walmart-type retail). `SubTotal` is pre-discount, and `ValorUnitario` is also pre-discount. |
| Arithmetic identity | `SubTotal - Descuento + Traslados - Retenciones = Total` held on every I and E invoice | Net-of-IVA must be derived from taxes, not copied from `SubTotal`. |
| Line sum vs header Total | 4 of 133 I invoices differ by exactly 0.01 | Header `Total` is the source of truth. Allocate or flag the 1-cent rounding. |
| `Importe` vs `Cantidad * ValorUnitario` | 1 concept of 362 mismatches | Never recompute `Importe`. Read it. |
| Zero-total "invoices" | 12 Ingreso from one bank supplier: "SERVICIOS DE FACTURACION", `SubTotal` 0.01, `Descuento` 0.01, `Total` 0 | Noise. They inflate invoice counts and drag per-invoice averages down. Needs an explicit rule. |
| IVA rates | 16% (272), 0% (220), no `Exento` seen; `ObjetoImp` 02 (340), 01 (21), 04 (1) | 0% lines carry a Traslado node. `ObjetoImp` 01 lines carry no tax node. Both need handling. |
| IEPS (`Impuesto` 003) | 3% (telecom), 8% (snack and food lines), 0% (frappé base): about 20 lines | IEPS is a real cost on top of IVA. It must not vanish in "sin IVA". |
| Retenciones (ISR or IVA withheld) | 0 in the sample | Support the field in the model, but keep the UI minimal. |
| `FormaPago` values | 28 (62), 03 (41), 04 (16), 99 (8), 31 (5), 30 (3), 01 (1), missing (7, all P) | Raw codes are unreadable. A SAT label map is table stakes. |
| `MetodoPago` | PUE 128, PPD 8, missing 7 | PPD invoices all carry `FormaPago` 99 ("Por definir"). The real form is in the P complement (`FormaDePagoP`). All 7 P docs link (`IdDocumento`) to a present PPD invoice. |
| `TipoRelacion` | 07 (anticipo application) x6, 04 (sustitución) x1 | See "Anticipo and substitution" below. |
| Credit notes (E) | 3, series "NCP", concept "Cancelación Prepago", all `TipoRelacion` 07, linked to a present Ingreso | E-as-subtraction is correct. It nets an advance-payment cycle (I 1000 + I 200 + final I 1401.78 - E 1000 - E 200 = 1401.78). |
| `Unidad` text | H87: "PIEZAS", "Pieza", "PIEZA *", "pz", "UN", "un", "Unidad(es)", and more. `Unidad` missing on 12 concepts | Free-text `Unidad` is unusable. `ClaveUnidad` (SAT catalog code) is the reliable key. |
| `ClaveUnidad` in use | H87 (piece, about 260), E48 (service unit), ACT (activity), XUN, XPK (package), KGM (kg), LTR (liter), X4G | Only KGM and LTR give a real physical quantity. H87 and XPK need the pack size from the description. |
| Pack size in text | "12/1LT", "5KG", "CJ20KG", "50 PZ", "355 ML" in `Descripcion`; `NoIdentificacion` (SKU/EAN) on 293 of 362 concepts | Price per kg or liter needs description parsing. SKU is a strong same-store grouping hint. |
| `ClaveProdServ` | 120 distinct codes in 362 concepts, spanning about 30 two-digit SAT segments | Raw numeric codes are meaningless to users. Bundling all roughly 52k catalog rows is heavy. |
| Same RFC with different names | 0 of 39 suppliers | The supplier key is RFC. |
| Cancelled CFDI | The XML has no cancellation status field | See Cancelled CFDI below. |

## Feature Landscape

### Table Stakes (Users Expect These)

Items marked "decided" are already locked by the user. Items marked "research-added" came out of this research and should be raised for confirmation, since the project rule is to ask before inferring.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multi-file XML drag-and-drop with progress and per-file error list (decided) | Core input. Users drop a whole month or year folder. | LOW | Parse in a Web Worker if volume grows. 143 files is trivial on the main thread. Namespace-aware `DOMParser`. Show "N cargadas, M duplicadas, K inválidas". |
| Robust CFDI 4.0 parsing: header, Emisor, Receptor, Conceptos, taxes, TimbreFiscalDigital UUID (decided) | The data foundation. | MEDIUM | Parse `Impuestos` per concept and at header level. Handle optional `Descuento`, `TipoCambio`, `NoIdentificacion`, `Unidad`, and `CfdiRelacionados`. Use `Importe`, never recompute it. |
| Invoice-type treatment I add, E subtract, P exclude (decided) | Prevents double counting and refunds being counted as spending. | LOW | Make it visible. Show a badge per type, and a "Excluidos: 7 complementos de pago" line, so users trust the totals. |
| Duplicate detection by UUID (research-added) | Re-dropping a folder or the same invoice in two folders is the most common real-world error. Counting twice silently corrupts every total. | LOW | Key on the UUID from the Timbre, not on the filename. First occurrence wins. Report "N duplicados ignorados". Case-normalize the UUID. Only a different UUID with identical issuer, folio, and total is a "possible duplicate"; just warn about those. |
| IVA toggle con IVA / sin IVA (decided) | Café owner thinks in costs. Accountant thinks in net base. | MEDIUM | Do NOT define "sin IVA" as `SubTotal`. See "Amount semantics" below. Must apply consistently to every chart, table, average, ranking, and the export. |
| Amount semantics: discount-aware net (research-added) | Walmart-style invoices carry `Descuento` on 195 concepts. Using `SubTotal` or `Importe` overstates spend and price. | MEDIUM | See the definitions in "Amount semantics". This is the single most important correctness item. |
| Total spend KPIs and monthly trend (research-added) | Every expense dashboard opens with "how much this month vs last month". | LOW | Bar or line chart by month plus KPI tiles: total, invoice count, average per invoice, number of suppliers. |
| Rankings by category and by supplier (decided) | The stated core value, "en qué gastamos más". | LOW | Top-N horizontal bars with share of total, plus a full table with sort. |
| Averages: monthly, per invoice, per category (monthly), per supplier / ticket (decided) | Stated requirement. | LOW | Define the denominators explicitly. Monthly average over months with data, or over the selected range? Make that a visible setting or label. Exclude zero-total noise invoices from "per invoice". |
| Filters: date/month, supplier, category, payment form (decided) | Stated requirement. | MEDIUM | One global filter state drives KPIs, charts, tables, and export. Multi-select supplier and category. Month picker plus custom range. |
| Readable SAT labels for FormaPago and MetodoPago (research-added) | Raw "28", "99", "PUE" is unreadable in a filter dropdown and in Excel. Accountants expect the SAT wording. | LOW | Bundle the tiny `c_FormaPago` (about 22 rows) and `c_MetodoPago` (PUE/PPD) catalogs. Show "28 - Tarjeta de débito". Unknown code falls back to the raw code. |
| Readable labels for the fiscal fields shown in tables or Excel: TipoDeComprobante, UsoCFDI, ClaveUnidad (research-added) | Same reason. Cheap. | LOW | Small static maps: I/E/P, G01/G02/G03/S01/CP01 and others, plus the ClaveUnidad codes seen (H87 Pieza, KGM Kilogramo, LTR Litro, XPK Paquete, E48 Unidad de servicio, ACT Actividad). |
| Per-supplier default category plus per-line override (decided) | Walmart sells everything, so supplier-only mapping is not enough. | MEDIUM | Resolution order: line override, then supplier default, then "Sin categoría". Surface "N conceptos sin categoría" as a to-do. Category totals must still sum to the invoice total. |
| Editable categories: create, rename, delete (decided) | Stated requirement. | LOW | Deleting a category needs a reassign-or-uncategorize choice. Store category by stable id, not by name, so renames do not orphan assignments. |
| Unit-price comparison across stores (decided) | The second half of the core value. | HIGH | Depends on product grouping, unit normalization, and net-price math. See the differentiators below. |
| Multi-sheet Excel export honoring filters (decided) | Accountant is a user. Excel is how he works. | MEDIUM | Sheets: Facturas, Conceptos, Resumen por categoría, por proveedor, por mes, and a "Parámetros" sheet recording the active filters, the IVA mode, and the generation date. Use real numbers and dates with number formats, not strings. Export respects the IVA toggle. |
| localStorage persistence of categories, assignments, and LLM groupings (decided) | Without it the user redoes the review every visit. | MEDIUM | Version the stored schema. Provide "Exportar/Importar configuración" as a JSON file (see differentiators) because localStorage is per browser and can be wiped. |
| Shared password gate (decided) | Protects the page and the DeepSeek proxy. | LOW | Server-side check. Rate-limit the LLM route. |
| Es-MX UI, MXN formatting, es-MX month names (decided) | Audience. | LOW | `Intl.NumberFormat('es-MX', {currency:'MXN'})`. Dates parsed from the CFDI `Fecha` string as local time, to avoid UTC day shifts. |
| Empty, loading, and error states (research-added) | A dashboard with no data must say what to do. | LOW | First-run empty state with the drop zone. Clear message for non-CFDI XML, CFDI 3.3, or malformed files. |
| Visible data-quality summary (research-added) | The user must be able to trust the numbers. | LOW | Single panel: loaded, duplicates ignored, P excluded, zero-total hidden, possibly substituted, invoices without category. |

### Differentiators (Competitive Advantage)

These align with the stated Core Value: "en qué gastamos más y dónde nos sale más barato cada producto".

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| LLM product grouping across stores, user-reviewed (decided) | Descriptions differ by store ("JAMON ZWAN VIRGINIA1X1KG" vs another store's wording). Generic expense tools never do this. | HIGH | Send only descriptions (plus the unit code and the pack text), never RFC or amounts. Dedup descriptions before sending. Batch. Return group id, canonical name, suggested category, and normalized size. Present as a review queue with confidence, merge, split, and "reject". Persist accepted groups. Never auto-apply silently. |
| Unit-price comparison across stores with normalized unit (decided) | Directly answers "where is it cheapest". | HIGH | See "Unit normalization" below. Show a per-group table: store, last price, min, max, average, number of purchases, savings if bought at the cheapest store. |
| Discount-aware effective unit price (research-added) | A store's shelf price and its paid price differ by `Descuento`. Comparing `ValorUnitario` ranks stores wrongly. | LOW | `(Importe - Descuento) / Cantidad`. Needs no extra data. Pure correctness, huge payoff for Walmart lines. |
| Resolve "99 Por definir" payment form from the Pago complement (research-added) | All 8 PPD invoices show 99, so the payment-form filter would lump real card payments under "Por definir". The linked P holds the real form (`FormaDePagoP`, here 04 credit card). | MEDIUM | Parse the P, map `DoctoRelacionado.IdDocumento` to the invoice UUID, and display "Tarjeta de crédito (vía complemento)". P still contributes zero spend. Fall back to "99 - Por definir" if the P is not loaded. Depends on keeping P records in the model even though they are excluded from amounts. |
| Anticipo and substitution awareness via `CfdiRelacionados` (research-added) | Real data contains an advance-payment cycle (I + I + final I with E credit notes, relation 07) and one substitution (04). Naive summing still nets out for 07, but the user sees confusing "Cancelación Prepago" rows. A 04 relation means the substituted CFDI was cancelled. | MEDIUM | Offline cancellation heuristic: if a loaded CFDI has `TipoRelacion` 04, flag the related UUID as "sustituido, probablemente cancelado" and exclude it by default, with an override. For 07, group the related documents under one expandable row and label "Anticipo / Aplicación de anticipo". Do NOT try to reconstruct accounting for advances. |
| Savings opportunity view (research-added) | Turns the comparison into money: "si hubieras comprado todo en la tienda más barata, ahorras $X". | MEDIUM | Needs the quantity-weighted unit price per group. Present as an estimate with the assumption stated. Defer if the comparison table is slow to land. |
| Category and supplier drill-down (research-added) | Click a bar and see underlying invoices and lines. | MEDIUM | Same data model, a filtered table, and a link to the filter state. The most requested interaction in analytics UIs. |
| Month-over-month change per category (research-added) | "Subió la luz 20%". Cheap once monthly series exist. | LOW | Delta and sparkline per row. |
| Price-history chart per product group (research-added) | Shows whether a price crept up over time at one store. | MEDIUM | One line per store. Depends on the grouping. |
| Config export/import as JSON (research-added) | localStorage is per browser. Moving to the accountant's laptop or surviving a cache wipe would otherwise lose hours of review. | LOW | Single file with categories, supplier defaults, line overrides, and groups. Version field. Clearly not "sync". |
| Explainable totals ("¿por qué este número?") (research-added) | Accountant trust. | LOW | Tooltip that lists the included types, the discounts, the IVA mode, and the excluded counts. |
| Bundled ClaveProdServ labels at segment/family level (research-added) | Gives a free fallback categorization signal and readable Excel without shipping 52k rows. | MEDIUM | Ship only the 2-digit segment and 4-digit family names (or only the codes actually seen) lazily loaded. Use as an extra LLM hint (code plus description improves grouping). Full-label lookup is optional (see below). |
| Cancelled-CFDI check against SAT (research-added) | Real cancellation status. Cancelled invoices are not an expense. | HIGH | Not offline-possible. See "Cancelled CFDI". Recommend deferring to v1.x, opt-in. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Server-side storage of invoices or results | "Don't lose my data". | Explicitly out of scope and a privacy decision. Also adds an auth, retention, and GDPR-like surface. | Config JSON export/import. Re-drop the XMLs. |
| Per-user accounts and roles | Partners and accountant want separate access. | Out of scope. One shared password is enough. | Shared password. |
| PDF parsing / OCR | Some invoices exist only as PDF. | Out of scope. Every PDF here has an XML, and OCR is error-prone. | Tell the user to obtain the XML. |
| Auto-applying LLM groupings and categories without review | Saves clicks. | Wrong merges (e.g. "leche entera" with "leche deslactosada", or 1 L with 12 x 1 L) silently corrupt the price comparison. The LLM sees only descriptions. | Review queue with accept/split. Persist only accepted groups. Show confidence. |
| Sending RFC, amounts, or full invoices to the LLM | Richer context. | Violates the stated privacy constraint. Not needed. | Descriptions, unit code, and pack text only. |
| Automatic SAT cancellation lookup in v1 | "Know if it was cancelled". | SAT endpoint sends no CORS headers (verified), so the browser cannot call it. A server proxy would transmit issuer RFC, receiver RFC, UUID, and total to SAT through our server: a new data flow the user excluded. SOAP, latency, and rate limits too. | Offline 04-substitution heuristic plus a manual "marcar como cancelada" toggle per invoice. Consider an opt-in proxy later. |
| SAT descarga masiva integration (FIEL, e.firma) | "Pull invoices automatically". | Handling private keys and credentials in a browser/web app is a security and legal exposure. Far outside the stated scope. | Manual XML upload. |
| Accounting features: IVA acreditable, DIOT, póliza, bank reconciliation | Accountants love them. | A different product (Contpaqi/Aspel territory). Needs payment dates, deductibility rules, and XML validation. Huge scope. | Export clean Excel for the accountant to take over. |
| Full SAT `c_ClaveProdServ` catalog (about 52k rows) bundled client-side | "Show a label for every code". | Multi-MB download for a feature that the user's own categories already replace. | Segment/family labels only, or lazy-load per code seen. |
| Editing invoice amounts in the UI | "Fix wrong data". | Makes dashboard totals diverge from the fiscal documents. | Overrides apply to category and grouping only, never to amounts. |
| Multi-currency conversion | CFDIs can be USD. | The sample is entirely MXN (P docs use XXX). Added `TipoCambio` logic and rate sources add risk for no current need. | Keep `Moneda` in the model. Show a warning for non-MXN invoices and exclude them or convert with the invoice's own `TipoCambio` only. Decide when one appears. |
| Real-time collaboration or sync across devices | Partners want to see the same state. | localStorage is per browser by design. | Config JSON import/export. |
| Budget alerts, forecasts, ML anomaly detection | Standard in commercial expense tools. | No budget data and only 8 months of dense history. Speculative. | Month-over-month deltas. Revisit later. |
| Sales or income analysis | Natural next question. | Out of scope: the files are received expenses. | Not now. |

## Special Topics

### Amount semantics (con IVA / sin IVA, descuentos, IEPS, retenciones)

The identity verified on every sample invoice is `Total = SubTotal - Descuento + Traslados - Retenciones`.

| View | Definition (invoice level) | Notes |
|------|----------------------------|-------|
| Con IVA | `Total` (header) | What actually left the bank. It already includes discounts, IEPS, and retenciones. |
| Sin IVA | `Total - IVA trasladado (002) + IVA retenido (002)` | Equivalent to `SubTotal - Descuento + IEPS (003) - ISR retenido (001)`. Keeps IEPS. Excludes IVA. |
| Do not use | `SubTotal` | Pre-discount, so it overstates by `Descuento`. Use it only in the Excel as an informational column. |

Rules:

- **Descuento**: Always net it. Line-level: `net = Importe - Descuento`. Keep gross `Importe` and `Descuento` as separate Excel columns so the accountant can reconcile.
- **IEPS (003)**: A cost, not recoverable VAT. Include in both views. In "sin IVA" it stays in. Show IEPS as its own column in the Conceptos and Facturas sheets. Do not build IEPS-specific reports (see anti-features).
- **Retenciones**: None in the sample. The parser must read them (header `TotalImpuestosRetenidos` and the Retencion nodes) so totals stay correct if a freelancer or rent invoice appears. Do not add a UI beyond a column in the export.
- **IVA 0%** (`Tasa` 0.000000) and **Exento**: no IVA amount. The two views are equal. `ObjetoImp` 01 means "no objeto de impuesto", with no tax node.
- **Line-level views**: apply the same formula per line using that line's own tax nodes. Reconcile to the header `Total`: 4 of 133 invoices are off by 0.01. Decision to confirm with the user: attach the rounding cent to the largest line, or show a separate "Redondeo" row. The simplest honest option is to keep header totals authoritative for invoice-level KPIs and accept 0.01 drift in category totals, and to disclose it.
- **Zero-total invoices**: the 12 "SERVICIOS DE FACTURACION" ($0.01 less $0.01) from the bank supplier. Recommended default: exclude from counts and averages when `Total = 0`, list them in the data-quality panel. Confirm with the user.
- **Egreso (E)** uses the same formulas with the sign flipped. The 3 sample credit notes carry 16% IVA (for example SubTotal 862.07 gives Total 1000), so the sin IVA view of an E is its negative SubTotal.

### Unit normalization for price comparison

Do it in tiers. The tier is stored with the result so the UI can say how sure the comparison is.

| Tier | Source | Handles | Reliability |
|------|--------|---------|-------------|
| 1 | `ClaveUnidad` is KGM or LTR (also GRM, MLT, if seen), with `Cantidad` as the real quantity | "MAN GALA 4.605 kg at 49.90", "JITOMAT 0.53 kg", fuel at 20.83 L | High. Store as price per kg or per liter. Convert g to kg and ml to L. |
| 2 | Pack size parsed from `Descripcion` (regexes like `12/1LT`, `5KG`, `355ML`, `50 PZ`, `CJ20KG`) with an LLM fallback, for H87, XPK, XUN, and KGM with `Cantidad` 1 | "PEPPER 2KG", "12/1LT", bags sold per kg with the size in the name | Medium. Ambiguity is real ("KG 40X60 NEGRA ... 25 KG" is a price per kg, but the name says 25 kg). Always user-reviewable. |
| 3 | Per purchased unit (piece, package) | When no size is found | Comparable only within the same pack. Mark clearly as "no normalizado". |

Rules:

- Use `ClaveUnidad` (the catalog code) as the key, never the free-text `Unidad`. The sample has more than 10 spellings of "pieza", and 12 concepts have no `Unidad` at all.
- The comparison unit is per product group. Group "unit family" (mass, volume, count) is decided once, and conversions apply only within a family. Never compare a kg price to a liter price.
- Always compute the effective price as `(Importe - Descuento) / (Cantidad * size_in_base_unit)`.
- Show, next to every comparison, the number of purchases and the date range, so a one-off price does not look like a trend.
- Let the user override the normalization for a group ("esto es por pieza", "este paquete trae 100").
- Use SKU (`NoIdentificacion`) as a within-store grouping hint only. Cross-store SKUs do not match.
- Fuel (LTR, "MAGNA"), services (E48, ACT), and utilities should not enter the product comparison by default. Allow the user to mark a group as "no comparable".

### Cancelled CFDI

- The XML carries no cancellation status. Cancellation is stored at the SAT. Only the SAT `ConsultaCFDIService` (SOAP, public) can answer, given the UUID, issuer RFC, receiver RFC, and total.
- OPTIONS preflight to the SAT endpoint returned no `Access-Control-Allow-Origin` (checked 2026-10-13), so a direct browser call fails. A call needs the Vercel server. That moves RFCs, UUIDs, and totals through our server and to SAT, which is outside the "never saved, never uploaded" posture.
- Recommendation: v1 ships an offline heuristic (relation 04 marks the substituted CFDI as likely cancelled) plus a manual per-invoice "Cancelada" toggle persisted in localStorage. Treat the SAT lookup as a v1.x opt-in feature, behind the existing password and with an explicit disclosure of what is sent. Note that a CFDI can be cancelled after a user has already filed or loaded it, and that cancelling an invoice can need the receiver's acceptance, so "cancelada" is a moving state. Show "estatus al [fecha de consulta]".
- If the lookup is ever built, cache results in localStorage and cap concurrency. SAT availability is not guaranteed.

### SAT catalog labels

| Catalog | Size | Approach |
|---------|------|----------|
| c_FormaPago | about 22 | Bundle fully (01 Efectivo, 02 Cheque nominativo, 03 Transferencia electrónica de fondos, 04 Tarjeta de crédito, 05 Monedero electrónico, 06 Dinero electrónico, 08 Vales de despensa, 12 Dación en pago, 13 Pago por subrogación, 14 Pago por consignación, 15 Condonación, 17 Compensación, 23 Novación, 24 Confusión, 25 Remisión de deuda, 26 Prescripción o caducidad, 27 A satisfacción del acreedor, 28 Tarjeta de débito, 29 Tarjeta de servicios, 30 Aplicación de anticipos, 31 Intermediario pagos, 99 Por definir). |
| c_MetodoPago | 2 | PUE Pago en una sola exhibición, PPD Pago en parcialidades o diferido. |
| c_TipoDeComprobante | 5 | I Ingreso, E Egreso, P Pago, T Traslado, N Nómina. |
| c_UsoCFDI | about 24 | Bundle the commonly seen ones (G01, G02, G03, S01, CP01) and fall back to the raw code. |
| c_ClaveUnidad | thousands | Bundle only the handful actually used (H87, KGM, LTR, XPK, E48, ACT, XUN, GRM, MLT) and fall back to the raw code. |
| c_ClaveProdServ | about 52k | Do not bundle in full. Use segment/family names or only codes seen. Optional lazy-loaded subset later. |

The catalogs change slowly, so a static JSON checked into the repo is fine. Pin the SAT catalog version in a comment. Content comes from the SAT's CFDI 4.0 catalogs (to be verified against the official `catCFDI` file before shipping the labels). Confidence MEDIUM for the exact wording of rarely used rows, HIGH for the codes seen in the sample.

### Anticipo and substitution

- Sample: three advance invoices (I, 1000, 200, and 4000) are later applied by a final I (relation 07), and each advance is then offset by an E "Cancelación Prepago" (relation 07). The net spend is correct if I add and E subtract, which matches the user's decision. Flagging it as a note rather than a bug is the right UX.
- Substitution: one I (relation 04) replaces an invoice that is not in the set. If the replaced one were also loaded, both would count unless the heuristic excludes it.

## Feature Dependencies

```
XML parser (CFDI 4.0 model incl. taxes, Descuento, relations, Timbre UUID)
    ├──requires──> UUID dedup
    ├──requires──> Type rules (I+ / E- / P excluded, zero-total handling)
    │                   └──requires──> Amount semantics (con/sin IVA, descuento, IEPS, retenciones)
    │                                       ├──enhances──> All KPIs, averages, rankings, charts
    │                                       └──requires──> Excel export (same formulas)
    ├──requires──> SAT label maps (FormaPago, MetodoPago, TipoComprobante, UsoCFDI, ClaveUnidad)
    │                   └──enhances──> Payment-form filter, Excel readability
    ├──enhances──> Payment-form resolution from P complements (needs P kept in model)
    ├──enhances──> Anticipo/substitution flags and the cancelled-heuristic
    └──requires──> Filters (global state) ──requires──> Dashboard views and Excel export

Categories (editable, stable ids)
    └──requires──> Supplier default ──requires──> Line override
                        └──enhances──> Category rankings, monthly category averages

Product grouping (LLM + review)
    ├──requires──> Parser (descriptions, ClaveUnidad, NoIdentificacion)
    ├──requires──> DeepSeek proxy route + password gate
    ├──requires──> localStorage persistence of accepted groups
    └──enables──> Unit normalization ──requires──> Effective net price (Descuento)
                        └──enables──> Cross-store unit-price comparison
                                           └──enables──> Savings view, price history

localStorage persistence ──enhances──> Config JSON export/import

Cancelled SAT lookup ──conflicts──> "no data leaves the browser" posture (needs server proxy)
LLM auto-apply ──conflicts──> Price-comparison correctness (needs human review)
```

### Dependency Notes

- **Amount semantics must exist before any chart.** Every number on the page derives from it, and the Excel export needs the same formulas. Build it once as a tested pure function and reuse it everywhere.
- **Unit-price comparison needs three layers**: grouping, unit normalization, and net price. Each layer must be separately correct. If the grouping is wrong, the unit work is wasted.
- **P records stay in the model.** They add zero spend but supply payment-form resolution and "already paid" information. Excluding them at parse time would lose that.
- **Filters are global state.** Dashboard widgets and Excel export must read the same filtered selector, or the export will not honor the filters.
- **Categories use stable ids**, so renames and deletes do not orphan the supplier defaults, line overrides, and LLM suggestions that reference them.

## MVP Definition

### Launch With (v1)

- [ ] Drag-and-drop multi-XML load with error list and UUID dedup. It is the data foundation.
- [ ] CFDI 4.0 parser with taxes, Descuento, relations, and P kept in the model.
- [ ] Type rules (I+, E-, P excluded) with zero-total handling and a data-quality panel.
- [ ] Amount semantics with a correct IVA toggle (discount-aware, IEPS kept in sin IVA).
- [ ] SAT label maps for FormaPago, MetodoPago, TipoDeComprobante, UsoCFDI, and ClaveUnidad.
- [ ] KPIs, monthly trend, averages (monthly, per invoice, per category, per supplier), and rankings.
- [ ] Global filters (date/month, supplier, category, payment form).
- [ ] Editable categories with supplier default and line override.
- [ ] Multi-sheet Excel export honoring filters and the IVA mode, with a "Parámetros" sheet.
- [ ] localStorage persistence plus config JSON export/import.
- [ ] Shared password gate and the DeepSeek proxy route.
- [ ] LLM product grouping and category suggestions with a review queue.
- [ ] Unit-price comparison with tiered unit normalization, effective net price, and manual override.

### Add After Validation (v1.x)

- [ ] Payment-form resolution for PPD from the P complement. Add when the user notices "Por definir" in the filter. It needs no new infrastructure.
- [ ] 04-substitution cancelled heuristic and 07-anticipo grouping. Add when the user sees confusing credit-note rows or when a substituted invoice is double counted. (Cheap enough to fold into v1 if the parser already reads `CfdiRelacionados`.)
- [ ] Drill-down, month-over-month deltas, and price-history chart.
- [ ] Savings view.
- [ ] Opt-in SAT cancellation lookup through a server proxy, with disclosure.

### Future Consideration (v2+)

- [ ] ClaveProdServ lookup at full-catalog level. The user's own categories already do the job.
- [ ] Multi-currency. Only if a non-MXN invoice appears.
- [ ] Budget and forecasting. Needs budget input and more history.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| XML load + parser + UUID dedup | HIGH | MEDIUM | P1 |
| Type rules + zero-total handling | HIGH | LOW | P1 |
| Discount-aware amount semantics + IVA toggle | HIGH | MEDIUM | P1 |
| SAT label maps | MEDIUM | LOW | P1 |
| KPIs, averages, rankings, filters | HIGH | MEDIUM | P1 |
| Categories (supplier default + line override) | HIGH | MEDIUM | P1 |
| Excel multi-sheet export | HIGH | MEDIUM | P1 |
| localStorage + config JSON export/import | HIGH | LOW | P1 |
| Password gate + LLM proxy | HIGH | LOW | P1 |
| LLM grouping + review queue | HIGH | HIGH | P1 |
| Unit-price comparison + normalization | HIGH | HIGH | P1 |
| Data-quality panel | MEDIUM | LOW | P1 |
| PPD payment-form resolution via P | MEDIUM | MEDIUM | P2 |
| 04/07 relation flags + cancelled heuristic | MEDIUM | MEDIUM | P2 |
| Drill-down, MoM deltas | MEDIUM | MEDIUM | P2 |
| Price-history chart, savings view | MEDIUM | MEDIUM | P2 |
| SAT cancellation lookup (opt-in) | MEDIUM | HIGH | P3 |
| Full ClaveProdServ catalog | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

Honest note: search surfaced few comparable products and none with public feature sheets worth citing. Treat this as LOW confidence positioning, not a market study.

| Feature | SAT portal / visores and XML-to-Excel tools | Accounting suites (Contpaqi, Aspel, Alegra and similar) | Generic expense apps / Sheets importers | Our approach |
|---------|------------------------------------------------|----------------------------------------------------------|--------------------------------------------------------|--------------|
| Bulk XML ingest | Yes, flat lists | Yes, via descarga masiva | Some (e.g. a Google Sheets CFDI importer with per-concept lines and categories) | Browser-only drag-and-drop, no server storage |
| Cancellation status | Yes, SAT-linked | Yes | Rare | Offline heuristic first, opt-in lookup later |
| Spend by category and supplier | Basic or none | Via chart of accounts, accountant-oriented | Yes | Custom editable categories at supplier and line level |
| Product-level price comparison across stores | No | No | No | Core differentiator via LLM grouping plus unit normalization |
| Discount and IEPS awareness | Raw fields | Yes (accounting) | Usually no | Explicit net-price semantics |
| Excel export | Yes, flat | Yes, accounting reports | Yes | Multi-sheet, filter-aware, with a parameters sheet |
| Accountant-grade compliance (DIOT, IVA acreditable) | Partial | Yes | No | Deliberately excluded |

The differentiating space is clear: no tool found does cross-store product price comparison from CFDI line items.

## Sources

- Sample CFDI set, 143 XML (`Facturas/2025`), analyzed with local scripts for field usage, discount arithmetic, relations, tax types, and units. HIGH confidence for these.
- SAT consultation service (UUID + issuer RFC + receiver RFC + total; status, cancellability, and cancellation-status fields): [cfdibills API docs](https://cfdibills.readthedocs.io/en/latest/_modules/cfdibills/api.html), [phpcfdi sat-estado-cfdi](https://packagist.org/packages/phpcfdi/sat-estado-cfdi), [SW WS Consulta CFDI v1.1](https://developers.sw.com.mx/wp-content/uploads/2018/08/Documentación-WS-Consulta-CFDI-v1.1.pdf). MEDIUM confidence (secondary sources). The CORS finding comes from a direct OPTIONS request to the SAT endpoint on 2026-10-13: HIGH for that one observation.
- FormaPago, MetodoPago, and TipoRelacion semantics (PPD pairs with FormaPago 99 and a later complemento de pago; relation 04 sustitución, 07 anticipo): [Facturama](https://facturama.mx/blog/que-significa/forma-de-pago-por-definir/), [GOBL mx-cfdi-v4](https://docs.gobl.org/addons/mx-cfdi-v4), [Walmart México CFDI 4.0 NC and complemento de pago guide](https://www.walmartmexico.com/content/dam/walmart-mexico/documents/proveedores/Manejo%20de%20cfdi%20v4.0%20NC%20y%20Complemento%20pago%20Dic23.pdf). MEDIUM. One source claims code 99 is no longer valid in 4.0, but the sample data and the SAT error matrix contradict that. The catalog wording should be verified against the official SAT `catCFDI` file before shipping.
- Tools landscape: [EdiFact visor xml](https://www.edifact.com.mx/masinfo/visor-xml), [1clic Factura importer (Google Workspace Marketplace)](https://workspace.google.com/marketplace/app/1clic_factura_importador/322907309703), [CFDI to Excel extraction guide](https://imagetotable.ai/blog/mexican-cfdi-invoice-excel-extraction). LOW confidence for competitor positioning.

---
*Feature research for: browser-only CFDI 4.0 expense analytics (coworking café)*
*Researched: 2026-10-13*
