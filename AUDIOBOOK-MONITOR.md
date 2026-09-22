# Audiobook monitoring

Dedicated Supabase project: xuxqrkposxrvhwvwjroc. Never run this migration in PodMaster's project.

Vercel Cron calls `/api/audiobook/monitor` every five minutes using the existing strong CRON_SECRET. AUDIOBOOK_MONITOR_ENABLED=true enables checks. Email uses the existing AUTH_RESEND_KEY and verified sender login@send.saltwaves.studio; the sole recipient is marcus@saltwaves.studio. Secrets are server-only.

Checks: public Mini API/worker heartbeat, login page, private bucket metadata endpoint, Mini job-sync heartbeat, free disk, cleanup results and heartbeat, queued jobs without a running worker, and at least three failed jobs in 15 minutes. Long-running books are not classified as stuck based on age alone. This is not an end-to-end audio test or a write/read test of Storage transfers.

The existing Mini job-sync LaunchAgent publishes a private health snapshot every minute. Updated source is in ops/audiobook; deployment of Python is separate from web Git deployment. It reads the queue without altering processing and is installed atomically without restarting API or worker.

Three failing checks open one incident (normally 10–15 minutes after failure); two healthy checks close it (normally 5–10 minutes after recovery). A five-minute check ID suppresses duplicate invocations. SQL row locking serializes state updates. Notification outbox rows survive mail failures and retry next check; Resend idempotency keys suppress duplicate accepted sends within its idempotency window. No periodic incident reminders are sent. Pending mail after a prolonged provider/ack outage may duplicate outside that window.

Database reads, private bucket checks and idempotent monitor-state writes retry once with fresh bounded timeouts. Safe dependency labels, durations and error codes are logged without response bodies, URLs, credentials or customer data. The regular notification queue processes one message per run to stay within the 60-second request budget.

The former once-per-UTC-day database fallback has been removed. An independent Mini LaunchAgent calls `/api/audiobook/monitor/probe` once per five-minute slot using the separate server-only AUDIOBOOK_MONITOR_PROBE_SECRET. The probe verifies a write/read of the private `audiobook_monitor_health` row `reserve-probe`, checks that the ordinary cron state is less than 15 minutes old and detects mail waiting more than 15 minutes. It does not read or modify customer jobs. The database check runs from Vercel, so it detects connectivity trouble on that path even when Mini can reach Supabase.

The Mini stores incident state and its mail outbox atomically on disk with a process lock and fsync, independently of Supabase. Three consecutive failing cycles open an incident; two successful cycles close it. Restarts and midnight do not generate a new incident. Outage and recovery mail go only to Marcus. Failed mail remains pending with the same provider idempotency key. After 23 hours of uncertain delivery, automatic resend stops to avoid duplicates outside Resend's 24-hour window; the regular monitor alerts that manual delivery review is needed. No customer audio process is restarted.

Job-sync publishes the reserve watchdog heartbeat and blocked-mail flag. The ordinary monitor alerts if the enabled watchdog has not run for ten minutes. Thus Mini checks Vercel/its database path, and Vercel checks Mini and its watchdog.

The customer sees a generic incident banner; private diagnostics, counts and email addresses are not exposed. Stale monitoring data is displayed as unknown. New upload reservations are paused when a fresh Mini snapshot shows less than 5 GiB free. Existing transfers and processing retain their own guards and retries. There are no new forced restarts of live audio jobs. Existing launchd KeepAlive restarts crashed services; existing TUS/client and job-sync retry logic remains.

Limitations: simultaneous failure of Mini and Vercel/database can defeat both monitors. Resend failure can delay all email notifications; no second notification provider is configured. Physical deletion still depends on Mini cleanup availability. A public health endpoint is not proof every audio job can succeed.

Validation: six pure health scenarios, four mirror tests, transactional SQL test of duplicate suppression/three failures/one alarm/two successes/one recovery, local authenticated monitor invocation against live services, and one clearly labeled test email accepted by Resend. No service was stopped to test alarms. Build and diff checks passed.

Rollback: set AUDIOBOOK_MONITOR_ENABLED=false in production and redeploy; remove only the Audiobook cron entry if retiring it. Preserve /api/queue/cleanup and existing B2C settings. There is no PodMaster DB or DSP change.


## Cloudflare transport (2026-09-22)

Only AUDIOBOOK_SERVICE_URL changes to `https://audiobook-api.saltwaves.studio`. The named tunnel `saltwaves-audiobook-mini` routes to Mini loopback `http://127.0.0.1:8780`. All job endpoints retain the existing owner-bound token checks; only the minimal health check is public. Uploads/downloads still use private Supabase Storage. PodMaster's port-443 Funnel and environment settings are unchanged; Tailscale remains available for administration.

`studio.saltwaves.audiobook.tunnel` uses launchd RunAtLoad/KeepAlive and cloudflared's reconnect handling. A tunnel-scoped token is stored in `~/Saltwaves-Audiobook/ops/cloudflare/tunnel.token` (0600, directory 0700), never in Git or command-line arguments. Metrics listen only on `127.0.0.1:20246`. cloudflared is updated deliberately via Homebrew, not automatically mid-job.

`studio.saltwaves.audiobook.operations-watchdog` runs every 120 seconds. After three failed public checks, with a healthy local audio service, it may restart **only cloudflared**, at most once per hour. The API, worker, audio jobs and Tailscale are never restarted. The former Audiobook-specific Funnel watchdog is unloaded after cutover so it cannot repeatedly reconnect Tailscale for a retired route.

Installation: deploy the web routes and production env, copy operations_watchdog.py to Mini `ops/`, install the two checked-in LaunchAgent plists in `~/Library/LaunchAgents/`, and update backend/audiobook_job_sync.py atomically. Create the private ops/monitor-probe.token matching the Vercel secret. Run the reserve probe successfully before enabling the watchdog, then create `audiobook-data/operations-watchdog.enabled`. Never copy tokens into source control. The user-session agents rely on the already tested Mini automatic login after reboot.

Rollback: restore the previous AUDIOBOOK_SERVICE_URL and deploy, then restore the previous Funnel watchdog only if that transport is deliberately selected. Do not disable the reserve watchdog without reverting the daily fallback removal or providing replacement monitoring. For a rollback of all monitoring changes, restore both the web commit and Mini scripts together. Retain local incident state and pending mail.

Additional validation: reserve-probe authorization, isolated diagnostic writes, unavailable database, stale cron and delayed mail; persistent incident deduplication across 500 cycles and restarts; recovery; mail retry with stable keys; expired idempotency window; tunnel repair threshold/local-health guard/cooldown. These failure tests use mocks and temporary state, not production outages.
