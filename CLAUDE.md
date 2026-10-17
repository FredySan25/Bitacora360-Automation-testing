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
npm run report:allure     # genera y abre el reporte de Allure de la última corrida
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

Las carpetas reflejan los grupos de rutas de la app web: `tests/auth` cubre `app/(auth)` y `tests/dashboard` cubre `app/(dashboard)`. Las specs nuevas van en la carpeta de su grupo de rutas, una por módulo o pantalla, y el proyecto correspondiente las toma a través de su `testDir`. Una ruta pública fuera de los grupos, como `/about` (`AboutPage`, `about.spec.ts`), va en `tests/auth`, que es el proyecto sin sesión.

Los route handlers de la app (`app/api/...`) se prueban con el fixture `request`, que hereda el `storageState` del proyecto: en `tests/dashboard` lleva la sesión y en `tests/auth` no. Por eso el 401 sin sesión de `/api/watchlist/search` está en `route-protection.spec.ts` y los 400 con sesión en `watchlist-catalog.spec.ts`. Solo se piden las respuestas que la app da antes de llegar a un servicio externo (sesión o parámetros inválidos); un 200 o un 502 gastarían la cuota del catálogo real.

`pages/` contiene los page objects (locators como campos `readonly` más las acciones). `DashboardShell` modela el layout compartido por todas las páginas del dashboard (menú lateral, enlaces de navegación, título de página, logout y el enlace "Acerca de", que en escritorio está en el menú lateral y en el celular al final del `<main>`) y es lo que usan las specs del dashboard que solo navegan. Una pantalla con interacción propia tiene además su page object: `HabitsPage` para el checklist de `/habits`, `ProgressPage` para `/habits/progress`, `GymPage` para `/habits/gym` y, en finanzas, `FinancePage` (`/finance`), `BudgetsPage` (`/finance/budgets`), `FinanceSummaryPage` (`/finance/summary`) y `GoalsPage` (`/finance/goals`), y `WatchlistPage` para `/watchlist`. Cuando la pantalla repite un bloque con formulario propio, ese bloque tiene su clase en el mismo archivo, como `WorkoutCard` en `GymPage.ts` o `TransactionForm` y `TransactionRow` en `FinancePage.ts`, o `WatchlistForm` y `WatchlistRow` en `WatchlistPage.ts`.

`pages/components/` guarda los bloques que aparecen en más de una pantalla, y los page objects los exponen como campos: `ConfirmDialog` (el modal que pregunta antes de eliminar), `MonthNav` (el selector de mes de finanzas), `SummaryCards` (las tarjetas de ingresos, gastos y balance), `FinanceTabs`, `FinanceMonthCard` (la tarjeta de finanzas de `/today`) y `WatchlistCard` (la de watchlist).

`support/supabase-rows.ts` concentra lo que antes repetía cada page object para limpiar: `SupabaseRows.waitForCall()` espera la llamada de la app a una tabla, guarda las credenciales de esa petición y recuerda el `id` de cada fila insertada; `deleteCreated()` las borra por la API REST. Hay una instancia por página del navegador (`SupabaseRows.of(page)`), compartida por todos los page objects de la prueba. Los page objects de finanzas y `WatchlistPage` lo usan; `HabitsPage` y `GymPage` conservan su propia versión. En el mismo archivo, `mockSupabaseTable()` responde las llamadas a una tabla sin llegar a Supabase y `holdSupabaseTable()` las retiene hasta que la prueba las suelta, para ver lo que la pantalla muestra mientras espera ("Cargando tu lista...", "Guardando...").

## Verificación estática

Antes de dar por terminado un cambio pasan `npm run typecheck`, `npm run lint` y `npm run format:check`.

