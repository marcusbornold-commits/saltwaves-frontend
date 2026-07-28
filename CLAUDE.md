# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # dev server on :3000
npm run build    # production build (also the only full typecheck — tsconfig is noEmit)
npm run start    # serve the production build
npm run lint     # eslint (flat config, eslint-config-next core-web-vitals + typescript)
```

There is no test framework in this repo. `npm run build` is the verification step for type errors; `npx tsc --noEmit` typechecks without building.

Env vars live in `.env.local` (gitignored); `.env.example` lists every key. Missing Stripe/Supabase keys throw at call time, not at boot — `getStripe()`, `getSupabaseAdmin()`, and `getPriceIdsFromEnv()` all lazily validate and throw, so a page that renders pricing will 500 rather than degrade if price IDs are unset.

## Architecture

Next.js 16 App Router + React 19, TypeScript strict, deployed on Vercel. No CSS framework, no state library, no ORM — plain CSS and direct SDK calls.

### Route groups

`app/` is split by shell, not by URL:

- `(marketing)` — public pages, wrapped in `Nav`/`Footer` from `app/components/saltwaves-sections`. The homepage (`(marketing)/page.tsx`) is a thin server component that reads the session and Stripe price IDs, then hands off to the client component `app/components/saltwaves-app.tsx`, which assembles the whole landing page from the ported design sections.
- `(app)` — authenticated surface (`/dashboard`, `/account`, `/login`, `/verify-request`). Layout is a passthrough.
- `(funnel)` — `/founding` lifetime-deal page, wordmark-only header.
- `app/tools/*` — internal tools, `robots: { index: false }`. Never linked from navigation.
- `app/ab/[slug]` — private A/B listening pages, driven by the static `AB_PAGES` map in `lib/ab-pages.ts` plus audio files under `public/ab/<slug>/`.

Two component directories exist and are not interchangeable: `app/components/` holds the ported design system (hero, sections, UI primitives, ABPlayer); root `components/` holds a couple of small standalone client components.

### Auth

Auth.js v5 (`next-auth@5 beta`) split across three files, the standard edge-safe pattern:

- `auth.config.ts` — providerless config (pages, `authorized`/`jwt`/`session` callbacks). Edge-safe.
- `auth.ts` — full config with Google + Resend providers and the Supabase adapter. **The Resend magic-link provider and the adapter are only registered when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are both set** — without them, Google is the only login method.
- `middleware.ts` — matches `/dashboard/*` and `/app/*` only.

Sessions are JWT strategy; `session.user.id` is populated from `token.sub` (typed in `types/next-auth.d.ts`).

### Access control

`lib/access.ts` is the single source of truth for what a user may do. It reads the `profiles` row via the Supabase service-role client and maps it to an `AccessLevel` (file size / duration caps). Plan resolution order matters: `lifetime_creator === true` wins over `subscription_status`, so founding members keep access even after subscription events. `-1` means unlimited. Server components should call `requireAccess()` / `requireAuth()` rather than reading profiles directly.

`lib/supabase/admin.ts` returns a memoized service-role client and is `server-only`. There is no browser Supabase client and no RLS-based client path — all DB access is server-side and privileged.

### Billing

Stripe is the source of truth; Supabase `profiles` is the projection.

- `POST /api/stripe/checkout` — validates `price_id` against the env allowlist (`isAllowedPriceId`), lazily creates and stores the Stripe customer, then creates a session. Founding-tier prices switch the session to `mode: "payment"` (one-off) instead of `"subscription"`.
- `POST /api/stripe/webhook` — `runtime = "nodejs"`, verifies the signature against `STRIPE_WEBHOOK_SECRET`, and handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Subscription handlers **bail out early if `profile.lifetime_creator`** so lifetime access is never revoked by a subscription event.
- `POST /api/stripe/portal` — billing portal redirect.
- `lib/stripe-helpers.ts` — price-ID → plan mapping, allowlist, success/cancel URLs. Note `getSubscriptionPeriodEnd()`: on the current Stripe API, `current_period_end` lives on the subscription *item*, not the subscription root.
- `lib/pricing.ts` — display tiers plus `getPriceIdsFromEnv()`. Price IDs are read server-side and passed down to client components as props; they are never hardcoded.
- `lib/founding.ts` — counts completed founding purchases by paging Stripe checkout sessions and matching line-item price IDs. The cap (20) and tier prices are hardcoded here alongside the env price IDs.

Client-side, `lib/checkout-client.ts` posts to the checkout route and redirects to `/login?callbackUrl=…` on a 401.

### Audio pipeline

The Next.js app is a frontend to a separate FastAPI service (`NEXT_PUBLIC_API_URL` / `API_URL`):

- `app/api/upload/route.ts` proxies multipart uploads server-side, forwarding the raw Auth.js JWT as a `Bearer` header so the backend can identify the user.
- `lib/upload-client.ts` is the browser path: it fetches a raw JWT from `/api/upload-token`, then uploads **directly** to the FastAPI service. Both paths validate the `.wav|.mp3|.m4a` extension and return structured `error_code` + human `message` pairs — keep the two in sync when changing accepted formats or error copy.
- `lib/audio-analysis.ts` decodes audio to 48k in the browser and computes ITU-R BS.1770-4 loudness, true peak, and LTAS. It is shared by `/tools/ab-analyzer` and `/tools/local-run`.

`app/tools/local-run/` is a laptop-only panel that talks to a Python runner at `http://127.0.0.1:8766` over an SSH tunnel — see `LOCAL-RUN.md` (Swedish) for the startup sequence. `EXPECTED_RUNNER_VERSION` in `LocalRunPanel.tsx` must be bumped whenever `runner.py` bumps its version, or the panel reports a mismatch.

### Styling

- `app/globals.css` was ported verbatim from `_design-export/` (the original design HTML + CSS). Design tokens are CSS custom properties on `:root` (`--orange`, `--paper`, `--ink`, `--line`, `--mono`, …). Prefer the tokens over literal colors.
- Route-scoped plain CSS files (`login.css`, `account.css`, `pricing.css`, `founding.css`) are imported directly by their page; `legal.module.css` is the one CSS module.
- Self-contained components ship their CSS as a template-string constant rendered in a `<style>` tag (`ABA_CSS` in `ab-analysis-ui.tsx`, `CSS` in `ABPlayer.tsx`).
- `_design-export/` is the untouched design source. It is reference material, not built code — port from it, don't import it.

### Conventions

- `@/*` maps to the repo root.
- Server-only modules start with `import "server-only"` — anything touching Stripe secrets, the service-role key, or `lib/access.ts`.
- User-facing copy is English; some inline comments, `LOCAL-RUN.md`, and the internal tools' UI are Swedish. Keep new user-facing strings in English.
- Every page sets its own `metadata`; internal tools set `robots: { index: false, follow: false }`.
