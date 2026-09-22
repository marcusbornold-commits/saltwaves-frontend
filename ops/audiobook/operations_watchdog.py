"""Independent, disk-backed operational watchdog. Never touches audio jobs or Tailscale."""
import fcntl
import json
import os
from pathlib import Path
import subprocess
import time
import uuid

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'audiobook-data'
PROBE_URL = 'https://app.saltwaves.studio/api/audiobook/monitor/probe'
PUBLIC_HEALTH = 'https://audiobook-api.saltwaves.studio/health'
TUNNEL_LABEL = 'studio.saltwaves.audiobook.tunnel'
REASONS = {
    'database_unavailable': 'Övervakningen kan inte läsa och skriva i Audiobooks databas från webbservern.',
    'cron_stale': 'Den ordinarie driftkontrollen har inte sparat aktuella resultat på över 15 minuter.',
    'notification_delivery_stalled': 'Den ordinarie övervakningen har driftmejl som inte har kunnat kvitteras på över 15 minuter.',
    'monitor_disabled': 'Den ordinarie driftövervakningen är avstängd.',
    'unauthorized': 'Reservövervakningens behörighet behöver kontrolleras.',
    'wrong_project': 'Övervakningens databasinställning behöver kontrolleras.',
    'web_unreachable': 'Webbserverns kontroll av driftövervakningen kunde inte nås eller gav ett oväntat svar.',
}


