<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This repo is the Next.js 16 frontend only (see `CLAUDE.md` for full architecture). Standard commands live in `CLAUDE.md`/`package.json` (`npm run dev|build|lint|start`); `npm run build` is the only full typecheck.

- Dev server: `npm run dev` on `http://localhost:3000` (Turbopack). The update script already runs `npm ci`, so just start the server.
- `.env.local` (gitignored) must exist or key pages break. The homepage calls `getPriceIdsFromEnv()` directly and returns 500 if the four `STRIPE_PRICE_*` subscription IDs are unset, and `auth()` needs `AUTH_SECRET`. A dev `.env.local` with `AUTH_SECRET` + dummy `STRIPE_PRICE_*` values is enough to render marketing pages, `/pricing`, and the `/tools/*` instruments. If it's missing, recreate it from `.env.example`; most other keys validate lazily (throw only when their code path runs).
- Expected 500s without real credentials: `/founding` calls the live Stripe API (needs a real `STRIPE_SECRET_KEY`) to count founding purchases; `/api/upload` returns 503 without a reachable FastAPI backend (`NEXT_PUBLIC_API_URL`); login/account/dashboard need Supabase env (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`). These are external-dependency gaps, not bugs.
- No-backend core-functionality smoke test: `/tools/ab-analyzer` runs real BS.1770-4 loudness DSP entirely in the browser. Load `/tools/ab-analyzer?a=<same-origin-wav-url>&b=<same-origin-wav-url>` (files served from `public/` avoid CORS) to auto-fetch, analyze, and render LUFS/true-peak/LRA — no external services required.
- `npm run lint` currently reports pre-existing errors in the ported design components (`app/components/*`) and internal tools (`app/tools/local-run/LocalRunPanel.tsx`); the linter itself works. Do not "fix" these as part of unrelated work.
