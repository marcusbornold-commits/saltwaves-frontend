'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Episode = { id: string; title: string; show_name: string; status: string; created_at: string; delivered_at: string | null };

const LABELS: Record<string, string> = {
  draft: 'Utkast', uploading: 'Laddar upp', processing: 'Mastras', done: 'Klar', failed: 'Fel',
};

export default function ListPage() {
  const [rows, setRows] = useState<Episode[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/opendoors/episodes', { credentials: 'same-origin' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Kunde inte hämta avsnitten.'); setRows(d.episodes || []); })
      .catch(e => setError(e.message));
  }, []);
  return (
    <main className="od">
      <div className="od-wrap">
        <p className="od-eye">Saltwaves · Open Doors</p>
        <h1>Motljus</h1>
        <p className="lead">Ladda upp ett spår per mikrofon eller talare. Vi mixar dem till ett avsnitt, mastrar det och lägger tillbaka en lyssningsfil och en nedladdning här.</p>
        <div className="od-nav">
          <Link href="/tools/opendoors/nytt" className="od-btn od-btn-orange">Nytt avsnitt</Link>
        </div>
        {error && <p className="od-error">{error}</p>}
        {rows && !rows.length && <p className="od-muted">Inga avsnitt ännu.</p>}
        {rows && rows.length > 0 && (
          <ul className="od-list">
            {rows.map(e => (
              <li key={e.id} className="od-card">
                <Link href={`/tools/opendoors/${e.id}`}>
                  <div className="od-row">
                    <div>
                      <strong>{e.title}</strong>
                      <div className="od-muted">{e.show_name} · {new Date(e.created_at).toLocaleString('sv-SE')}</div>
                    </div>
                    <span className={`od-status ${e.status}`}>{LABELS[e.status] || e.status}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
