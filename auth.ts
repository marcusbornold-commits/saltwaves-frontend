import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import { authConfig } from "./auth.config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasAdapter = Boolean(supabaseUrl && supabaseServiceRoleKey);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  ...(hasAdapter
    ? {
        adapter: SupabaseAdapter({
          url: supabaseUrl!,
          secret: supabaseServiceRoleKey!,
        }),
      }
    : {}),
  providers: [
    Google,
    // Magic link kräver en databas-adapter; aktiveras när Supabase-env finns.
    ...(hasAdapter
      // TODO: byt tillbaka till login@saltwaves.studio när domänen är verifierad i Resend (kräver Cloudflare DNS-migrering)
      ? [Resend({ from: "onboarding@resend.dev" })]
      : []),
  ],
  session: {
    strategy: "jwt",
  },
});
