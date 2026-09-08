# B2C queue selection

Marcus confirmed that only the B2C queue moves to Supabase. All audio files, processing and downloads remain on the always-on Mac Mini. B2B and Local Run keep their current paths.

`PODMASTER_QUEUE_BACKEND=supabase` selects the Mini's `/upload-b2c` endpoint for customer uploads. Default `legacy` selects existing `/upload`. The browser still sends multipart audio directly to the Mini with the existing upload token. No audio is sent through Vercel functions or to Supabase Storage. No TUS client or Vercel storage-cleanup cron is used.

`GET /api/queue/health` reports the selected queue and, in Supabase mode, verifies access to its table. The existing Mini health check stays in place. Server-side plan validation and queue registration run on the Mini.

Deploy the matching PodMaster backend migrations, route and separate B2C worker before setting the flag. See that repository's `CLOUD-QUEUE.md` for worker setup, retry, retention and rollback. A rollback sets the flag to `legacy` and redeploys this frontend; keep the Mini's B2C worker and download endpoints until queued jobs and links have expired.

Validation: `npm run build`, then an actual synthetic multipart upload through the selected production endpoint, Supabase claim, local audio processing and protected Mini download. B2B and Local Run routes must not change.
