# CLAUDE.md

Reglas obligatorias para este proyecto. Tienen prioridad sobre cualquier comportamiento por defecto.
El contexto completo del proyecto (stack, decisiones, versiones) está en [.claude/CLAUDE.md](.claude/CLAUDE.md).

## 1. Siempre preguntar, nunca inferir

- Si algo es ambiguo, falta información o hay más de una forma razonable de hacerlo: **detente y pregunta** antes de escribir código.
- No asumas requisitos, nombres, reglas de negocio, formatos de datos, textos de la interfaz ni decisiones de diseño.
- No elijas en silencio entre dos opciones. Presenta las opciones (con tu recomendación, si tienes una) y deja que el usuario decida.
- Si durante la implementación aparece algo que el plan no cubre, pregunta antes de seguir.
- Si ya preguntaste y el usuario respondió, sigue esa respuesta; no la vuelvas a cuestionar.

## 2. TypeScript en modo estricto

En `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

En el código:

- **Prohibido `any`** (explícito o implícito). Usa `unknown` y valida (por ejemplo con zod) o define el tipo correcto.
- **Prohibido `@ts-ignore` y `@ts-nocheck`.** Si de verdad hace falta silenciar un error, usa `@ts-expect-error` con un comentario que explique por qué.
- **Prohibido el operador non-null `!`** (`valor!`). Comprueba `undefined`/`null` explícitamente.
- Prohibido `as` para forzar tipos que no se han verificado. Valida los datos externos (XML, `localStorage`, respuestas del LLM, cuerpos de peticiones) antes de tiparlos.
- La única excepción a estas reglas es una que tenga un comentario que la justifique en la misma línea o en la línea anterior.

## 3. Verificación antes de dar algo por terminado

Antes de decir que una tarea está lista, deben pasar:

```bash
pnpm tsc --noEmit
pnpm eslint .
pnpm vitest run
```

Si alguno falla, repórtalo con la salida del error; no lo ocultes ni lo des por bueno.
