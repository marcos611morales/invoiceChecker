---
phase: 01-acceso-protegido-y-carga-de-facturas
reviewed: 2026-10-14T00:00:00Z
depth: standard
files_reviewed: 108
files_reviewed_list:
  - .env.example
  - .gitignore
  - .vercelignore
  - AGENTS.md
  - README.md
  - components.json
  - e2e/smoke.spec.ts
  - eslint.config.mjs
  - next.config.ts
  - package.json
  - playwright.config.ts
  - pnpm-workspace.yaml
  - scripts/anonymize-fixture.mjs
  - scripts/check-bundle-secrets.mjs
  - scripts/smoke-auth.mjs
  - src/app/api/auth/login/route.ts
  - src/app/api/auth/logout/route.ts
  - src/app/globals.css
  - src/app/layout.tsx
  - src/app/login/LoginForm.test.tsx
  - src/app/login/LoginForm.tsx
  - src/app/login/page.tsx
  - src/app/page.tsx
  - src/components/AppToaster.tsx
  - src/components/ThemeToggle.tsx
  - src/components/ui/accordion.tsx
  - src/components/ui/alert-dialog.tsx
  - src/components/ui/alert.tsx
  - src/components/ui/badge.tsx
  - src/components/ui/button.tsx
  - src/components/ui/card.tsx
  - src/components/ui/empty.tsx
  - src/components/ui/field.tsx
  - src/components/ui/input-group.tsx
  - src/components/ui/input.tsx
  - src/components/ui/label.tsx
  - src/components/ui/progress.tsx
  - src/components/ui/scroll-area.tsx
  - src/components/ui/separator.tsx
  - src/components/ui/sonner.tsx
  - src/components/ui/spinner.tsx
  - src/components/ui/table.tsx
  - src/components/ui/textarea.tsx
  - src/components/ui/tooltip.tsx
  - src/domain/cfdi/parseCfdi.anon.test.ts
  - src/domain/cfdi/parseCfdi.realdata.test.ts
  - src/domain/cfdi/parseCfdi.rechazos.test.ts
  - src/domain/cfdi/parseCfdi.test.ts
  - src/domain/cfdi/parseCfdi.ts
  - src/domain/cfdi/types.ts
  - src/domain/import/applyBatch.ts
  - src/domain/import/classifyFile.ts
  - src/domain/import/import.test.ts
  - src/domain/import/report.ts
  - src/domain/import/types.ts
  - src/features/invoices/InvoiceTable.test.tsx
  - src/features/invoices/InvoiceTable.tsx
  - src/features/invoices/columns.ts
  - src/features/report/ImportReport.test.tsx
  - src/features/report/ImportReport.tsx
  - src/features/report/ReportAccordions.tsx
  - src/features/report/SummaryCards.tsx
  - src/features/shell/AppShell.tsx
  - src/features/shell/LogoutButton.tsx
  - src/features/shell/TopBar.tsx
  - src/features/shell/guards.test.tsx
  - src/features/shell/useBeforeUnload.ts
  - src/features/upload/EmptyDropzone.tsx
  - src/features/upload/ProcessingIndicator.tsx
  - src/features/upload/UploadRoot.test.tsx
  - src/features/upload/UploadRoot.tsx
  - src/features/upload/useImport.test.tsx
  - src/features/upload/useImport.ts
  - src/lib/client/ingest.test.ts
  - src/lib/client/ingest.ts
  - src/lib/client/logout.ts
  - src/lib/client/navigation.ts
  - src/lib/client/theme.test.ts
  - src/lib/client/theme.ts
  - src/lib/client/themeScript.ts
  - src/lib/copy/es.ts
  - src/lib/copy/messages.test.ts
  - src/lib/copy/messages.ts
  - src/lib/format.test.ts
  - src/lib/format.ts
  - src/lib/safeNext.test.ts
  - src/lib/safeNext.ts
  - src/lib/server/session.test.ts
  - src/lib/server/session.ts
  - src/lib/utils.ts
  - src/proxy.ts
  - src/stores/sessionStore.test.ts
  - src/stores/sessionStore.ts
  - tests/fixtures.guard.test.ts
  - tests/fixtures/cfdi/anon/anon-egreso.xml
  - tests/fixtures/cfdi/anon/anon-ingreso-descuento.xml
  - tests/fixtures/cfdi/anon/anon-pago.xml
  - tests/fixtures/cfdi/egreso-relacionado.xml
  - tests/fixtures/cfdi/ingreso-bom-decl.xml
  - tests/fixtures/cfdi/ingreso-multiconcepto-descuento.xml
  - tests/fixtures/cfdi/ingreso-sin-impuestos.xml
  - tests/fixtures/cfdi/pago-pago20.xml
  - tests/fixtures/cfdi/rechazos/cfdi33.xml
  - tests/fixtures/cfdi/rechazos/no-es-cfdi.xml
  - tests/support/cfdiVariants.ts
  - tsconfig.json
  - vitest.config.mts
  - vitest.setup.ts
