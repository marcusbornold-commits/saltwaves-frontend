# Audiobook monitoring

Dedicated Supabase project: xuxqrkposxrvhwvwjroc. Never run this migration in PodMaster's project.

Vercel Cron calls `/api/audiobook/monitor` every five minutes using the existing strong CRON_SECRET. AUDIOBOOK_MONITOR_ENABLED=true enables checks. Email uses the existing AUTH_RESEND_KEY and verified sender login@send.saltwaves.studio; the sole recipient is marcus@saltwaves.studio. Secrets are server-only.

Checks: public Mini API/worker heartbeat, login page, private bucket metadata endpoint, Mini job-sync heartbeat, free disk, cleanup results and heartbeat, queued jobs without a running worker, and at least three failed jobs in 15 minutes. Long-running books are not classified as stuck based on age alone. This is not an end-to-end audio test or a write/read test of Storage transfers.

The existing Mini job-sync LaunchAgent publishes a private health snapshot every minute. Updated source is in ops/audiobook; deployment of Python is separate from web Git deployment. It reads the queue without altering processing and is installed atomically without restarting API or worker.

Three failing checks open one incident (normally 10–15 minutes after failure); two healthy checks close it (normally 5–10 minutes after recovery). A five-minute check ID suppresses duplicate invocations. SQL row locking serializes state updates. Notification outbox rows survive mail failures and retry next check; Resend idempotency keys suppress duplicate accepted sends within its idempotency window. No periodic incident reminders are sent. Pending mail after a prolonged provider/ack outage may duplicate outside that window.

When the state database itself is unavailable, a separate deterministic email warns at most once per UTC day using Resend idempotency. Automatic recovery email cannot be guaranteed for this fallback. Email delivery failures return HTTP 503 and remain pending when state storage works.

The customer sees a generic incident banner; private diagnostics, counts and email addresses are not exposed. Stale monitoring data is displayed as unknown. New upload reservations are paused when a fresh Mini snapshot shows less than 5 GiB free. Existing transfers and processing retain their own guards and retries. There are no new forced restarts of live audio jobs. Existing launchd KeepAlive restarts crashed services; existing TUS/client and job-sync retry logic remains.

Limitations: this monitor runs outside Mac Mini on Vercel, not outside Vercel. A total Vercel/Cron or Resend outage requires independent provider monitoring; this setup alone cannot report its own total outage. Physical deletion still depends on Mini cleanup availability. A public health endpoint is not proof every audio job can succeed.

Validation: six pure health scenarios, four mirror tests, transactional SQL test of duplicate suppression/three failures/one alarm/two successes/one recovery, local authenticated monitor invocation against live services, and one clearly labeled test email accepted by Resend. No service was stopped to test alarms. Build and diff checks passed.

Rollback: set AUDIOBOOK_MONITOR_ENABLED=false in production and redeploy; remove only the Audiobook cron entry if retiring it. Preserve /api/queue/cleanup and existing B2C settings. There is no PodMaster DB or DSP change.
