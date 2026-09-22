export type MiniHealth = {workerAgeSeconds:number|null; diskFreeBytes:number; cleanupAgeSeconds:number|null; cleanupFailed:boolean; queued:number; running:number; oldestQueuedAgeSeconds:number; recentErrors:number; opsWatchdogEnabled?:boolean; opsWatchdogAgeSeconds?:number|null; opsWatchdogMailBlocked?:boolean};
export function healthIssues(health: MiniHealth | null, checkedAt: string | null, now=Date.now()):string[] {
  if (!health || !checkedAt || !Number.isFinite(Date.parse(checkedAt)) || now-Date.parse(checkedAt)>300000) return ['Jobbsynkningen från Mac Mini har inte svarat på över fem minuter.'];
  const issues:string[]=[];
  if(health.workerAgeSeconds===null || health.workerAgeSeconds>60) issues.push('Mastringsprocessens livstecken saknas.');
  if(health.diskFreeBytes<5*1024**3) issues.push('Mac Mini har mindre än 5 GiB ledigt diskutrymme.');
  if(health.cleanupAgeSeconds===null || health.cleanupAgeSeconds>300 || health.cleanupFailed) issues.push('Filrensningen är försenad eller rapporterar fel.');
  if(health.queued>0 && health.running===0 && health.oldestQueuedAgeSeconds>600) issues.push('Jobb väntar i kön utan att någon mastring körs.');
  if(health.opsWatchdogEnabled && (health.opsWatchdogAgeSeconds==null || health.opsWatchdogAgeSeconds>600)) issues.push('Reservövervakningen på Mac Mini har inte skickat livstecken på över tio minuter.');
  if(health.opsWatchdogMailBlocked) issues.push('Ett reservlarm behöver kontrolleras manuellt efter ett långvarigt leveransfel.');
  if(health.recentErrors>=3) issues.push('Minst tre jobb har misslyckats under de senaste 15 minuterna.');
  return issues;
}

export type ServiceAttempt = { ok: boolean; elapsedMs: number; status: number | null; error: string | null };
export type ServiceCheck = { ok: boolean; attempts: ServiceAttempt[] };

// Retry only the read-only probe. Never retry or restart an audio job here.
export async function checkMiniService(url: string, request: typeof fetch = fetch): Promise<ServiceCheck> {
  const attempts: ServiceAttempt[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    let status: number | null = null;
    let error: string | null = null;
    try {
      const response = await request(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      status = response.status;
      if (!response.ok) {
        error = 'http_error';
        await response.body?.cancel();
      } else {
        const body: unknown = await response.json();
        if (!body || typeof body !== 'object' || !('ok' in body) || body.ok !== true) error = 'unhealthy_response';
      }
    } catch (caught) {
      // Fixed categories only: response bodies, URLs and exception messages can contain secrets.
      const name = caught && typeof caught === 'object' && 'name' in caught ? caught.name : '';
      error = name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : name === 'SyntaxError' ? 'invalid_json' : 'network_error';
    }
    attempts.push({ ok: error === null, elapsedMs: Date.now() - started, status, error });
    if (error === null) return { ok: true, attempts };
  }
  return { ok: false, attempts };
}

export function miniServiceIssue(serviceOk: boolean, health: MiniHealth | null, checkedAt: string | null, now = Date.now()): string | null {
  if (serviceOk) return null;
  const age = checkedAt ? now - Date.parse(checkedAt) : NaN;
  const workerAlive = health && Number.isFinite(age) && age >= -60000 && age <= 300000
    && typeof health.workerAgeSeconds === 'number' && Number.isFinite(health.workerAgeSeconds)
    && health.workerAgeSeconds >= 0 && health.workerAgeSeconds <= 60;
  return workerAlive
    ? 'Anslutningen till Mac Minis webbtjänst kunde inte verifieras efter två försök. Mastringsprocessen skickar fortfarande aktuella livstecken; detta bekräftar inte ett mastringsstopp.'
    : 'Mac Minis webbtjänst svarar inte normalt efter två försök och aktuella livstecken från mastringsprocessen saknas.';
}

// Only call with read-only or idempotent operations. Recreate the request/signal each attempt.
export async function retryMonitorOperation<T>(operation: () => PromiseLike<T>, label: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    try { return await operation(); }
    catch (error) {
      const candidate = error && typeof error === 'object' ? error as { code?: unknown; name?: unknown } : {};
      const code = typeof candidate.code === 'string' && /^[A-Z0-9]{3,12}$/.test(candidate.code) ? candidate.code : null;
      const category = candidate.name === 'TimeoutError' || candidate.name === 'AbortError' ? 'timeout' : 'request_failed';
      console.warn('audiobook_monitor_dependency', JSON.stringify({ label, attempt, elapsedMs: Date.now() - started, category, code }));
      if (attempt >= 2) throw error;
    }
  }
}