El linter es oxlint (`.oxlintrc.json`) y no ESLint, porque `typescript-eslint` todavía no soporta TypeScript 7. Corre las reglas de corrección más las de promesas (`no-floating-promises`, `no-misused-promises`, `await-thenable`): en Playwright casi todo es asíncrono, y un `expect(locator)` o una acción sin `await` no hace fallar la prueba. No tiene reglas propias de Playwright, así que estas se cuidan a mano: nada de `waitForTimeout`, ningún `test.only` (`forbidOnly` lo rechaza en CI) y toda prueba con al menos una aserción.

## Integración continua

`.github/workflows/ci.yml` tiene tres jobs encadenados: `static` (tipos, lint, formato), `e2e` (descarga la app como carpeta hermana, corre toda la suite y arma el sitio) y `report` (lo publica en GitHub Pages desde `main`, también con pruebas fallidas). Los secretos y la configuración de Pages están en el README.

Cada corrida escribe dos reportes: el HTML de Playwright (`playwright-report/`) y los resultados de Allure (`allure-results/`, que `support/clean-allure-results.ts` vacía al empezar). El sitio publicado lleva el reporte de Allure en la raíz, generado con `allure generate` según `allurerc.ts`, y el de Playwright en `/playwright/`. La tendencia entre corridas sale de `allure-history.jsonl`, que el job descarga del sitio publicado antes de generar y vuelve a subir.

El sitio es público, y eso condiciona la configuración:

- En CI `trace` está apagado: una traza guarda la contraseña y los tokens de sesión. No se vuelve a encender ahí.
- Playwright titula cada paso con el valor que escribe (`Fill "<valor>"`). `support/redact-password-reporter.ts` reemplaza `E2E_USER_PASSWORD` por `***` y el workflow revisa el sitio antes de subirlo. Ese reporter va primero en la lista de `playwright.config.ts`: Allure copia el título de un paso en cuanto empieza, y con otro orden la contraseña queda en `allure-results/`. Si una prueba nueva escribe otro secreto por la UI, hay que agregarlo al reporter y a esa revisión.
- `MAILSAC_API_KEY` y `SUPABASE_SERVICE_ROLE_KEY` no están en CI; `register-email.spec.ts` se salta ahí.

El job `e2e` usa un grupo de `concurrency` porque la spec de logout revoca todas las sesiones del usuario: dos corridas simultáneas, incluida una local, se tumban entre sí.

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
- Finanzas no usa `window.confirm`: pregunta con un `<dialog>` de la propia página, que `answerNextDialog` no ve. Se maneja con `ConfirmDialog` (`deleteDialog` en cada page object): `confirm()`, `cancel()` y `pressEscape()` esperan a que el modal se cierre, y al confirmar eso solo ocurre cuando Supabase ya respondió.

### Finanzas

- Las vistas de finanzas suman todos los movimientos de un mes, así que una prueba que afirma totales no puede compartir mes con otra. `ownYear(testInfo)` (`support/own-year.ts`) entrega un año entre 1800 y 1999 que ninguna otra prueba en curso usa: cada worker tiene su carril de años (`parallelIndex`) y la era es aleatoria, para que dos corridas que se crucen rara vez coincidan. La prueba abre la pantalla con `FinancePage.gotoOwnMonth("YYYY-MM")` y crea ahí sus movimientos; con eso sí puede afirmar tarjetas, gráficas y listas completas.
- `gotoOwnMonth()` vacía antes ese año con `deleteTransactionsOf(year)`. Hace falta porque borrar por `id` en `afterEach` no alcanza: si una prueba agota su tiempo mientras Supabase guarda, la fila queda creada y nadie recuerda su `id`. Es el único borrado por rango de la suite y solo acepta años de `ownYear` (`isOwnYear`); el mes actual y los datos reales del usuario se limpian siempre por `id`.
- El resumen mira el mes seleccionado y los cinco anteriores. Sus pruebas trabajan en diciembre de su año, para que toda la ventana quede dentro de él; las de movimientos y presupuestos, en marzo.
- Un presupuesto rige en todos los meses posteriores y eliminarlo lo quita de todo el usuario, así que no cabe en un año propio. Por eso `finance-budgets.spec.ts` es la única spec que crea presupuestos, corre en serie (`mode: "serial"`), cada worker usa una sola categoría (lo que mantiene aisladas las repeticiones de `--repeat-each`, mientras no haya más workers que categorías: once) y la categoría se limpia antes y después de cada prueba con `BudgetsPage.deleteBudgets()`. Ninguna otra spec debe crear presupuestos.
- Lo que depende del mes actual o de todo el usuario se prueba por estructura o con la fila propia: la tarjeta de `/today`, la lista de metas.
- Los estados que el usuario compartido no puede garantizar (una lista vacía, una carga o un guardado que falla) se obtienen respondiendo la llamada a Supabase con `mockSupabaseTable()` (`support/supabase-rows.ts`), a través de métodos del page object como `mockNoGoals()` o `mockLoadError()`. Se llaman antes de navegar.
- Las fechas y los montos que la app muestra se arman con el diccionario, no en la spec: `ui.dates.monthYear("1950-03")`, `ui.dates.shortDay(...)`, `finance.money(45.5)`. Las claves de `expenseCategories` e `incomeCategories` son las mismas que guarda la app.
- Playwright no le da rol a un `<optgroup>`: los grupos del filtro de categoría se ubican por su atributo `label` (`FinancePage.categoryFilterGroup()`).

