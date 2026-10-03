# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma

La documentación (este archivo, el README) va en español. El código se escribe siempre en inglés: nombres de archivos, clases, variables, funciones y comentarios. Los textos de la interfaz que usan los locators y las aserciones se quedan en español, porque así los muestra la app.

## Qué es este proyecto

Suite E2E con Playwright + TypeScript para la app web Bitácora360 (Next.js + Supabase Auth). Es un proyecto independiente que prueba la app desde fuera, a través del navegador. La app vive en la carpeta hermana `../Bitacora360WebProyect` y no forma parte de este repositorio.

## Comandos

```bash
npm install
npx playwright install chromium   # solo la primera vez

npm test                  # toda la suite
npm run test:auth         # solo las specs sin sesión; no requiere .env
npm run test:dashboard    # specs con sesión (corre setup antes y logout después)
npm run test:ui           # modo UI de Playwright
npm run test:headed
npm run test:debug
npm run report            # abre el reporte HTML de la última corrida
npm run codegen           # graba acciones contra http://localhost:3000
npm run typecheck         # tsc --noEmit; es la única verificación estática, no hay linter

npx playwright test tests/auth/login.spec.ts        # un archivo
npx playwright test -g "credenciales incorrectas"   # una prueba por título
```

No hace falta levantar la app a mano: Playwright corre `npm run dev` en `../Bitacora360WebProyect`, espera a que responda `/login` y la apaga al terminar. Si ya hay un servidor en `http://localhost:3000`, lo reutiliza. Definir `BASE_URL` (en `.env`) desactiva el servidor local y apunta las pruebas a esa URL.

## Entorno

`playwright.config.ts` carga `.env` con `process.loadEnvFile` (por eso se requiere Node >= 20.12). Copia `.env.example` y llena `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` con un usuario de Supabase dedicado a pruebas y ya confirmado. Nunca una cuenta personal: la spec de logout cierra sesión de forma global y tumba todas las sesiones abiertas de ese usuario.

Sin esas variables, el proyecto `auth` pasa igual, `setup` lanza un error (y `dashboard` no puede correr) y la spec de logout se salta sola.

## Arquitectura

Los cuatro proyectos de Playwright en `playwright.config.ts` modelan el ciclo de vida de la sesión, y su orden es intencional:

- `setup` (`tests/auth.setup.ts`) inicia sesión por la UI una sola vez y guarda las cookies en `.auth/user.json` (`STORAGE_STATE` en `support/env.ts`).
- `auth` (`tests/auth/`) corre sin sesión: login, registro y protección de rutas.
- `dashboard` (`tests/dashboard/`) depende de `setup` y arranca cada prueba ya autenticada mediante `storageState`.
- `logout` (`tests/session/`) está declarado como `teardown` de `setup`. El cierre de sesión de Supabase revoca todas las sesiones del usuario, así que tiene que correr después de todas las specs del dashboard; inicia sesión por la UI en lugar de reutilizar el estado guardado.

Consecuencia: después de cualquier corrida que incluya `dashboard`, el `.auth/user.json` guardado ya está revocado, así que usar `--no-deps` en una spec del dashboard con un archivo de sesión viejo no funciona.

Las carpetas reflejan los grupos de rutas de la app web: `tests/auth` cubre `app/(auth)` y `tests/dashboard` cubre `app/(dashboard)`. Las specs nuevas van en la carpeta de su grupo de rutas, una por módulo o pantalla, y el proyecto correspondiente las toma a través de su `testDir`.

`pages/` contiene los page objects (locators como campos `readonly` más las acciones). `DashboardShell` modela el layout compartido por todas las páginas del dashboard (menú lateral, enlaces de navegación, título de página, logout) y es lo que usan las specs del dashboard en lugar de un page object por módulo.

## Convenciones

- Los locators viven en los page objects y usan roles y texto visible (`getByRole`, `getByLabel`), no clases CSS.
- Después de navegar a una pantalla con formulario, espera la hidratación de React antes de escribir: `waitForHydration(locator)` de `support/hydration.ts`. Contra `next dev`, lo que se escribe antes de la hidratación nunca llega al estado de React. Los page objects ya lo hacen en `goto()`.
- Acota las alertas al formulario (`form.getByRole("alert")`): Next.js agrega su propio anunciador de rutas con `role="alert"` en todas las páginas.
- Las pruebas de registro simulan la llamada a Supabase con `RegisterPage.mockSignup(status, body)`, que intercepta `**/auth/v1/signup*`; así no se crean usuarios reales ni se envían correos.
- Las pruebas del dashboard no deben depender de los datos que ya tenga el usuario de pruebas. Si una prueba necesita datos, los crea y los borra ella misma.
