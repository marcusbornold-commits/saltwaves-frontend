"use client";
import { useEffect, useState } from "react";
import { Shell, Spec, dateSv } from "./ui";
type Book = { id: string; title: string; narrator: string; isbn: string | null; is_test: boolean; created_at: string; expires_at: string | null; chapters: number; approved: number; rejected: number };
const API = "/api/sjoberg-portal";
export default function Library() {
  const [books, setBooks] = useState<Book[] | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(""), [narrator, setNarrator] = useState(""), [isbn, setIsbn] = useState("");
  const load = () => fetch(`${API}/books`).then(r => r.json()).then(d => { if (d.error) throw new Error(d.error); setBooks(d.books); }).catch(e => setError(e.message || "Arkivet kunde inte laddas."));
  useEffect(() => { void load(); }, []);
  // Lagringsvarning: API:t svarar bara för admin-inviten, alla andra får 404 och ser ingenting.
  const [storage, setStorage] = useState<{ bytes: number; limit: number; warn: boolean } | null>(null);
  useEffect(() => { fetch(`${API}/admin/storage`).then(r => r.ok ? r.json() : null).then(d => { if (d && typeof d.bytes === "number") setStorage(d); }).catch(() => {}); }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const r = await fetch(`${API}/books`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, narrator, isbn }) });
    const d = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) { setError(d.error || "Boken kunde inte skapas."); return; }
    location.href = `/tools/audiobook/sjoberg/portal/${d.id}`;
  }
  return <Shell>
    <div className="ab-heading"><div><p className="ab-eyebrow">ARKIV · MASTRA · KONTROLLERA</p><h1>Böcker<span>.</span></h1></div><p>Skapa en bok, ladda upp kapitlen eller låt producenten skicka dem via en egen länk. Allt samlas här, kontrollerat mot Audiobook Nordic.</p></div>
    <section className="ab-workspace"><div className="ab-filebar"><div><span className="ab-eyebrow">01 · NY BOK</span><h2>Skapa en bok</h2></div></div>
      <form className="sp-form" onSubmit={create}>
        <label>Titel<input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="Bokens titel" /></label>
        <label>Inläsare<input maxLength={200} value={narrator} onChange={e => setNarrator(e.target.value)} placeholder="Namn" /></label>
        <label>ISBN (valfritt)<input maxLength={32} value={isbn} onChange={e => setIsbn(e.target.value)} placeholder="978-…" /></label>
        <button className="ab-master" disabled={busy || !title.trim()}>Skapa bok <span>→</span></button>
      </form></section>
    {storage && <p className={storage.warn ? "ab-error" : "sp-small"} role={storage.warn ? "alert" : undefined}>{storage.warn ? "Lagringen närmar sig gränsen: " : "Lagring (bara du ser detta): "}{(storage.bytes / 1e9).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} GB av {storage.limit / 1e9} GB. <a href="/tools/audiobook/sjoberg/portal/aktivitet">Aktivitet →</a></p>}
    {error && <p role="alert" className="ab-error">{error}</p>}
    <section className="ab-next-step"><p className="ab-eyebrow">02 · ARKIV</p><h2>{books?.length ? `${books.length} ${books.length === 1 ? "bok" : "böcker"}` : "Inga böcker ännu."}</h2>
      {!books && !error && <p className="ab-status"><span className="ab-spinner" />Laddar arkivet…</p>}
      <div className="sp-grid">{books?.map(b => <a key={b.id} className="sp-card" href={`/tools/audiobook/sjoberg/portal/${b.id}`}>
        <div><h3>{b.title}{b.is_test && <span className="sp-small"> · TEST</span>}</h3><p>{b.narrator ? `Inläsare: ${b.narrator}` : "Ingen inläsare angiven"}{b.isbn ? ` · ISBN ${b.isbn}` : ""} · skapad {dateSv(b.created_at)}</p></div>
        <div className="sp-pills"><span className="sp-pill">{b.chapters} kapitel</span>{b.approved > 0 && <span className="sp-pill sp-ok">{b.approved} godkända</span>}{b.rejected > 0 && <span className="sp-pill sp-bad">{b.rejected} underkända</span>}{b.expires_at && <span className="sp-pill">Raderas {dateSv(b.expires_at)}</span>}</div></a>)}</div></section>
    <Spec />
    <p className="ab-retention">Masters och godkända filer sparas i 30 dagar efter leverans (första nedladdningen av boken) och raderas sedan automatiskt. Ladda ner det du vill behålla.</p>
  </Shell>;
}
