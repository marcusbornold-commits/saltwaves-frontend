# Distans B2B demo links

Private mastering demos for Distans prospects. Unique opaque URL tokens gate the page. Uploads run through the real PodMaster / Distans chain on the Mini (legacy `/upload` path), attributed as `tool=distans_demo`.

**Never use Earselect.** Logging and the `distans_demo_links` table live on the Saltwaves / PodMaster Supabase project only (`foxohcrjubrregfjfznl`).

## URL pattern (for Clara)

```
https://app.saltwaves.studio/demo/distans/<token>
```

Example:

```
https://app.saltwaves.studio/demo/distans/xK7mQ2nP9rT4vW8yZ1aB3cD5
```

Share the full URL privately. No Auth.js login is required. The prospect enters an email on the page for delivery (pre-filled when the row has `email`).

## Create a link (SQL)

Generate a long opaque token (16–128 chars, URL-safe). Insert into Saltwaves Supabase:

```sql
insert into public.distans_demo_links (token, prospect_id, email, active)
values (
  -- Prefer a hand-rolled opaque string (avoid + / from raw base64):
  'clara-acme-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20),
  'acme-podcast',              -- optional internal id
  'producer@acme.example',     -- optional; pre-fills the form
  true
)
returning 'https://app.saltwaves.studio/demo/distans/' || token as url, token, id;
```

Deactivate a link:

```sql
update public.distans_demo_links
set active = false
where token = '<token>';
```

## What happens on first upload

1. Prospect opens `/demo/distans/<token>`. The server loads `distans_demo_links` where `token` matches and `active = true`. Invalid / inactive → English error page.
2. They pick a **raw single-track** file (WAV / MP3 / M4A). Client + `/api/demo/distans/[token]/upload-token` enforce **max 2 GB** and **max 1 hour**.
3. Browser mints a short-lived upload JWT (`lifetime_creator` tier for Mini headroom), then uploads **directly to the Mini** `/upload` with query params `tool=distans_demo` and `demo_token=<token>` (plus email / mic).
4. On success the UI shows the same “queued / we’ll email you” outcome as PodMaster B2C. Mastered file delivery and 48h retention are unchanged.
5. The page POSTs `/api/demo/distans/[token]/ack`, which sets `first_upload_at` **once** (first successful upload only; later uploads leave the timestamp alone).

## Schema

Migration: `supabase/migrations/202609170001_distans_demo_links.sql`

| Column | Notes |
|--------|--------|
| `token` | Opaque unique URL segment |
| `prospect_id` | Optional internal label |
| `email` | Optional pre-fill |
| `active` | Soft revoke |
| `created_at` | Insert time |
| `first_upload_at` | Set on first successful upload |

Also extends `upload_events.tool` to allow `distans_demo` (alongside `podmaster`, `audioform`, `loudness_inspector`).

## Backend note (Mini)

Frontend enforces 2 GB / 1 h. The upload JWT uses the `lifetime_creator` tier so the Mini does not apply free-tier ceilings. Confirm the FastAPI `/upload` path accepts `tool=distans_demo` (and optional `demo_token`) for attribution into `upload_events` / job metadata. If Mini still caps below 2 GB, raise that ceiling for `tool=distans_demo` on the backend.

## MVP out of scope

- Admin UI for minting links (use SQL above)
- Email one-time codes (token URL is the primary gate)
- In-browser job polling (matches PodMaster: email delivery)
