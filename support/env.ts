import path from "node:path";

/** Where the setup project saves the logged-in session reused by the dashboard specs. */
export const STORAGE_STATE = path.resolve(__dirname, "../.auth/user.json");

export function hasTestUser(): boolean {
  return Boolean(process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD);
}

/** Credentials of the dedicated test user, read from `.env`. */
export function getTestUser(): { email: string; password: string } {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Faltan E2E_USER_EMAIL y E2E_USER_PASSWORD. Copia .env.example como .env y llena los datos del usuario de pruebas.",
    );
  }

  return { email, password };
}