### Watchlist

- `/watchlist` lista todos los títulos del usuario, así que cada prueba busca solo los suyos por su título (`WatchlistPage.item(title, status)`, que también dice en qué sección debe estar). Los encabezados de sección llevan el conteo de todo el usuario ("Pendientes (3)"): se ubican con `sectionHeadingPattern`, que acepta cualquier conteo, y nunca se afirma el número.
- Los cambios que se guardan desde la fila (empezar, terminar, calificar, quitar la calificación) pasan por `saveFromRow(button)`, que espera el `PATCH` antes de recargar o verificar.
- Las estrellas son radios ocultos detrás del ícono, que es el que recibe el clic: se marcan con `starLabel(n)` (la etiqueta que el usuario pulsa) y su estado se lee con `star(n)` (el radio).
- La lista vacía, el filtro sin resultados, los errores y lo que muestra la tarjeta de `/today` con una lista concreta (hasta tres títulos en curso, "y N más", los conteos) salen de `mockItems()`, `mockNoItems()`, `mockLoadError()` y `mockSaveError(method)`; con datos reales la tarjeta se prueba solo por su estructura. `mockItems()` acepta también póster, año y vínculo al catálogo.
- El campo "Título" sugiere resultados de un catálogo (`/api/watchlist/search`). Ninguna prueba llega a los catálogos reales: `WatchlistPage.open()` responde la búsqueda sin resultados y las imágenes de los hosts de pósters con un PNG. Una prueba cambia la respuesta con `mockCatalog(results | "error")`, la retiene con `holdCatalog()` o rompe las imágenes con `mockBrokenPosters()` (404); el estado se lee en cada petición, así que se puede llamar antes o después de abrir la página. `catalogSearches` guarda la consulta de cada búsqueda y `waitForCatalogSearch()` espera la respuesta de la siguiente.
- `WatchlistForm.fill()` cierra las sugerencias con Escape después de escribir el título, como quien lo escribe a mano: abiertas, la lista tapa los campos de abajo y un clic sobre ellos elige una sugerencia. Para probar las sugerencias se escribe con `typeTitle()`, que las deja abiertas.
- La búsqueda espera 300 ms a que el usuario deje de escribir. Para afirmar que algo no se buscó, la prueba instala el reloj (`page.clock.install()` antes de navegar) y lo adelanta con `page.clock.runFor()`, nunca con `waitForTimeout`.
- Para comprobar lo que Supabase guardó de una columna que la pantalla no muestra (`catalog_source`, `catalog_id`), `submitNewItem()` y `saveEdit()` devuelven la respuesta de Supabase, que trae la fila guardada.
