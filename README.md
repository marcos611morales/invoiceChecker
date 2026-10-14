# InvoiceChecker

Análisis de gastos del Coworking Café. Es una página web (Next.js, desplegada en Vercel) para analizar las facturas de gastos (CFDI 4.0 XML) que los proveedores le emiten al coworking café. La persona usuaria arrastra los archivos al navegador, los datos se procesan en el navegador y nunca se guardan en una base de datos. La usan el dueño, sus socios y su contador con una contraseña compartida.

## Ejecución local

Requisitos: Node.js 24.x y pnpm 11.5.2 (fijado en `packageManager`).

```bash
pnpm install
```

Crea un archivo `.env.local` (está ignorado por git) con dos valores aleatorios:

```bash
echo "APP_PASSWORD=$(openssl rand -base64 18)" > .env.local
echo "SESSION_SECRET=$(openssl rand -base64 48)" >> .env.local
```

Después:

```bash
pnpm dev            # servidor de desarrollo en http://localhost:3000
pnpm verify         # lint + typecheck + pruebas + build
pnpm build && pnpm smoke:auth   # prueba de la contraseña contra un servidor de producción
```

`.env.example` documenta cada variable. Nunca uses el prefijo público de Next.js con `APP_PASSWORD` ni con `SESSION_SECRET`.

## Despliegue en Vercel

El proyecto de Vercel lo crea quien administra la cuenta (D-26) y se usa el dominio `*.vercel.app` que Vercel asigna por defecto (D-27).

1. **Sube el repositorio a GitHub.** Este repositorio todavía no tiene remoto: crea un repositorio en GitHub, luego `git remote add origin <url>` y `git push -u origin main`. La carpeta `Facturas/` está en `.gitignore`, así que no se sube. Alternativa: usar la CLI de Vercel desde una copia del proyecto sin la carpeta `Facturas/` (`.vercelignore` también la excluye, junto con `.env*`).
2. **Crea el proyecto:** Vercel Dashboard > Add New > Project > importa el repositorio. Framework: Next.js.
3. **Versión de Node:** Project > Settings > General > Node.js Version = `24.x`.
4. **Variables de entorno** (Project > Settings > Environment Variables), para Production y Preview:
   - `APP_PASSWORD`: contraseña compartida larga y aleatoria (12 caracteres o más).
   - `SESSION_SECRET`: salida de `openssl rand -base64 48`.
   - `ENABLE_EXPERIMENTAL_COREPACK` = `1`: pnpm 11 no está en la lista oficial de Vercel; con Corepack activado, Vercel instala con la versión fijada en `packageManager`.

   Cambiar `APP_PASSWORD` o `SESSION_SECRET` cierra la sesión de todas las personas.
5. **Despliega (o vuelve a desplegar)** después de guardar las variables.
6. **Revisa el log de build:** debe indicar que se instaló con pnpm 11.5.2 y que el build terminó bien. Si la instalación falla con un error de versión de pnpm, el plan alternativo es cambiar `packageManager` a pnpm 10 y regenerar `pnpm-lock.yaml` (la configuración `allowBuilds` de `pnpm-workspace.yaml` necesitaría el equivalente de pnpm 10).
7. **Antes de desplegar**, ejecuta localmente:

   ```bash
   node scripts/check-bundle-secrets.mjs   # compila con valores centinela y busca secretos en .next/static
   pnpm audit --prod --audit-level high    # sin avisos altos o críticos en dependencias de producción
   ```

8. **Confirma en la URL real** (ventana privada): cualquier ruta, por ejemplo `/` o `/cualquier-cosa`, lleva a `/login`; la contraseña correcta entra; recargar y volver a visitar más tarde sigue dentro; "Cerrar sesión" regresa a `/login`. La fase solo se cierra cuando esto queda confirmado en la URL real (D-28).

## Pruebas de punta a punta (local)

Requiere Google Chrome instalado (Playwright usa el canal `chrome`).

```bash
pnpm test:e2e
```

Levanta un build de producción en el puerto 3210 con una contraseña de prueba, arma una carpeta sintética de facturas en el directorio temporal del sistema y comprueba: la puerta de acceso, la carga de la carpeta, que ninguna petición de red lleve contenido XML, el aviso al recargar y el cierre de sesión.

Para correr además la muestra real, solo en esta máquina (nunca se sube a ningún lado):

```bash
E2E_FACTURAS_DIR=Facturas/2025 pnpm test:e2e
```

Estas pruebas no forman parte de `pnpm verify`. Variables opcionales: `E2E_APP_PASSWORD`, `E2E_SESSION_SECRET` y `E2E_FACTURAS_DIR`.
