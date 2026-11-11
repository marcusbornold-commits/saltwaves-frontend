'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import OpenDoorsAb, { type AbAnalysis } from '../OpenDoorsAb';

type Track = { id: string; name: string; original_filename: string; mic_type: string; is_room: boolean };
type Files = { master_wav?: string | null; master_mp3?: string | null; raw_wav?: string | null; raw_mp3?: string | null };
type Episode = {
  id: string; title: string; show_name: string; status: string; error: string | null;
  created_at: string; delivered_at: string | null; expires_at: string | null;
  analysis?: AbAnalysis | null; tracks?: Track[]; files?: Files;
};

const LABELS: Record<string, string> = {
  draft: 'Utkast', uploading: 'Laddar upp', processing: 'Mastras', done: 'Klar', failed: 'Fel',
};
const MIC: Record<string, string> = { dynamic: 'Dynamisk', condenser: 'Kondensator', headset: 'Headset' };

export default function EpisodePage() {
  const params = useParams<{ id: string }>();
  const [ep, setEp] = useState<Episode | null>(null);
  const [error, setError] = useState('');

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
  }, [params.id]);

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
                <li key={t.id}>{t.name} · {MIC[t.mic_type] || t.mic_type} · {t.original_filename}</li>
              ))}
            </ul>
          </div>
        )}
        {ep.status === 'done' && (
          <>
            <div className="od-dl">
              {ep.files?.master_wav && <a className="od-btn od-btn-orange" href={ep.files.master_wav}>Ladda ner WAV (48 kHz / 24 bit)</a>}
              {ep.files?.master_mp3 && <a className="od-btn" href={ep.files.master_mp3}>Ladda ner MP3 320 kbps</a>}
            </div>
            {ep.expires_at && <p className="od-muted">Filerna finns kvar till {new Date(ep.expires_at).toLocaleDateString('sv-SE')} (30 dagar efter leverans).</p>}
            {rawUrl && masterUrl && <OpenDoorsAb rawUrl={rawUrl} masterUrl={masterUrl} analysis={ep.analysis} />}
          </>
        )}
      </div>
    </main>
  );
}