def save(path, state):
    temporary = path.with_suffix('.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as output:
        json.dump(state, output, allow_nan=False)
        output.flush()
        os.fsync(output.fileno())
    os.replace(temporary, path)
    directory = os.open(path.parent, os.O_RDONLY)
    try: os.fsync(directory)
    finally: os.close(directory)


def observe(state, ok, reason, cycle, now):
    """One observation per five-minute cycle, including across restarts and midnight."""
    if cycle <= state.get('last_cycle', -1):
        return
    state['last_cycle'] = cycle
    state['checked_at'] = now
    state['last_reason'] = None if ok else reason
    state['successes'] = min(2, state.get('successes', 0) + 1) if ok else 0
    state['failures'] = 0 if ok else min(3, state.get('failures', 0) + 1)
    outbox = state.setdefault('outbox', [])
    if not ok and state['failures'] >= 3 and not state.get('incident'):
        incident = str(uuid.uuid4())
        state['incident'] = incident
        outbox.append({'id': incident + '-outage', 'kind': 'outage', 'reason': reason, 'created': now})
    elif ok and state['successes'] >= 2 and state.get('incident'):
        outbox.append({'id': state['incident'] + '-recovery', 'kind': 'recovery', 'created': now})
        state['incident'] = None


def probe(token, get=requests.get):
    reason = 'web_unreachable'
    for _ in range(2):
        try:
            response = get(PROBE_URL, headers={'Authorization': 'Bearer ' + token}, timeout=35, allow_redirects=False)
            body = response.json()
            if response.status_code == 200 and body.get('ok') is True:
                return True, None
            reason = body.get('error') if body.get('error') in REASONS else 'web_unreachable'
        except (requests.RequestException, ValueError, AttributeError):
            reason = 'web_unreachable'
    return False, reason


def public_ok(get=requests.get):
    for _ in range(2):
        try:
            r = get(PUBLIC_HEALTH, timeout=8, allow_redirects=False)
            if r.status_code == 200 and r.json().get('ok') is True:
                return True
        except (requests.RequestException, ValueError, AttributeError):
            pass
    return False


def tunnel_repair_needed(state, healthy, local_healthy, now):
    state['tunnel_failures'] = 0 if healthy else min(3, state.get('tunnel_failures', 0) + 1)
    return (not healthy and local_healthy and state['tunnel_failures'] >= 3
            and now - state.get('last_tunnel_restart', 0) >= 3600)


def drain(state, path, token, post=requests.post, clock=time.time):
    # Persist pending events BEFORE the first send, and remove only after accepted delivery.
    # Once a send has an uncertain outcome, never retry beyond Resend's 24h idempotency window.
    # Leave it visibly blocked for inspection instead of risking daily duplicate mail.
    for event in list(state.get('outbox', []))[:2]:
        now = clock()
        if event.get('first_attempt') and now - event['first_attempt'] >= 23 * 3600:
            state['mail_blocked'] = True
            save(path, state)
            print(json.dumps({'event': 'notification_requires_review', 'id': event['id']}), flush=True)
            return
        event.setdefault('first_attempt', now)
        save(path, state)
        recovery = event['kind'] == 'recovery'
        subject = 'Saltwaves: driftövervakningen fungerar igen' if recovery else 'Saltwaves: problem med driftövervakningen'
        text = ('Två kontroller i följd har bekräftat att webbservern åter kan läsa och skriva i Audiobooks databas, '
                'att den ordinarie kontrollen är aktuell och att dess mejlkö inte har fastnat.' if recovery else
                'Tre kontroller i följd har bekräftat ett problem:\n\n' + REASONS.get(event.get('reason'), REASONS['web_unreachable']) +
                '\n\nDetta larm gäller driftövervakningen och bekräftar inte ett mastringsstopp. '
                'Samma incident ger inga dagliga påminnelser. Ett återställningsmejl skickas efter två godkända kontroller. '
                'Pågående ljudjobb startas inte om.')
        try:
            r = post('https://api.resend.com/emails', headers={'Authorization': 'Bearer ' + token,
                     'Idempotency-Key': 'audiobook-reserve-' + event['id']},
                     json={'from': 'Saltwaves drift <login@send.saltwaves.studio>', 'to': ['marcus@saltwaves.studio'],
                           'subject': subject, 'text': text}, timeout=10, allow_redirects=False)
            if not r.ok:
                print(json.dumps({'event': 'notification_pending', 'status': r.status_code}), flush=True)
                return
        except requests.RequestException:
            print(json.dumps({'event': 'notification_pending', 'error': 'network'}), flush=True)
            return
        state['outbox'].remove(event)
        state['mail_blocked'] = False
        save(path, state)


def run():
    DATA.mkdir(exist_ok=True)
    with (DATA / 'operations-watchdog.lock').open('w') as lock:
        try: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: return
        path = DATA / 'operations-watchdog.json'
        state = json.loads(path.read_text()) if path.exists() else {}
        token = (ROOT / 'ops/monitor-probe.token').read_text().strip()
        if len(token) < 32: raise ValueError('monitor configuration')
        load_dotenv(Path.home() / 'PodMaster/.env')
        mail_token = os.environ.get('RESEND_API_KEY', '')
        if not mail_token: raise ValueError('mail configuration')
        now = time.time()
        cycle = int(now // 300)
        if cycle > state.get('last_cycle', -1):
            ok, reason = probe(token)
            observe(state, ok, reason, cycle, time.time())
            save(path, state)
        healthy = public_ok()
        local_healthy = False
        if not healthy:
            try:
                r = requests.get('http://127.0.0.1:8780/health', timeout=3)
                local_healthy = r.status_code == 200 and r.json().get('ok') is True
            except (requests.RequestException, ValueError, AttributeError): pass
        now = time.time()
        state['tunnel_ok'] = healthy
        if tunnel_repair_needed(state, healthy, local_healthy, now):
            # Persist cooldown before action. Only the transport is restarted; never API/worker/Tailscale.
            state['last_tunnel_restart'] = now
            save(path, state)
            result = subprocess.run(['/bin/launchctl', 'kickstart', '-k', f'gui/{os.getuid()}/{TUNNEL_LABEL}'],
                                    capture_output=True, timeout=15)
            state['tunnel_restart_ok'] = result.returncode == 0
        save(path, state)
        drain(state, path, mail_token)
        (DATA / 'operations-watchdog-heartbeat').touch()
        print(json.dumps({'checked_at': state.get('checked_at'), 'incident': state.get('incident'),
                          'reason': state.get('last_reason'), 'tunnel_ok': healthy,
                          'pending_notifications': len(state.get('outbox', []))}), flush=True)


if __name__ == '__main__':
    try: run()
    except Exception as error:
        print('Operations watchdog failed: ' + type(error).__name__, flush=True)
        raise SystemExit(1)
