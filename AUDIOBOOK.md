# Authenticated audiobook pilot

The published test page is `/tools/audiobook`. Access requires an authenticated user whose email appears in the production `AUDIOBOOK_ALLOWED_EMAILS` setting. Invitations and access changes are separate actions. Existing PodMaster plans, billing and queue routes retain their behavior.

## User flow

- Open `/login?callbackUrl=%2Ftools%2Faudiobook` to sign in and return to the pilot.
- Select a file and view its whole-book waveform overview. Large PCM WAV/RF64 inputs use bounded sampling rather than a full browser decode; this overview is not a quality measurement.
- Move a five- or ten-minute preview window by dragging, keyboard or start time. Choose −19, −18, −17 or −16 LUFS.
- Preview-master the selection, validate the original without mastering, or master the complete book. Subsequent operations reuse the uploaded source.
- Compare synchronized original/master playback, optionally at an approximately matched listening level. A preview is an actual processed excerpt; whole-book processing may produce a different result.
- Inspect the six-metric delivery report and any failed requirements. Preview reports explicitly cover only the selected interval; validation reports cover the original without implying it was mastered.
- Download the WAV with an editable name, initially the original filename stem. Preview filenames add `_provmaster` by default.

## Transport and storage

The browser uploads directly to private Supabase bucket `audiobook-private` with a scoped signed TUS grant, 6 MiB chunks and resumable retries. Next.js handles authenticated JSON control requests rather than large audio bodies. Backend tokens and the processing service URL stay server-side.

Audiobook audio storage uses a separate Supabase project from PodMaster. Authentication still uses the existing shared Auth.js setup. Production settings:

- `AUDIOBOOK_ENABLED=true`
- `AUDIOBOOK_ALLOWED_EMAILS` — comma-separated account allowlist
- `AUDIOBOOK_SERVICE_URL` — HTTPS URL of the isolated processing API
- `AUDIOBOOK_TOKEN_SECRET` — purpose-specific HS256 signing secret
- `AUDIOBOOK_STORAGE_URL` and `AUDIOBOOK_STORAGE_SERVICE_ROLE_KEY` — dedicated private storage, supplied together

Keep credentials in deployment configuration, never Git. The storage helper rejects an incomplete dedicated pair; its legacy fallback applies only when both dedicated variables are absent. Production uses the dedicated pair.

Input limit: 6 GiB and 15 hours, mono/stereo. Browser previews for MP3/M4A/AIFF are limited to 200 MiB; supported PCM WAV/RF64 inputs can use the full limit. The 20 GiB storage ceiling is not the application's upload limit. Outputs use WAV/RF64; listening previews use MP3, while reported measurements apply to the source and WAV master.

## Processing service

The isolated audiobook service is deployed separately on the Mac Mini. Its processing implementation is **not included in this frontend repository**. SQLite stores ownership, idempotency, queue state, source references and expiry; these job records are not stored in Supabase. API, worker and cleanup have separate launchd services.

The current API supports cloud reservations/completion, `preview`, `validate` and `master` operations, source reuse and owner-scoped status/media. The frontend depends on that deployed service version. Do not deploy the frontend against an older service that lacks these operations.

Long processing uses approximately ten-minute spans with overlaps, followed by whole-book loudness processing and final QC. This differs from adapting over a complete in-memory book. Disk availability is checked before processing; scratch work is removed after successful mastering. Running jobs fail explicitly after restart, while queued jobs survive.

## Retention

Inputs and results share a 48-hour expiry measured from the initial upload reservation; subsequent previews do not extend it. API access is denied at expiry, and signed listening/download URLs are capped by that deadline. The isolated cleanup service runs every minute, removes expired local and private cloud files, retries failures and revisits expired prefixes to catch late resumable uploads.

Physical deletion depends on the Mac Mini and cloud storage being reachable. If either is unavailable, cleanup retries when service returns. This is not an independent cloud retention scheduler. PodMaster's separate deletion rules are unchanged.

## Verification recorded for the published pilot

- Production build, TypeScript and targeted lint passed.
- Auth/owner isolation, reservation idempotency, preview bounds, source reuse, inherited expiry and scoped cleanup were tested against the service.
- An actual 15-hour RF64 input completed the cloud/master/download round trip with exact duration and matching checksum. It met −18 LUFS and the −3 dBTP ceiling but **failed the −60 dBFS noise-floor requirement**. Processing completion does not mean every delivery requirement passed.
- Real preview runs passed all four LUFS targets, including a short final excerpt. Separate validation and complete-book mastering were exercised using the same uploaded source.
- Actual cloud deletion and expired-access denial were verified.
- Browser checks covered a whole 15-hour waveform, movable preview selection and playback. The owner subsequently confirmed the page worked; no universal audio-quality guarantee follows from these checks.
- Original/custom WAV names, Swedish characters, preview suffixes and invalid filename rejection were checked.

The raw `/tools/local-run` adapter remains a separate development path. The new cloud preview/validation actions require the authenticated production pilot.
