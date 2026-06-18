import { createClient } from "@supabase/supabase-js";

export async function ensureProfileForUser(userId: string): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.warn("Skipping profile ensure: Supabase env not configured");
    return;
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      subscription_status: "free",
      lifetime_creator: false,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (error) {
    console.error(`Failed to ensure profile for user ${userId}:`, error.message);
  }
}
