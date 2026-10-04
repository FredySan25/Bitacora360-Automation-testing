/** True when `.env` has the service role key that lets the tests delete the users they create. */
export function hasSupabaseAdmin(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Deletes a user through the Supabase Auth admin API. */
export async function deleteUser(userId: string): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.");
  }

  const response = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  if (!response.ok) {
    throw new Error(`Supabase answered ${response.status} deleting user ${userId}: ${await response.text()}`);
  }
}
