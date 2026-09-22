import { randomUUID, timingSafeEqual } from 'node:crypto';
import { audiobookStorageUrl, getAudiobookStorage } from '@/lib/audiobook-storage-admin';
import { retryMonitorOperation } from '@/lib/audiobook-monitor-checks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const headers = { 'Cache-Control': 'private, no-store' };

// Independent Mini -> Vercel -> Supabase probe. Never accepts customer auth tokens.
export async function GET(request: Request) {
  const secret = process.env.AUDIOBOOK_MONITOR_PROBE_SECRET || '';
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(request.headers.get('authorization') || '');
  if (secret.length < 32 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  if (process.env.AUDIOBOOK_MONITOR_ENABLED !== 'true')
    return Response.json({ error: 'monitor_disabled' }, { status: 503, headers });
  if (audiobookStorageUrl().url.replace(/\/$/, '') !== 'https://xuxqrkposxrvhwvwjroc.supabase.co')
    return Response.json({ error: 'wrong_project' }, { status: 503, headers });

  const db = getAudiobookStorage();
  const probeId = randomUUID();
  const checkedAt = new Date().toISOString();
  const checks = await Promise.allSettled([
    retryMonitorOperation(async () => {
      // Only a dedicated diagnostic row: no customer files, queues or processing are changed.
      const write = await db.from('audiobook_monitor_health').upsert({ id: 'reserve-probe', checked_at: checkedAt, data: { probeId } })
        .abortSignal(AbortSignal.timeout(4000));
      if (write.error) throw write.error;
      const read = await db.from('audiobook_monitor_health').select('data').eq('id', 'reserve-probe')
        .abortSignal(AbortSignal.timeout(4000)).single();
      if (read.error) throw read.error;
      if (read.data?.data?.probeId !== probeId) throw new Error('readback_failed');
    }, 'reserve_read_write'),
    retryMonitorOperation(() => db.from('audiobook_monitor_state').select('checked_at').eq('id', 'main')
      .abortSignal(AbortSignal.timeout(4000)).maybeSingle().then(r => { if (r.error) throw r.error; return r.data; }), 'reserve_cron_read'),
    retryMonitorOperation(() => db.from('audiobook_monitor_notifications').select('created_at').is('sent_at', null)
      .order('created_at').limit(1).abortSignal(AbortSignal.timeout(4000))
      .then(r => { if (r.error) throw r.error; return r.data; }), 'reserve_outbox_read'),
  ]);
  if (checks.some(check => check.status === 'rejected'))
    return Response.json({ error: 'database_unavailable' }, { status: 503, headers });
  const state = checks[1].status === 'fulfilled' ? checks[1].value : null;
  const at = Date.parse(state?.checked_at || '');
  if (!Number.isFinite(at) || Date.now() - at > 15 * 60000 || at > Date.now() + 60000)
    return Response.json({ error: 'cron_stale' }, { status: 503, headers });
  const outbox = checks[2].status === 'fulfilled' ? checks[2].value : [];
  if (outbox?.length && Date.now() - Date.parse(outbox[0].created_at) > 15 * 60000)
    return Response.json({ error: 'notification_delivery_stalled' }, { status: 503, headers });
  return Response.json({ ok: true, checkedAt }, { headers });
}