findings:
  critical: 0
  warning: 4
  info: 8
  total: 12
status: issues_found
---

# Phase 1: Informe de revisión de código

**Revisado:** 2026-10-14
**Profundidad:** standard
**Archivos revisados:** 108
**Estado:** issues_found

## Resumen

Se leyeron completos los archivos prioritarios (proxy, sesión, rutas de auth, `safeNext`, `next.config.ts`, `check-bundle-secrets`, `parseCfdi`, dominio de importación, `ingest`, `sessionStore` y los componentes de feature). Los archivos generados de shadcn y los fixtures XML tuvieron una pasada ligera.

Comprobaciones ejecutadas: `pnpm tsc --noEmit` pasa sin errores. `pnpm eslint .` termina con 0 errores y 1 warning (ver IN-08). `pnpm vitest run` pasa con 19 archivos y 219 tests.

Cumplimiento de las reglas de `CLAUDE.md`: no hay `any`, `@ts-ignore`, `@ts-nocheck` ni `!` no-null en `src/`, `tests/`, `e2e/` ni `scripts/`. El único `as` con cast (`as unknown as typeof window.matchMedia`) está en un test. Los datos externos (cuerpo del login, entorno) se validan con zod.

La puerta de acceso está bien construida:
- Falla cerrada cuando faltan las variables de entorno.
- Comparación de contraseña en tiempo constante.
- JWT fijado a HS256.
- Claim de contraseña con HMAC, de modo que cambiar `APP_PASSWORD` invalida las sesiones.
- Guarda de redirección abierta con revalidación posterior a la normalización.
- `/api/*` devuelve 401 y no una redirección.

No se encontró ningún defecto crítico. Sí hay cuatro warnings reales: dos de robustez en la carga de archivos y en el cierre de sesión, y dos de endurecimiento de seguridad (fuerza bruta y cobertura del escáner de secretos).

## Hallazgos estructurales (fallow)

No se proporcionó un bloque `<structural_findings>`.

## Hallazgos narrativos (revisor IA)

## Advertencias

### WR-01: `ingest` lee el archivo completo antes de comprobar su tamaño

**Archivo:** `src/lib/client/ingest.ts:31-37` (relacionado: `src/domain/cfdi/parseCfdi.ts:16,100`)
**Problema:** El rechazo `too-large` de `parseCfdi` mide `text.length` después de que `parseOne` ya ejecutó `await file.text()`. Un `.xml` enorme (cientos de MB, o varios a la vez, porque `Promise.all` procesa 25 por bloque) se carga entero en memoria y se decodifica como string antes de poder rechazarse. Eso puede congelar o tumbar la pestaña, que es exactamente lo que el límite de 2 MB quiere evitar. Además, `MAX_XML_CHARS` cuenta caracteres UTF-16 y no bytes, aunque el mensaje de la interfaz dice "máx. 2 MB" (`messages.ts:29`).
**Corrección:**
```ts
// ingest.ts
import { MAX_XML_BYTES } from "@/domain/cfdi/parseCfdi"; // exportar una constante en bytes

async function parseOne(file: File, ref: FileRef): Promise<BatchEntry> {
  if (file.size > MAX_XML_BYTES) {
    return { kind: "parsed", file: ref, result: { ok: false, reason: "too-large" } };
  }
  try {
    return { kind: "parsed", file: ref, result: parseCfdi(await file.text()) };
  } catch {
    return { kind: "unreadable", file: ref };
  }
}
```
Se conserva la comprobación por caracteres dentro de `parseCfdi` como defensa en profundidad. La constante en bytes alinea el límite con el texto del mensaje.

### WR-02: El cierre de sesión ignora la respuesta del servidor y deja la cookie viva

**Archivo:** `src/lib/client/logout.ts:4-11` (también `src/features/shell/LogoutButton.tsx:32-35`)
**Problema:** `logout()` hace `await fetch(...)` sin mirar `res.ok`. Si el servidor responde 5xx o 4xx (no sólo si falla la red), el catch no se ejecuta, la cookie `session` HttpOnly sigue válida hasta 30 días y el cliente navega a `/login` como si hubiera cerrado sesión. Antes de eso `leave()` ya llamó a `clearAll()`, así que el usuario pierde los datos cargados y cree haber salido. En un equipo compartido, la siguiente persona entra a `/` sin contraseña. Como el JWT es sin estado, no existe otra forma de revocarlo.
**Corrección:**
```ts
export async function logout(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (!res.ok) return false;
  } catch {
    return false;
  }
  hardNavigate("/login");
  return true;
}
```
Si devuelve `false`, mostrar un toast de error ("No se pudo cerrar la sesión, inténtalo de nuevo") y no navegar. Si se prefiere mantener la navegación en cualquier caso, avisar al menos al usuario de que la sesión puede seguir abierta.

