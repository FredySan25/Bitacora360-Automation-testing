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

## Ejecución

No hace falta levantar la app antes: Playwright corre `npm run dev` en
`../Bitacora360WebProyect` y lo apaga al terminar. Si ya está corriendo en
`http://localhost:3000`, reutiliza ese servidor.

| Comando                  | Qué hace                                             |
| ------------------------ | ---------------------------------------------------- |
| `npm test`               | Corre toda la suite                                  |
| `npm run test:auth`      | Solo las pruebas sin sesión (no requieren `.env`)    |
| `npm run test:dashboard` | Solo las pruebas con sesión                          |
| `npm run test:ui`        | Modo UI: correr, depurar y ver cada paso             |
| `npm run test:headed`    | Corre con el navegador visible                       |
| `npm run test:debug`     | Paso a paso con el inspector de Playwright           |
| `npm run report`         | Abre el reporte HTML de la última corrida            |
| `npm run codegen`        | Graba acciones en el navegador y genera locators     |
| `npm run typecheck`      | Revisa los tipos de TypeScript                       |

Un archivo o una prueba en particular:

```bash
npx playwright test tests/auth/login.spec.ts
npx playwright test -g "wrong credentials"
```

Para probar contra una app desplegada, define `BASE_URL` en `.env`.

## Estructura

```
pages/       Page objects: locators y acciones de cada pantalla
support/     Utilidades compartidas (credenciales, espera de hidratación)
  locales/        Textos visibles de la app, un archivo por idioma (hoy solo es.ts)
tests/
  auth.setup.ts   Inicia sesión una vez y guarda la sesión en .auth/
  auth/           Sin sesión: login, registro y protección de rutas
  dashboard/      Con sesión: una spec por módulo (today, habits, finance, watchlist)
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
  correos.
- Las pruebas del dashboard no deben depender de los datos que ya tenga el
  usuario: si una prueba necesita datos, que los cree y los borre ella misma.
