# Customer uploads through Supabase

Set `PODMASTER_QUEUE_BACKEND=supabase` to enable the new upload path. The default is `legacy` for controlled rollout/rollback. The matching backend, SQL migration and operational instructions are in the PodMaster repository's `CLOUD-QUEUE.md`.

The browser obtains a job-scoped signed upload token from `POST /api/jobs`, then uploads directly to private Supabase Storage using 6 MiB TUS chunks and the `/storage/v1/upload/resumable/sign` endpoint. Audio never passes through a Vercel function. `POST /api/jobs/:id/complete` verifies actual Storage size and atomically queues the job. It is safe to retry completion.

The existing Auth.js session and Supabase subscription lookup determine plan entitlements on the server. Queue table access stays service-only. The job capability returned to the caller permits only that job's status, completion and download; it never permits listing other users' jobs. Do not log capability URLs or expose service credentials to clients.

`GET /api/jobs/:id` reports status. `GET /api/jobs/:id/file` requires the capability, checks logical expiry, validates the requested output path and redirects to a private Storage URL lasting no more than 60 seconds. These routes must remain deployed while cloud jobs or download links exist, including during a switch back to legacy uploads.

`GET /api/queue/health` checks the active upload destination. In cloud mode it does not require a running Mac Mini, so upload controls stay available during worker downtime. The Mac Mini still performs the audio processing.

`/api/internal/queue-maintenance` requires `Authorization: Bearer <CRON_SECRET>` and runs every 15 minutes on Vercel Pro. It expires abandoned upload grants after two hours, queued jobs after 48 hours, and successful jobs 48 hours after completion. It deletes only each expired job's private Storage prefixes and clears personal metadata. Keep the cron secret on the server. Monitor failed maintenance requests; an unavailable cleanup service delays physical deletion but not logical link expiry.

Required server settings: existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPLOAD_TOKEN_SECRET`, plus `PODMASTER_QUEUE_BACKEND` and `CRON_SECRET`. Private input buckets enforce existing Free/paid size ceilings independently of the larger result bucket. Never make buckets public to fix an upload error.

Validation: `npm run test:queue`, `npm run build`, followed by a synthetic TUS/upload/queue/worker/download/expiry test. Do not send test email to customers or use customer audio for deployment checks.
