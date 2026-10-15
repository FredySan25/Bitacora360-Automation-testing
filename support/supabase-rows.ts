import type { Page, Response } from "@playwright/test";

type SupabaseAccess = { restUrl: string; headers: Record<string, string> };

type Mock = { method?: string; status: number; body: unknown };

function isCallTo(url: string, table: string): boolean {
  return new URL(url).pathname === `/rest/v1/${table}`;
}

const byPage = new WeakMap<Page, SupabaseRows>();

/**
 * The rows a test writes to Supabase through the app, and the way to delete
 * them afterwards: the REST API, with the credentials the browser already used
 * in that session. It needs no environment variables.
 */
export class SupabaseRows {
  private access?: SupabaseAccess;
  private readonly created: { table: string; id: string }[] = [];

  private constructor(private readonly page: Page) {}

  /**
   * The rows of a browser page. Every page object of a test gets the same
   * instance, so the credentials one of them saw serve the others too.
   */
  static of(page: Page): SupabaseRows {
    let rows = byPage.get(page);
    if (!rows) {
      rows = new SupabaseRows(page);
      byPage.set(page, rows);
    }
    return rows;
  }

  /**
   * Waits for the app to call a table, by default to insert a row. Start it
   * before the action that triggers the call and await it afterwards. A row
   * the app inserted is remembered for `deleteCreated`.
   */
  async waitForCall(table: string, methods: string[] = ["POST"]): Promise<Response> {
    const response = await this.page.waitForResponse(
      (candidate) =>
        isCallTo(candidate.url(), table) && methods.includes(candidate.request().method()),
    );
    const request = response.request();

    const { apikey, authorization } = await request.allHeaders();
    this.access = {
      restUrl: `${new URL(request.url()).origin}/rest/v1`,
      headers: { apikey, authorization },
    };

    if (!response.ok()) {
      throw new Error(
        `Supabase answered ${response.status()} to ${request.method()} ${table}: ${await response.text()}`,
      );
    }
    if (request.method() === "POST") {
      const { id } = await response.json();
      this.created.push({ table, id });
    }
    return response;
  }

  /**
   * Deletes every row the test inserted through any of its page objects, the
   * last one first. It works wherever the test left them: edited, moved to
   * another month or already deleted.
   */
  async deleteCreated() {
    for (const row of this.created.splice(0).reverse()) {
      await this.delete(row.table, { id: `eq.${row.id}` });
    }
  }

  /**
   * Deletes the rows of a table that match a PostgREST filter, e.g.
   * `{ category: "eq.food" }`, and resolves to how many there were.
   */
  async delete(table: string, filter: Record<string, string>): Promise<number> {
    // Before the first call there are no credentials, and nothing of this test to delete
    if (!this.access) return 0;

    const response = await this.page.request.delete(`${this.access.restUrl}/${table}`, {
      params: filter,
      headers: { ...this.access.headers, prefer: "return=representation" },
    });
    if (!response.ok()) {
      throw new Error(
        `Supabase answered ${response.status()} cleaning up ${table}: ${await response.text()}`,
      );
    }
    const deleted: unknown[] = await response.json();
    return deleted.length;
  }
}

/**
 * Answers the calls the app makes to a Supabase table, so a test can see a
 * state it has no data for: an empty list, or a request that fails. Without a
 * method it answers every call to the table.
 */
export async function mockSupabaseTable(page: Page, table: string, mock: Mock) {
  await page.route(
    (url) => isCallTo(url.href, table),
    async (route) => {
      if (mock.method && route.request().method() !== mock.method) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: mock.status,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(mock.body),
      });
    },
  );
}

/**
 * Holds the calls the app makes to a Supabase table with that method until
 * the returned function is called; then they go on to Supabase. It lets a
 * test see what the screen shows while it waits.
 */
export async function holdSupabaseTable(
  page: Page,
  table: string,
  method: string,
): Promise<() => void> {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    (url) => isCallTo(url.href, table),
    async (route) => {
      if (route.request().method() === method) await released;
      await route.fallback();
    },
  );
  return release;
}
