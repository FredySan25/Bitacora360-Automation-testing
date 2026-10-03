import { es } from "./locales/es";

/** Shape every locale has to follow; `es` is the reference. */
export type UiText = typeof es;

/** Visible text of the app in the language under test. */
export const ui: UiText = es;
