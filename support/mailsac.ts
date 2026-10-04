import { randomBytes } from "node:crypto";
import { getMailsacApiKey } from "./env";

const API_URL = "https://mailsac.com/api";
const POLL_INTERVAL = 3_000;

type MailsacMessage = { _id: string; links?: string[] };

export type ConfirmationEmail = { code: string; link: string };

/**
 * A fresh address on Mailsac's public domain. Public inboxes need no setup,
 * but anyone who knows the address can read them: only use it for throwaway accounts.
 */
export function newInboxAddress(): string {
  return `b360-e2e-${Date.now()}-${randomBytes(3).toString("hex")}@mailsac.com`;
}

async function mailsacGet(path: string): Promise<Response> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Mailsac-Key": getMailsacApiKey() },
  });

  if (!response.ok) {
    throw new Error(`Mailsac answered ${response.status} for ${path}: ${await response.text()}`);
  }

  return response;
}

/** Polls the inbox until its first message arrives. */
async function waitForMessage(address: string, timeout: number): Promise<MailsacMessage> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const response = await mailsacGet(`/addresses/${encodeURIComponent(address)}/messages`);
    const messages = (await response.json()) as MailsacMessage[];
    if (messages.length > 0) return messages[0];

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }

  throw new Error(`No email arrived at ${address} within ${timeout / 1000}s.`);
}

/** Waits for the signup confirmation email and returns the code and the link it carries. */
export async function waitForConfirmationEmail(
  address: string,
  timeout = 60_000,
): Promise<ConfirmationEmail> {
  const message = await waitForMessage(address, timeout);
  const response = await mailsacGet(`/text/${encodeURIComponent(address)}/${message._id}`);
  const text = await response.text();

  // The code sits on a line of its own; the token_hash in the link also has digits
  const code = text.match(/^\s*(\d{6,10})\s*$/m)?.[1];
  const link = message.links?.find((url) => url.includes("/auth/confirm"));

  if (!code || !link) {
    throw new Error(`The email sent to ${address} has no confirmation code or link:\n${text}`);
  }

  return { code, link };
}
