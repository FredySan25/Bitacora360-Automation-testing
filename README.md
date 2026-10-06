# Bitácora360 — Automation testing

Pruebas E2E de [Bitácora360](../Bitacora360WebProyect) con Playwright +
TypeScript. Es un proyecto independiente: vive junto al proyecto web y lo
prueba desde fuera, a través del navegador.

## Preparación

```bash
npm install
npx playwright install chromium
```

Para las pruebas con sesión necesitas un **usuario dedicado para pruebas**:

1. Créalo en la app (`/register`) y confirma el email, o desde el panel de
   Supabase (Authentication → Users → Add user, con "Auto Confirm User").
2. Copia `.env.example` como `.env` y llena `E2E_USER_EMAIL` y
   `E2E_USER_PASSWORD`.

No uses tu cuenta personal: la prueba de logout cierra todas las sesiones del
usuario, incluida la que tengas abierta en tu navegador.

### Registro con correo real (opcional)

`tests/auth/register-email.spec.ts` registra un usuario de verdad y confirma la
cuenta con el código y con el enlace del correo, que lee de un buzón de
[Mailsac](https://mailsac.com). Sin `MAILSAC_API_KEY` en `.env` se salta sola.

- `MAILSAC_API_KEY`: la API key de tu cuenta de Mailsac.
- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: opcionales, para que la prueba
  borre los usuarios que crea. Sin ellas se quedan en Supabase con correos
  `b360-e2e-...@mailsac.com`. La clave de servicio nunca se sube al repositorio.

El proyecto de Supabase necesita un SMTP propio configurado: el servicio de
correo por defecto solo entrega a los miembros de la organización.

## Ejecución

No hace falta levantar la app antes: Playwright corre `npm run dev` en
`../Bitacora360WebProyect` y lo apaga al terminar. Si ya está corriendo en
`http://localhost:3000`, reutiliza ese servidor.

| Comando                  | Qué hace                                                  |
| ------------------------ | --------------------------------------------------------- |
| `npm test`               | Corre toda la suite                                       |
| `npm run test:auth`      | Solo las pruebas sin sesión (no requieren `.env`)         |
| `npm run test:dashboard` | Solo las pruebas con sesión                               |
| `npm run test:ui`        | Modo UI: correr, depurar y ver cada paso                  |
| `npm run test:headed`    | Corre con el navegador visible                            |
| `npm run test:debug`     | Paso a paso con el inspector de Playwright                |
| `npm run report`         | Abre el reporte HTML de la última corrida                 |
| `npm run codegen`        | Graba acciones en el navegador y genera locators          |
| `npm run typecheck`      | Revisa los tipos de TypeScript                            |
| `npm run lint`           | Linter (oxlint): errores de código y promesas sin `await` |
| `npm run format`         | Da formato con Prettier (`format:check` solo revisa)      |

Un archivo o una prueba en particular:

```bash
npx playwright test tests/auth/login.spec.ts
npx playwright test -g "wrong credentials"
```

Para probar contra una app desplegada, define `BASE_URL` en `.env`.

## Integración continua

`.github/workflows/ci.yml` corre en cada push a `main`, en cada pull request y
a mano desde la pestaña Actions. Lo último sirve después de un cambio en la
app, que vive en otro repositorio y por eso no dispara este workflow. Son tres
jobs encadenados:

1. **static** — tipos, linter y formato de la suite.
2. **e2e** — descarga este repositorio y el de la app como carpetas hermanas,
   levanta la app con `npm run dev` y corre toda la suite en Chromium.
3. **report** — publica el reporte HTML de Playwright en GitHub Pages, también
   cuando hay pruebas fallidas. Solo publican las corridas de `main`.

El reporte de la última corrida de `main` queda en
<https://fredysan25.github.io/Bitacora360-Automation-testing/>.

### Configuración en GitHub

En Settings → Secrets and variables → Actions, como _repository secrets_:

| Secreto                         | Valor                                        |
| ------------------------------- | -------------------------------------------- |
| `E2E_USER_EMAIL`                | Correo del usuario de pruebas                |
| `E2E_USER_PASSWORD`             | Su contraseña                                |
| `NEXT_PUBLIC_SUPABASE_URL`      | El mismo valor que en `.env.local` de la app |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | El mismo valor que en `.env.local` de la app |

Y en Settings → Pages, **Source: GitHub Actions**.

`MAILSAC_API_KEY` no se configura en CI, así que las pruebas de registro con
correo real se saltan ahí y solo corren en local.

### El reporte es público

Cualquiera puede abrirlo, así que no debe contener secretos:

- En CI no se graban trazas (`trace` en `playwright.config.ts`): una traza
  guarda las peticiones de red, con la contraseña y los tokens de sesión.
- Playwright titula cada paso con el valor que escribe (`Fill "<valor>"`).
  `support/redact-password-reporter.ts` reemplaza la contraseña del usuario de
  pruebas por `***`, y el workflow revisa el reporte antes de subirlo: si la
  encuentra, no publica.
- El correo del usuario de pruebas sí aparece en el reporte.

El job `e2e` no corre dos veces a la vez (`concurrency`), porque la prueba de
logout cierra todas las sesiones del usuario. Por lo mismo, no corras la suite
en local mientras hay una corrida en GitHub.

### Pendiente

Usar en CI un usuario de pruebas propio, distinto del de local y con un correo
que no sea de un buzón público como los de Mailsac. El correo queda a la vista
en el reporte, y un buzón que cualquiera puede leer no debería ser el de una
cuenta con sesión. Con usuarios separados, además, una corrida en GitHub y una
en local dejan de cerrarse la sesión entre sí. Solo hay que crear el usuario en
Supabase y cambiar los secretos `E2E_USER_EMAIL` y `E2E_USER_PASSWORD`.

## Estructura

```
pages/       Page objects: locators y acciones de cada pantalla
support/     Utilidades compartidas (credenciales, espera de hidratación, diálogos, Mailsac, reporter)
  locales/        Textos visibles de la app, un archivo por idioma (hoy solo es.ts)
tests/
  auth.setup.ts   Inicia sesión una vez y guarda la sesión en .auth/
  auth/           Sin sesión: login, registro y protección de rutas
  dashboard/      Con sesión: today, habits (pestañas, CRUD, progreso y gym), finance, watchlist
  session/        Logout
```

La estructura refleja la del proyecto web: `tests/auth` cubre `app/(auth)` y
`tests/dashboard` cubre `app/(dashboard)`.

### Proyectos de Playwright

- **setup** — inicia sesión por la UI y guarda cookies en `.auth/user.json`.
- **auth** — pruebas sin sesión.
- **dashboard** — depende de `setup` y arranca cada prueba ya autenticada.
- **logout** — corre al final (es el _teardown_ de `setup`), porque Supabase
  cierra sesión de forma global e invalidaría la sesión guardada.

## Convenciones

- Una spec por módulo o pantalla, en la carpeta de su grupo de rutas.
- El código va en inglés: nombres, comentarios, títulos de las pruebas, mensajes
  y datos de prueba.
- El texto visible de la app (en español) vive solo en `support/locales/es.ts`.
  Los page objects y las specs lo leen de `ui` (`support/ui.ts`), por ejemplo
  `ui.login.heading`, en lugar de escribirlo directamente. Para probar otro
  idioma se agrega otro archivo en `support/locales/` con la misma forma.
- Los locators viven en los page objects y usan roles y textos visibles
  (`getByRole`, `getByLabel`), no clases CSS.
- Después de navegar a una pantalla con formulario, espera la hidratación
  (`waitForHydration`) antes de escribir; los page objects ya lo hacen en `goto()`.
- Las pruebas de registro simulan las respuestas de Supabase (`mockSignup`,
  `mockVerifyCode`, `mockResendCode`) para no crear usuarios reales ni enviar
  correos. La excepción es `register-email.spec.ts`, que usa correo real.
- Las pruebas del dashboard no deben depender de los datos que ya tenga el
  usuario: si una prueba necesita datos, que los cree y los borre ella misma.
- Las specs del dashboard corren en paralelo con el mismo usuario: cada prueba
  usa un nombre único para sus datos y solo verifica su propia fila. En hábitos,
  `HabitsPage.createHabit()` y `deleteCreatedHabits()` se encargan de crear y
  borrar; en el gym, `GymPage.createWorkout()`, `addSet()` y
  `deleteCreatedData()`.
- Las pantallas que suman los datos de todo el usuario, como `/habits/progress`,
  se prueban por la fila de la prueba y no por sus totales.