### WR-03: La limitación de fuerza bruta del login no limita nada en la práctica

**Archivo:** `src/app/api/auth/login/route.ts:25-28`
**Problema:** El retraso de 1 s (D-03) se aplica por petición con `setTimeout`, pero no hay contador, bloqueo ni límite de concurrencia. Un atacante lanza N intentos en paralelo y todos tardan 1 s a la vez, así que la tasa efectiva es N/s, limitada sólo por la función serverless. El documento de stack pide complementarlo con una regla de rate-limit del WAF de Vercel sobre `/api/auth/login`. Ni `README.md` ni `.env.example` documentan ese paso (no hay ninguna mención a WAF/rate limit), de modo que el despliegue puede salir sin él. El retraso además mantiene abiertas invocaciones durante 1 s cada una, lo que facilita agotar la concurrencia.
**Corrección:** Añadir al checklist de despliegue del README la regla del WAF de Vercel (por ejemplo 5 intentos/minuto por IP en `/api/auth/login`) y exigir una `APP_PASSWORD` larga y aleatoria, como ya sugiere `.env.example`. Opcionalmente, un límite en memoria por IP como mitigación parcial, sabiendo que no es durable entre instancias.

### WR-04: `check-bundle-secrets` sólo escanea `.next/static` y se salta la salida prerenderizada

**Archivo:** `scripts/check-bundle-secrets.mjs:10,46-65`
**Problema:** Con `cacheComponents: true` Next prerenderiza HTML y payloads RSC en `.next/server/app/**` (`*.html`, `*.rsc`, `*.segment.rsc`), y esos artefactos se sirven al navegador. Si un Server Component o `layout.tsx` leyera `process.env.APP_PASSWORD` o `SESSION_SECRET` en tiempo de build, el valor quedaría incrustado en esos archivos y el script lo daría por bueno, porque sólo mira `.next/static`. El script promete probar que "los secretos no llegan al cliente", pero su cobertura es menor que esa promesa. Además, si `next build` termina por señal, `build.status` es `null` y el mensaje es "exit null".
**Corrección:**
```js
const SCAN_DIRS = [".next/static", ".next/server/app"];
// walk cada directorio; en .next/server/app limitar a .html, .rsc y .segment.rsc
// para no marcar falsos positivos en chunks de servidor que sí pueden mencionar el nombre.
```
Para los archivos de servidor, buscar sólo los valores centinela (no los nombres de variable), porque los bundles del servidor sí contienen legítimamente `APP_PASSWORD`.

## Info

### IN-01: `parseCfdi.ts` lleva un carácter U+FEFF literal e invisible en la regex del BOM

**Archivo:** `src/domain/cfdi/parseCfdi.ts:99`
**Problema:** La expresión `/^<U+FEFF>/` contiene el carácter BOM literal dentro del fuente. Es invisible en editores y diffs, y el hook de inyección de la lectura lo marcó como `invisible-unicode`. Un formateador o un copia-pega puede eliminarlo sin que nadie lo note, y entonces el BOM dejaría de eliminarse (142 de los 143 XML reales lo traen). Hoy los tests con `ingreso-bom-decl.xml` lo cubren, pero la forma es frágil.
**Corrección:** `xmlText.replace(/^<U+FEFF>/, "")`, igual que ya hace `tests/support/cfdiVariants.ts:11`.

### IN-02: `EmptyDropzone` importa `cn` del paquete `cn` y no de `@/lib/utils`

**Archivo:** `src/features/upload/EmptyDropzone.tsx:7`
**Problema:** El resto de la app (por ejemplo `InvoiceTable.tsx:41`) usa `import { cn } from "@/lib/utils"`, que es la costura prevista para sustituir la implementación. Este archivo se salta esa costura y depende directamente de la dependencia.
**Corrección:** `import { cn } from "@/lib/utils";`

### IN-03: `SubTotal`, `Total` y `Fecha` se aceptan sin validar su formato

