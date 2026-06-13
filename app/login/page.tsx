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
  const redirectTo = callbackUrl ?? "/dashboard";
  // Magic link kräver Supabase-adaptern + Resend; visas först när env är satt.
  const magicLinkEnabled = Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.AUTH_RESEND_KEY
  );

  return (
    <main className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <Logo />
        </div>

        <h1 className="login-title">Sign in</h1>
        <p className="login-sub">Continue to Saltwaves Studio</p>

        {verify === "1" && (
          <p className="login-note">
            Check your email for a magic link to sign in.
          </p>
        )}

        {error && (
          <p className="login-note error">
            Something went wrong. Please try again.
          </p>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo });
          }}
        >
          <button type="submit" className="btn-google">
            <GoogleIcon />
            Continue with Google
          </button>
        </form>

        {magicLinkEnabled && (
          <>
            <div className="login-divider">
              <span>or</span>
            </div>

            <form
              action={async (formData) => {
                "use server";
                const email = formData.get("email");
                if (typeof email !== "string" || !email) return;
                await signIn("resend", { email, redirectTo });
              }}
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
                className="login-field"
              />
              <button type="submit" className="btn-primary-full">
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
