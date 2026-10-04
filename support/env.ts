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
      "Missing E2E_USER_EMAIL and E2E_USER_PASSWORD. Copy .env.example to .env and fill in the test user's credentials.",
    );
  }

  return { email, password };
}

export function hasMailsac(): boolean {
  return Boolean(process.env.MAILSAC_API_KEY);
}

/** API key of the Mailsac account used to read the emails the app sends. */
export function getMailsacApiKey(): string {
  const key = process.env.MAILSAC_API_KEY;

  if (!key) {
    throw new Error("Missing MAILSAC_API_KEY. Add your Mailsac API key to .env.");
  }

  return key;
}
