"""One-way private Supabase job/report mirror. Safe to retry; never controls DSP."""
import contextlib
from datetime import datetime, timezone
import fcntl
import hashlib
from html import escape
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import shutil
import time
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env.audiobook')
DATA = Path(os.environ.get('AUDIOBOOK_DATA_DIR', str(ROOT / 'audiobook-data')))
METHOD = ('FFmpeg loudnorm mäter integrerad LUFS, true peak och LRA. Brusgolv uppskattas från '
          'tionde percentilen av RMS-fönster (2048 sampel, steg 512 vid 48 kHz). Signal/brus är '
          'en indikator baserad på LUFS minus brusgolv. Mätvärdena gäller källfilen och eventuell '
          'WAV-master. Tekniska mätvärden ersätter inte lyssningskontroll.')

def timestamp(value):
    return datetime.fromtimestamp(value, timezone.utc).isoformat() if value else None

def number(value):
    return value if isinstance(value, (int, float)) and math.isfinite(value) else None

def measurement(part):
    a = part.get('analysis') or {}
    result = {k: number(a.get(k)) for k in ('integratedLufs', 'truePeakDb', 'lra', 'plr', 'durationSec')}
    result['noiseFloorDb'] = number(part.get('noiseFloorDb'))
    result['signalNoiseDb'] = (result['integratedLufs'] - result['noiseFloorDb']
                             if result['integratedLufs'] is not None and result['noiseFloorDb'] is not None else None)
    return result

def report_for(job):
    media = json.loads(job.get('media') or '{}')
    if job['state'] != 'done' or not media.get('before'): return None
    before = measurement(media['before'])
    after = measurement(media['after']) if media.get('after') else None
    validation = job.get('mode') == 'validate'
    measured = before if validation else (after or {})
    target = job['target']
    rows = []
    for label, key, unit, limit in [('LUFS','integratedLufs','LUFS',target), ('dBTP','truePeakDb','dBTP',-3),
                                   ('LRA','lra','LU',None), ('PLR','plr','dB',None),
                                   ('Brusgolv','noiseFloorDb','dBFS',-60), ('Signal/brus','signalNoiseDb','dB',None)]:
        value = measured.get(key)
        passed = None if limit is None or value is None else (abs(value-target) <= .5 if key == 'integratedLufs' else value <= limit)
        rows.append({'parameter':label, 'before':before.get(key), 'after':after.get(key) if after else None,
                     'unit':unit, 'requirement':f'{target} ± 0,5 LUFS' if key=='integratedLufs' else f'≤ {limit} {unit}' if limit is not None else '—',
                     'outcome':'SAKNAS' if limit is not None and value is None else 'OK' if passed is True else 'UTANFÖR' if passed is False else '—'})
    return {'version':1, 'scope':'Originalfil, enbart kontroll' if validation else 'Provmaster' if job.get('mode')=='preview' else 'Hela filen',
            'before':before, 'after':after, 'rows':rows, 'methodology':METHOD}

def html_report(job, report):
    def fmt(value, unit):
        return '—' if value is None else f'{value:.1f}'.replace('.',',') + ' ' + unit
    rows=''.join('<tr>'+''.join('<td>'+escape(str(v))+'</td>' for v in
                (r['parameter'],fmt(r['before'],r['unit']),fmt(r['after'],r['unit']),r['requirement'],r['outcome']))+'</tr>' for r in report['rows'])
    scope=report['scope']
    if job.get('mode') == 'preview': scope += f" · start {job['preview_start']:g} s · uppmätt längd {report['before'].get('durationSec')} s"
    return ('<!doctype html><html lang="sv"><meta charset="utf-8"><title>Leveransrapport</title>'
            '<style>body{font:16px system-ui;max-width:1000px;margin:48px auto;padding:24px;color:#222}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:14px;border-bottom:1px solid #ddd}p{line-height:1.6}</style>'
            '<h1>'+('Kontrollrapport' if job.get('mode')=='validate' else 'Leveransrapport')+'</h1><p>Fil: '+escape(job['filename'])+
            '<br>Datum (UTC): '+escape(timestamp(job['created']))+'<br>Målspec: Audiobook '+str(job['target'])+' LUFS<br>'+escape(scope)+
            '</p><table><tr><th>Parameter</th><th>Före</th><th>Efter</th><th>Krav</th><th>Utfall</th></tr>'+rows+'</table><p>'+escape(METHOD)+
            '</p><p>Saltwaves Studio · Marcus Bornold · Örebro, Sverige</p></html>')

