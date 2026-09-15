export type MiniHealth = {workerAgeSeconds:number|null; diskFreeBytes:number; cleanupAgeSeconds:number|null; cleanupFailed:boolean; queued:number; running:number; oldestQueuedAgeSeconds:number; recentErrors:number};
export function healthIssues(health: MiniHealth | null, checkedAt: string | null, now=Date.now()):string[] {
  if (!health || !checkedAt || !Number.isFinite(Date.parse(checkedAt)) || now-Date.parse(checkedAt)>300000) return ['Jobbsynkningen från Mac Mini har inte svarat på över fem minuter.'];
  const issues:string[]=[];
  if(health.workerAgeSeconds===null || health.workerAgeSeconds>60) issues.push('Mastringsprocessens livstecken saknas.');
  if(health.diskFreeBytes<5*1024**3) issues.push('Mac Mini har mindre än 5 GiB ledigt diskutrymme.');
  if(health.cleanupAgeSeconds===null || health.cleanupAgeSeconds>300 || health.cleanupFailed) issues.push('Filrensningen är försenad eller rapporterar fel.');
  if(health.queued>0 && health.running===0 && health.oldestQueuedAgeSeconds>600) issues.push('Jobb väntar i kön utan att någon mastring körs.');
  if(health.recentErrors>=3) issues.push('Minst tre jobb har misslyckats under de senaste 15 minuterna.');
  return issues;
}
