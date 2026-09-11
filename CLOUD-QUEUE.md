# B2C queue selection

## Branded downloads (2026-09-11)

`/download/<job-uuid>?token=<existing-capability>&kind=mastered` is an external Vercel rewrite to the Mini's protected `/b2c/jobs/<id>/file` endpoint. It proxies audio without an HTTP redirect or a Next.js Function. Only the UUID-shaped download route is proxied. Caching is disabled; responses are marked no-referrer/noindex. The Mini still enforces the token and 48h expiry, including Range/HEAD requests.

Deploy and verify this route before enabling `PODMASTER_DOWNLOAD_BASE_URL=https://app.saltwaves.studio/download` on the Mini B2C worker. Unset that worker setting to revert future emails to the legacy URL. Keep both routes available for already-sent links. Storage and the paid upload flag are independent. Download traffic now also counts against Vercel transfer usage.

## Paid Storage input (approved 2026-09-11)

This section replaces the queue-only input design below. `PODMASTER_QUEUE_BACKEND=supabase` still selects the shared queue. Independent `PODMASTER_PAID_UPLOADS=off|canary|on` controls only paid file transport (default off). Canary IDs are comma-separated in `PODMASTER_PAID_UPLOAD_TEST_USERS`.

Creator, Studio and Founding are resolved server-side from the authenticated user's existing access profile. Free keeps direct multipart `/upload-b2c` on Mini. Paid browser uploads use the direct Storage hostname, signed `/storage/v1/upload/resumable/sign`, 6 MiB TUS chunks and a private immutable object per job in `podmaster-input-paid`. Both global and bucket limits must support the existing 1048576000-byte ceiling; plan minutes and duration caps are unchanged.

`POST /api/queue/uploads` creates/resumes a service-only draft and signs the exact assigned path. It enforces ownership, paid access, metadata, file size, duration pre-check and existing 3-active/30-per-hour grant limits. `POST /api/queue/uploads/:id` verifies stored object size and atomically enqueues once. `DELETE` cancels only an owned unqueued paid draft. Cookies authenticate these APIs; the existing coarse upload token is not used to infer Creator/Studio. Backend validation of actual audio duration remains authoritative.

Retries reuse the same account/file-scoped upload draft. Tokens are never stored in client storage; the TUS client may store its resumable URL. Cancellation stops the transfer and requests draft cancellation. A failed final response is recovered by checking the existing object/job. Existing drafts may resume/complete during rollback; newly created drafts require the transport flag.

`GET /api/queue/health` is private/no-store and returns the current user's transport. Storage users are not blocked by a failed Mini health check. Their uploads can wait within the existing 48-hour queue lifetime. All output and email download links remain on Mini and still require Mini availability.

### Cleanup and rollout

`GET /api/queue/cleanup` is protected by a strong independent `CRON_SECRET`; Vercel invokes it every 15 minutes. It expires paid drafts after 2h and queued jobs at their existing deadline, fences workers, then removes terminal cloud inputs. It runs independently of Mini. Terminal inputs are rechecked for 30h after creation to catch late uploads allowed by existing grants/TUS sessions. The Mini separately removes expired output files and metadata. Do not put `CRON_SECRET` or service credentials in `NEXT_PUBLIC_*` variables.

Deploy backend support and migration 202609110005 first. Deploy this web with the flag off, set canary mode and verify an authenticated paid upload before setting on. Use server-side runtime env values, and redeploy after changing Vercel configuration. Roll back only `PODMASTER_PAID_UPLOADS=off`, keeping the queue, worker, API completion routes and cleaner available until existing work/grants drain. Do not remove the bucket during rollback.

Validation includes a production build, backend tests and live canaries for all plans, cross-account denial, exact size boundary, interrupted TUS resume, completion idempotency, full Mini processing/download, independent cleanup and expiry. Test identities and their jobs must be explicitly tracked and removed; never claim arbitrary queue jobs for a test.

## Historical queue-only input (2026-09-08)

Marcus confirmed that only the B2C queue moves to Supabase. All audio files, processing and downloads remain on the always-on Mac Mini. B2B and Local Run keep their current paths.

`PODMASTER_QUEUE_BACKEND=supabase` selects the Mini's `/upload-b2c` endpoint for customer uploads. Default `legacy` selects existing `/upload`. The browser still sends multipart audio directly to the Mini with the existing upload token. No audio is sent through Vercel functions or to Supabase Storage. No TUS client or Vercel storage-cleanup cron is used.

`GET /api/queue/health` reports the selected queue and, in Supabase mode, verifies access to its table. The existing Mini health check stays in place. Server-side plan validation and queue registration run on the Mini.

Deploy the matching PodMaster backend migrations, route and separate B2C worker before setting the flag. See that repository's `CLOUD-QUEUE.md` for worker setup, retry, retention and rollback. A rollback sets the flag to `legacy` and redeploys this frontend; keep the Mini's B2C worker and download endpoints until queued jobs and links have expired.

Validation: `npm run build`, then an actual synthetic multipart upload through the selected production endpoint, Supabase claim, local audio processing and protected Mini download. B2B and Local Run routes must not change.
