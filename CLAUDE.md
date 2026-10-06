# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma

La documentación (este archivo, el README) va en español. El código se escribe siempre en inglés: nombres de archivos, clases, variables, funciones, comentarios, títulos de las pruebas (`test`, `describe`) y mensajes de error o de `skip`. Los datos de prueba (correos, contraseñas de ejemplo) también van en inglés.

Lo único en español dentro del código es el texto visible de la app, y vive en un solo lugar: `support/locales/es.ts`. Los page objects y las specs nunca escriben ese texto directamente; lo leen de `ui` (`support/ui.ts`) con claves en inglés, por ejemplo `ui.login.heading`. Un texto nuevo de la interfaz se agrega primero al diccionario.

La app hoy solo existe en español. Cuando soporte más idiomas, cada uno será otro archivo en `support/locales/` con la misma forma (tipo `UiText`), y `support/ui.ts` es el único punto donde se elige cuál usar.

## Qué es este proyecto

Suite E2E con Playwright + TypeScript para la app web Bitácora360 (Next.js + Supabase Auth). Es un proyecto independiente que prueba la app desde fuera, a través del navegador. La app vive en la carpeta hermana `../Bitacora360WebProyect` y no forma parte de este repositorio.

## Comandos

```bash
npm install
npx playwright install chromium   # solo la primera vez

npm test                  # toda la suite
npm run test:auth         # solo las specs sin sesión; corre sin .env
npm run test:dashboard    # specs con sesión (corre setup antes y logout después)
npm run test:ui           # modo UI de Playwright
npm run test:headed
npm run test:debug
npm run report            # abre el reporte HTML de la última corrida
npm run codegen           # graba acciones contra http://localhost:3000
npm run typecheck         # tsc --noEmit
npm run lint              # oxlint con información de tipos: un await olvidado es un error
npm run format            # Prettier; format:check solo revisa

npx playwright test tests/auth/login.spec.ts        # un archivo
npx playwright test -g "wrong credentials"          # una prueba por título
```

No hace falta levantar la app a mano: Playwright corre `npm run dev` en `../Bitacora360WebProyect`, espera a que responda `/login` y la apaga al terminar. Si ya hay un servidor en `http://localhost:3000`, lo reutiliza. Definir `BASE_URL` (en `.env`) desactiva el servidor local y apunta las pruebas a esa URL.

## Entorno

`playwright.config.ts` carga `.env` con `process.loadEnvFile` (por eso se requiere Node >= 20.12). Copia `.env.example` y llena `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` con un usuario de Supabase dedicado a pruebas y ya confirmado. Nunca una cuenta personal: la spec de logout cierra sesión de forma global y tumba todas las sesiones abiertas de ese usuario.

Sin esas variables, el proyecto `auth` pasa igual, `setup` lanza un error (y `dashboard` no puede correr) y la spec de logout se salta sola.

