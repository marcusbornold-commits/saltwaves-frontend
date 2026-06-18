import { signIn } from "@/auth";
import Logo from "@/components/Logo";

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string;
    verify?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl, verify, error } = await searchParams;
  const redirectTo = callbackUrl ?? "/account";
  // Magic link kräver Supabase-adaptern + Resend; visas först när env är satt.
  const magicLinkEnabled = Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.AUTH_RESEND_KEY
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f0ede8] px-5">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-center">
          <Logo />
        </div>

        <h1 className="mb-2 text-center text-2xl font-bold text-[#1a1a1a]">
          Sign in
        </h1>
        <p className="mb-8 text-center text-sm text-[#1a1a1a]/60">
          Continue to Saltwaves Studio
        </p>

        {verify === "1" && (
          <p className="mb-6 rounded-lg border border-[#1a1a1a]/10 bg-white/50 px-4 py-3 text-center text-sm text-[#1a1a1a]/80">
            Check your email for a magic link to sign in.
          </p>
        )}

        {error && (
          <p className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            Something went wrong. Please try again.
          </p>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#1a1a1a]/15 bg-white px-4 py-3 text-sm font-medium text-[#1a1a1a] transition-colors hover:border-[#1a1a1a]/25"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </form>

        {magicLinkEnabled && (
          <>
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#1a1a1a]/10" />
              <span className="text-xs text-[#1a1a1a]/40">or</span>
              <div className="h-px flex-1 bg-[#1a1a1a]/10" />
            </div>

            <form
              action={async (formData) => {
                "use server";
                const email = formData.get("email");
                if (typeof email !== "string" || !email) return;
                await signIn("resend", { email, redirectTo });
              }}
              className="space-y-3"
            >
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-lg border border-[#1a1a1a]/15 bg-white px-4 py-3 text-sm text-[#1a1a1a] placeholder:text-[#1a1a1a]/35 outline-none transition-colors focus:border-[#ff6200] focus:ring-2 focus:ring-[#ff6200]/20"
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-[#ff6200] px-4 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#ff6200]/25"
              >
                Send magic link
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.616z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