**Archivo:** `src/domain/cfdi/parseCfdi.ts:131-150`
**Problema:** Sólo se comprueba que los atributos existan. Un valor como `Total="abc"` o `Fecha="ayer"` produce una factura "válida". En Fase 1 es inocuo, porque `formatTotal` y `formatFechaIso` caen a texto bruto y la columna Total ordena con `Number(...)` (NaN). Pero la Fase 2 calculará gastos sobre estos strings y un valor corrupto se colaría en las sumas.
**Corrección:** Validar con regex (`/^\d+(\.\d+)?$/` para importes, `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/` para `Fecha`) y rechazar como `malformed` con `detail: "invalid:Total"`, antes de que la Fase 2 dependa de estos campos.

### IN-04: `safeNextPath` admite `/login/` y `/login#...`, que dejan al usuario en la pantalla de login

**Archivo:** `src/lib/safeNext.ts:16-17`
**Problema:** La exclusión de `/login` compara `path === "/login"` y `path.startsWith("/login?")`. Un `?next=/login/` o `?next=/login%23x` pasa el filtro, y tras autenticarse el usuario aterriza otra vez en el formulario de login (Next redirige `/login/` a `/login`). Sólo ocurre con un enlace manipulado y no hay impacto de seguridad (el destino es del mismo origen), pero la intención de la guarda es evitar ese rebote.
**Corrección:** `if (/^\/login(?:[/?#]|$)/.test(path) || path.startsWith("/api/")) return "/";`

### IN-05: Cabeceras de seguridad ausentes o mejorables en `next.config.ts`

**Archivo:** `next.config.ts:9-45`
**Problema:**
- Falta `Permissions-Policy`.
- Falta `Cache-Control: no-store` para `/api/auth/*` (las respuestas de login llevan `Set-Cookie`).
- `Strict-Transport-Security` lo añade Vercel, pero no queda constancia de que se haya verificado.
- La CSP admite `script-src 'unsafe-inline'`, que está justificado y documentado en el comentario del archivo. El riesgo queda acotado porque todo el contenido derivado del XML se renderiza como texto de React, pero anula la protección de la CSP contra XSS si algún día se introduce `dangerouslySetInnerHTML` con datos externos.
**Corrección:** Añadir `{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }` y una entrada de cabeceras para `/api/auth/:path*` con `Cache-Control: no-store`. Valorar la CSP con nonce (vía `proxy.ts`) cuando se retire el prerenderizado estático.

### IN-06: Cookie de sesión sin prefijo `__Host-`

**Archivo:** `src/app/api/auth/login/route.ts:30-36`, `src/lib/server/session.ts:6`
**Problema:** El nombre `session` es genérico y la cookie no está ligada al host. Un subdominio hermano en `*.vercel.app` o un dominio propio compartido podría fijar o sobrescribir una cookie `session` por el dominio padre (session fixation de bajo impacto). Además, `secure` depende de `NODE_ENV === "production"`, por lo que un `next start` local sin HTTPS emite la cookie sin `Secure`, lo cual es aceptable pero conviene tenerlo presente.
**Corrección:** Usar `__Host-session` (requiere `Secure`, `Path=/` y sin `Domain`) en producción, y mantener el nombre actual sólo en desarrollo.

### IN-07: `anonymize-fixture.mjs` no verifica que el resultado esté libre de datos reales

**Archivo:** `scripts/anonymize-fixture.mjs:152-203`
**Problema:** El script reescribe los atributos con una regex de etiqueta (`tagRe`). Todo lo que esa regex no reconoce queda intacto y se escribe sin aviso: instrucciones de procesamiento (`<?...?>`), DOCTYPE, o etiquetas con atributos sin comillas o con nombres fuera de `[\w:.-]`. No hay una comprobación posterior sobre la salida. La protección real es `tests/fixtures.guard.test.ts`, que sólo corre donde existe `Facturas/`. No se demostró una fuga concreta con los 143 archivos reales, pero el script debería fallar de forma cerrada para una herramienta cuyo propósito es la privacidad.
**Corrección:** Tras anonimizar, reparsear la salida con `DOMParser`/regex y fallar con `process.exit(1)` si queda algún atributo `Rfc`, `Nombre` o `UUID` que no sea de la lista sintética, o si la entrada contiene `<!DOCTYPE` o `<?` distinto de la declaración XML.

### IN-08: Directiva `eslint-disable` sin efecto en `navigation.ts`

**Archivo:** `src/lib/client/navigation.ts:6`
**Problema:** `pnpm eslint .` informa `Unused eslint-disable directive (no problems were reported from '@next/next/no-location-assign-relative-destination')`. Es la única advertencia de lint del proyecto. Es ruido, y CLAUDE.md pide que `eslint` termine limpio.
**Corrección:** Eliminar la línea del comentario `// eslint-disable-next-line ...`.

---

_Revisado: 2026-10-14_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidad: standard_