`MAILSAC_API_KEY` es opcional y activa `tests/auth/register-email.spec.ts`, que se salta sola si falta. Esa spec registra usuarios reales con direcciones `@mailsac.com` y lee el correo de confirmación por la API de Mailsac, así que el proyecto de Supabase necesita un SMTP propio: el servicio de correo por defecto solo entrega a los miembros de la organización. Con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` la spec borra cada usuario que crea; sin ellas los usuarios `b360-e2e-...@mailsac.com` se quedan en Supabase.

## Arquitectura

Los cuatro proyectos de Playwright en `playwright.config.ts` modelan el ciclo de vida de la sesión, y su orden es intencional:

- `setup` (`tests/auth.setup.ts`) inicia sesión por la UI una sola vez y guarda las cookies en `.auth/user.json` (`STORAGE_STATE` en `support/env.ts`).
- `auth` (`tests/auth/`) corre sin sesión: login, registro y protección de rutas.
- `dashboard` (`tests/dashboard/`) depende de `setup` y arranca cada prueba ya autenticada mediante `storageState`.
- `logout` (`tests/session/`) está declarado como `teardown` de `setup`. El cierre de sesión de Supabase revoca todas las sesiones del usuario, así que tiene que correr después de todas las specs del dashboard; inicia sesión por la UI en lugar de reutilizar el estado guardado.

Consecuencia: después de cualquier corrida que incluya `dashboard`, el `.auth/user.json` guardado ya está revocado, así que usar `--no-deps` en una spec del dashboard con un archivo de sesión viejo no funciona.

Las carpetas reflejan los grupos de rutas de la app web: `tests/auth` cubre `app/(auth)` y `tests/dashboard` cubre `app/(dashboard)`. Las specs nuevas van en la carpeta de su grupo de rutas, una por módulo o pantalla, y el proyecto correspondiente las toma a través de su `testDir`.

`pages/` contiene los page objects (locators como campos `readonly` más las acciones). `DashboardShell` modela el layout compartido por todas las páginas del dashboard (menú lateral, enlaces de navegación, título de página, logout) y es lo que usan las specs del dashboard que solo navegan. Una pantalla con interacción propia tiene además su page object: `HabitsPage` para el checklist de `/habits`, `ProgressPage` para `/habits/progress` y `GymPage` para `/habits/gym`. Cuando la pantalla repite un bloque con formulario propio, ese bloque tiene su clase en el mismo archivo, como `WorkoutCard` en `GymPage.ts`.

## Verificación estática

Antes de dar por terminado un cambio pasan `npm run typecheck`, `npm run lint` y `npm run format:check`.

El linter es oxlint (`.oxlintrc.json`) y no ESLint, porque `typescript-eslint` todavía no soporta TypeScript 7. Corre las reglas de corrección más las de promesas (`no-floating-promises`, `no-misused-promises`, `await-thenable`): en Playwright casi todo es asíncrono, y un `expect(locator)` o una acción sin `await` no hace fallar la prueba. No tiene reglas propias de Playwright, así que estas se cuidan a mano: nada de `waitForTimeout`, ningún `test.only` (`forbidOnly` lo rechaza en CI) y toda prueba con al menos una aserción.

## Convenciones

- Los locators viven en los page objects y usan roles y texto visible (`getByRole`, `getByLabel`), no clases CSS. El texto sale de `ui`, no de literales.
- Después de navegar a una pantalla con formulario, espera la hidratación de React antes de escribir: `waitForHydration(locator)` de `support/hydration.ts`. Contra `next dev`, lo que se escribe antes de la hidratación nunca llega al estado de React. Los page objects ya lo hacen en `goto()`.
- Acota las alertas al formulario (`form.getByRole("alert")`): Next.js agrega su propio anunciador de rutas con `role="alert"` en todas las páginas.
- Las pruebas de registro simulan las llamadas a Supabase con `RegisterPage.mockSignup(status, body)`, `mockVerifyCode` y `mockResendCode`, que interceptan `**/auth/v1/signup*`, `verify*` y `resend*`; así no se crean usuarios reales ni se envían correos. La excepción es `register-email.spec.ts`, que recorre el registro sin mocks: `newInboxAddress()` y `waitForConfirmationEmail()` de `support/mailsac.ts` dan una dirección nueva por prueba y el código y el enlace del correo. Cada prueba ahí gasta un correo y llamadas de la cuota de Mailsac, así que los demás casos del registro siguen con mocks.
- Las pruebas del dashboard no deben depender de los datos que ya tenga el usuario de pruebas. Si una prueba necesita datos, los crea y los borra ella misma.
- Las specs del dashboard corren en paralelo con el mismo usuario, así que cada prueba crea sus datos con un nombre único y solo verifica su propia fila, nunca contadores globales como "X de Y". En hábitos, `HabitsPage.createHabit()` recuerda cada hábito que crea y `deleteCreatedHabits()` los borra en `afterEach` por la API REST de Supabase, con las credenciales que el navegador ya usó en esa sesión; no necesita variables de entorno adicionales. `GymPage` hace lo mismo con `createWorkout()`, `addSet()` y `deleteCreatedData()`, que borra primero los entrenamientos (y con ellos sus series) y después los ejercicios.
- Una lista paginada no muestra todo tras recargar, y las otras pruebas agregan filas con el mismo usuario: antes de buscar una fila propia se amplía la lista (`GymPage.showWorkout()`), y antes de afirmar que una fila ya no está se muestra completa (`showAllWorkouts()`).
- Las pantallas que suman los datos de todo el usuario (los números y gráficas de `/habits/progress`) se prueban por su estructura y por la fila de la prueba, nunca por sus totales.
- Los `window.confirm` se responden con `answerNextDialog(page, "accept" | "dismiss")` de `support/dialogs.ts`, que devuelve el mensaje mostrado. Playwright descarta un diálogo que nadie espera.
