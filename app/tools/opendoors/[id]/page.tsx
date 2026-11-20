'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import OpenDoorsAb, { type AbAnalysis } from '../OpenDoorsAb';
import { clampEq, defaultPans, panLabel, type Eq } from '@/lib/opendoors-eq';
import { EqSection, PanControl } from '../MixControls';

type Track = { id: string; name: string; original_filename: string; mic_type: string; is_room: boolean };
type Stem = { index: number; name: string; url: string | null };
type Files = { master_wav?: string | null; master_mp3?: string | null; raw_wav?: string | null; raw_mp3?: string | null; stems?: Stem[] };
type Settings = { eq?: Eq; pans?: number[] };
type Episode = {
  id: string; title: string; show_name: string; status: string; error: string | null;
  created_at: string; delivered_at: string | null; expires_at: string | null;
  analysis?: (AbAnalysis & { settings?: Settings }) | null; tracks?: Track[]; files?: Files;
};

const LABELS: Record<string, string> = {
  draft: 'Utkast', uploading: 'Laddar upp', processing: 'Mastras', done: 'Klar', failed: 'Fel',
};
const MIC: Record<string, string> = { dynamic: 'Dynamisk', condenser: 'Kondensator', headset: 'Headset' };

export default function EpisodePage() {
  const params = useParams<{ id: string }>();
  const [ep, setEp] = useState<Episode | null>(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const r = await fetch(`/api/opendoors/episodes/${params.id}`, { credentials: 'same-origin' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Kunde inte hämta avsnittet.');
        if (!stop) setEp(d);
        if (d.status === 'processing' || d.status === 'uploading') setTimeout(load, 4000);
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : 'Något gick fel.');
      }
    }
    void load();
    return () => { stop = true; };
  }, [params.id, tick]);

  if (error) return <main className="od"><div className="od-wrap"><p className="od-error">{error}</p><Link href="/tools/opendoors">Tillbaka</Link></div></main>;
  if (!ep) return <main className="od"><div className="od-wrap"><p>Laddar…</p></div></main>;

  const rawUrl = ep.files?.raw_mp3 || ep.files?.raw_wav || '';
  const masterUrl = ep.files?.master_mp3 || ep.files?.master_wav || '';

  return (
    <main className="od">
      <div className="od-wrap">
        <div className="od-nav"><Link href="/tools/opendoors">← Avsnitt</Link></div>
        <p className="od-eye">Open Doors · {ep.show_name}</p>
        <h1>{ep.title}</h1>
        <p className={`od-status ${ep.status}`}>{LABELS[ep.status] || ep.status}</p>
        {ep.status === 'processing' && <p className="lead">Avsnittet mastras nu. Sidan uppdateras automatiskt. Det kan ta en stund om spåren är långa.</p>}
        {ep.status === 'failed' && <p className="od-error">{ep.error || 'Bearbetningen kunde inte slutföras. Försök igen med samma filer.'}</p>}
        {ep.tracks && ep.tracks.length > 0 && (
          <div className="od-card">
            <strong>Spår</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {ep.tracks.map(t => (
                <li key={t.id}>{t.name} · {MIC[t.mic_type] || t.mic_type} · {t.original_filename}{ep.status === 'done' && ep.analysis?.settings?.pans && ep.analysis.settings.pans.length === ep.tracks!.length ? ` · ${panLabel(ep.analysis.settings.pans[ep.tracks!.indexOf(t)])}` : ''}</li>
              ))}
            </ul>
          </div>
        )}
        {ep.status === 'done' && (
          <>
            <div className="od-dl">
              {ep.files?.master_wav && <a className="od-btn od-btn-orange" href={ep.files.master_wav}>Ladda ner WAV (24-bit)</a>}
              {ep.files?.master_mp3 && <a className="od-btn" href={ep.files.master_mp3}>Ladda ner MP3 320 kbps</a>}
            </div>
            {ep.expires_at && <p className="od-muted">Filerna finns kvar till {new Date(ep.expires_at).toLocaleDateString('sv-SE')} (30 dagar efter leverans).</p>}
            {ep.files?.stems && ep.files.stems.length > 0 && (
              <div className="od-stems">
                <h2>Spåren för sig</h2>
                <p className="od-muted">Varje spår renat och EQ:at, men inte mixat eller panorerat (WAV, 24-bit). Nivån är densamma som i mastern, så du kan mixa själv om du vill.</p>
                <div className="od-dl">
                  {ep.files.stems.filter(s => s.url).map(s => <a key={s.index} className="od-btn" href={s.url!}>Ladda ner {s.name}</a>)}
                </div>
              </div>
            )}
            {rawUrl && masterUrl && <OpenDoorsAb rawUrl={rawUrl} masterUrl={masterUrl} analysis={ep.analysis} />}
            {ep.tracks && ep.tracks.length > 0 && <RemixPanel ep={ep} onStarted={() => { setEp(e => e ? { ...e, status: 'processing' } : e); setTick(t => t + 1); }} />}
          </>
        )}
      </div>
    </main>
  );
}

// "Mastra om": förifylld med inställningarna som användes senast. Monteras om (och förifylls om) när avsnittet blir klart igen.
function RemixPanel({ ep, onStarted }: { ep: Episode; onStarted: () => void }) {
  const tracks = ep.tracks || [];
  const saved = ep.analysis?.settings;
  const [eq, setEq] = useState<Eq>(() => clampEq(saved?.eq));
  const [pans, setPans] = useState<number[]>(() => saved?.pans && saved.pans.length === tracks.length ? saved.pans : defaultPans(tracks.length));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remix() {
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/opendoors/episodes/${ep.id}/start`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eq: clampEq(eq), pans }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Kunde inte starta om mastringen.');
      onStarted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel.');
      setBusy(false);
    }
  }
  return (
    <div className="od-remix">
      <h2>Mastra om med andra inställningar</h2>
      <p className="od-muted">Ändra EQ eller panorering och mastra samma filer igen. Du behöver inte ladda upp något på nytt. De nya filerna ersätter de gamla.</p>
      {error && <p className="od-error">{error}</p>}
      {tracks.map((t, i) => (
        <div key={t.id} className="od-card od-track" style={{ gridTemplateColumns: '1fr' }}>
          <PanControl value={pans[i] ?? 0} onChange={v => setPans(p => p.map((x, k) => k === i ? v : x))} disabled={busy} label={`Panorering för ${t.name}`} />
        </div>
      ))}
      <EqSection eq={eq} onChange={setEq} />
      <button type="button" className="od-btn od-btn-orange" disabled={busy} onClick={remix}>{busy ? 'Startar…' : 'Mastra om'}</button>
    </div>
  );
}