def record(job, now):
    expired = job['state']=='expired' or job['expires'] <= now
    report = None if expired else report_for(job)
    return {'id':job['id'], 'user_id':None if expired else job['owner'], 'file_name':None if expired else job['filename'],
            'operation':job.get('mode') or 'master','target_lufs':job['target'], 'status':'expired' if expired else job['state'],
            'created_at':timestamp(job['created']), 'updated_at':timestamp(job['updated']), 'expires_at':timestamp(job['expires']),
            'source_job_id':job.get('source_job'), 'file_size_bytes':job.get('expected_size'),
            'preview_start_seconds':job.get('preview_start'), 'preview_duration_seconds':job.get('preview_duration') if job.get('mode')=='preview' else None,
            'error_message':None if expired else job.get('error'), 'report':report,
            'report_storage_path':job['id']+'/leveransrapport.html' if report else None}

def publish_health(jobs, url, headers):
    now=time.time()
    heartbeat=DATA/'worker-heartbeat'
    cleanup=DATA/'cleanup.log'
    cleanup_failed=True
    if cleanup.exists():
        try:
            with cleanup.open('rb') as f:
                f.seek(max(0,cleanup.stat().st_size-8192))
                last=f.read().decode().splitlines()[-1]
            cleanup_failed=bool(json.loads(last).get('failed', ['unknown']))
        except Exception: pass
    active=[j for j in jobs if (j.get('expires') or 0)>now]
    queued=[j for j in active if j['state']=='queued']
    data={'workerAgeSeconds':max(0,now-heartbeat.stat().st_mtime) if heartbeat.exists() else None,
          'diskFreeBytes':shutil.disk_usage(DATA).free,
          'cleanupAgeSeconds':max(0,now-cleanup.stat().st_mtime) if cleanup.exists() else None,
          'cleanupFailed':cleanup_failed,'queued':len(queued),
          'running':sum(j['state']=='running' for j in active),
          'oldestQueuedAgeSeconds':max([now-j['updated'] for j in queued] or [0]),
          'recentErrors':sum(j['state']=='error' and j['updated']>now-900 for j in jobs)}
    response=requests.post(url+'/rest/v1/audiobook_monitor_health?on_conflict=id',headers={**headers,'Prefer':'resolution=merge-duplicates,return=minimal'},
        json={'id':'mini','checked_at':timestamp(now),'data':data},timeout=30)
    response.raise_for_status()

def sync():
    url=os.environ.get('AUDIOBOOK_STORAGE_URL','').rstrip('/')
    key=os.environ.get('AUDIOBOOK_STORAGE_SERVICE_ROLE_KEY','')
    if url != 'https://xuxqrkposxrvhwvwjroc.supabase.co' or not key:
        raise RuntimeError('Dedicated Audiobook project required')
    headers={'apikey':key,'Authorization':'Bearer '+key}
    with (DATA/'job-sync.lock').open('w') as lock:
        try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError: return {'busy':True}
        with contextlib.closing(sqlite3.connect(f'file:{DATA}/jobs.sqlite?mode=ro',uri=True)) as db:
            db.row_factory=sqlite3.Row
            jobs=[dict(r) for r in db.execute('SELECT * FROM jobs')]
        with sqlite3.connect(DATA/'job-sync.sqlite') as cache:
            cache.execute('CREATE TABLE IF NOT EXISTS synced (id TEXT PRIMARY KEY, digest TEXT)')
            changed=0
            for job in jobs:
                if not re.fullmatch('[a-f0-9]{32}',job['id']): continue
                row=record(job,time.time())
                digest=hashlib.sha256(json.dumps(row,sort_keys=True,allow_nan=False).encode()).hexdigest()
                previous=cache.execute('SELECT digest FROM synced WHERE id=?',(job['id'],)).fetchone()
                if previous and previous[0]==digest: continue
                if row['report']:
                    response=requests.post(url+'/storage/v1/object/audiobook-private/'+row['report_storage_path'],
                        headers={**headers,'Content-Type':'text/html; charset=utf-8','x-upsert':'true'},data=html_report(job,row['report']).encode(),timeout=30)
                    response.raise_for_status()
                response=requests.post(url+'/rest/v1/audiobook_jobs?on_conflict=id',headers={**headers,'Prefer':'resolution=merge-duplicates,return=minimal'},json=row,timeout=30)
                response.raise_for_status()
                cache.execute('INSERT OR REPLACE INTO synced VALUES (?,?)',(job['id'],digest));cache.commit();changed+=1
            publish_health(jobs,url,headers)
            return {'synced':changed,'checked':len(jobs)}

if __name__=='__main__':
    try: print(json.dumps(sync()))
    except Exception as exc:
        # No credentials or customer metadata in diagnostics. Retry next launchd interval.
        print('Job sync failed: '+type(exc).__name__)
        raise SystemExit(1)
