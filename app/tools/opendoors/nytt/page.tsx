'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { opendoorsTusUpload } from '@/lib/opendoors-upload';

type TrackDraft = { id: string; name: string; mic: 'dynamic' | 'condenser' | 'headset'; file: File | null; progress: number; error: string };

const newTrack = (): TrackDraft => ({ id: Math.random().toString(36).slice(2), name: '', mic: 'dynamic', file: null, progress: 0, error: '' });

export default function NewEpisodePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [tracks, setTracks] = useState<TrackDraft[]>([newTrack(), newTrack()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (id: string, patch: Partial<TrackDraft>) => setTracks(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const ready = tracks.filter(t => t.file);
    if (!title.trim()) { setError('Ange en titel för avsnittet.'); return; }
    if (ready.length < 2) { setError('Ladda upp minst två spår, ett per mikrofon eller talare.'); return; }
    for (const t of ready) {
      if (!t.name.trim()) { setError('Ge varje spår ett namn, till exempel talarens namn.'); return; }
    }
    setBusy(true);
    try {
      const created = await j<{ id: string }>('/api/opendoors/episodes', { method: 'POST', body: JSON.stringify({ title: title.trim(), show_name: 'Motljus' }) });
      const api = `/api/opendoors/episodes/${created.id}`;
      for (const t of ready) {
        update(t.id, { error: '', progress: 0 });
        const up = await opendoorsTusUpload(t.file!, api, (sent, total) => update(t.id, { progress: total ? sent / total : 0 }));
        await j(`${api}/tracks`, { method: 'POST', body: JSON.stringify({ path: up.path, filename: t.file!.name, name: t.name.trim(), mic_type: t.mic }) });
        update(t.id, { progress: 1 });
      }
      await j(`${api}/start`, { method: 'POST', body: '{}' });
      router.replace(`/tools/opendoors/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel. Försök igen.');
      setBusy(false);
    }
  }

  return (
    <main className="od">
      <div className="od-wrap">
        <div className="od-nav"><Link href="/tools/opendoors">← Avsnitt</Link></div>
        <p className="od-eye">Open Doors · Motljus</p>
        <h1>Nytt avsnitt</h1>
        <p className="lead">Ett spår per mikrofon eller talare. Vi mixar ihop dem och mastrar avsnittet. Du får en länk tillbaka hit när det är klart.</p>
        {error && <p className="od-error">{error}</p>}
        <form onSubmit={submit}>
          <div className="od-field">
            <label htmlFor="title">Titel</label>
            <input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Till exempel Nordkorea bakom kulisserna" disabled={busy} />
          </div>
          <h2 style={{ fontSize: 18, margin: '8px 0 12px' }}>Spår</h2>
          {tracks.map((t, i) => (
            <div key={t.id} className="od-card od-track">
              <div className="od-field" style={{ margin: 0 }}>
                <label>Namn / talare</label>
                <input value={t.name} onChange={e => update(t.id, { name: e.target.value })} placeholder={i === 0 ? 'Till exempel Sara' : 'Till exempel gäst'} disabled={busy} />
              </div>
              <div className="od-field" style={{ margin: 0 }}>
                <label>Mikrofon</label>
                <select value={t.mic} onChange={e => update(t.id, { mic: e.target.value as TrackDraft['mic'] })} disabled={busy}>
                  <option value="dynamic">Dynamisk</option>
                  <option value="condenser">Kondensator</option>
                  <option value="headset">Headset</option>
                </select>
              </div>
              <div className="od-field" style={{ margin: 0 }}>
                <label>Ljudfil</label>
                <input type="file" accept="audio/*,.wav,.mp3,.m4a,.flac" disabled={busy} onChange={e => update(t.id, { file: e.target.files?.[0] || null, progress: 0 })} />
                {t.file && <div className="od-muted">{t.file.name}</div>}
                {t.progress > 0 && t.progress < 1 && <div className="od-progress"><i style={{ width: `${Math.round(t.progress * 100)}%` }} /></div>}
              </div>
            </div>
          ))}
          <p>
            <button type="button" className="od-btn od-btn-ghost" disabled={busy} onClick={() => setTracks(ts => [...ts, newTrack()])}>Lägg till spår</button>
          </p>
          <p>
            <button type="submit" className="od-btn od-btn-orange" disabled={busy}>{busy ? 'Laddar upp…' : 'Ladda upp och mastra'}</button>
          </p>
        </form>
      </div>
    </main>
  );
}

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: 'same-origin', headers: { 'content-type': 'application/json', ...(init?.headers || {}) }, ...init });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Något gick fel. Försök igen.');
  return d as T;
}
