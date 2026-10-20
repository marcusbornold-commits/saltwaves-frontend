"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { portalTusUpload, ACCEPT } from "@/lib/portal-upload";
import { ConfirmDelete, Shell, Spec, STATUS, dateSv, reason, val, type Check } from "../ui";
type Chapter = { id: string; number: number; name: string; filename: string; source: "sjoberg" | "producer"; status: string; checks: Check[] | null; duration: number | null; error: string | null; stored: boolean };
type Link = { id: string; label: string; expires_at: string; closed_at: string | null; open: boolean };
type Book = { id: string; title: string; narrator: string; isbn: string | null; is_test: boolean; delivered_at: string | null; expires_at: string | null };
type Up = { name: string; sent: number; total: number; error?: string };
const API = "/api/sjoberg-portal";
const mins = (s: number | null) => s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "";

export default function BookView({ id }: { id: string }) {
  const [book, setBook] = useState<Book | null>(null), [chapters, setChapters] = useState<Chapter[]>([]), [links, setLinks] = useState<Link[]>([]);
  const [error, setError] = useState(""), [ups, setUps] = useState<Up[]>([]), [newLink, setNewLink] = useState(""), [label, setLabel] = useState(""), [days, setDays] = useState(14);
  const [del, setDel] = useState<Chapter | "book" | null>(null);
  const input = useRef<HTMLInputElement>(null);
  async function load() {
    const r = await fetch(`${API}/books/${id}`); const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || "Boken kunde inte laddas."); return; }
    setBook(d.book); setChapters(d.chapters); setLinks(d.links);
  }
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const working = chapters.some(c => c.status === "processing") || ups.some(u => !u.error && u.sent < u.total);
  useEffect(() => { if (!working) return; const t = setInterval(() => void load(), 4000); return () => clearInterval(t); }, [working]); // eslint-disable-line react-hooks/exhaustive-deps

  async function upload(files: FileList | File[]) {
    setError("");
    for (const f of Array.from(files)) {
      const i = ups.length; setUps(u => [...u, { name: f.name, sent: 0, total: f.size }]);
      try {
        const path = await portalTusUpload(f, `${API}/books/${id}/tus`, (sent, total) => setUps(u => u.map(x => x.name === f.name ? { ...x, sent, total } : x)));
        const r = await fetch(`${API}/books/${id}/chapters`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path, filename: f.name }) });
        const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Kapitlet kunde inte skapas.");
        setUps(u => u.filter(x => x.name !== f.name)); await load();
      } catch (e) { setUps(u => u.map(x => x.name === f.name ? { ...x, error: (e as Error).message } : x)); }
      void i;
    }
  }
  async function patch(c: Chapter, body: Record<string, unknown>) {
    const r = await fetch(`${API}/chapters/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) setError((await r.json().catch(() => ({}))).error || "Ändringen sparades inte."); await load();
  }
  async function remove(url: string, confirm: string) {
    const r = await fetch(url, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm }) });
    if (!r.ok) return (await r.json().catch(() => ({}))).error || "Raderingen misslyckades.";
  }
  async function makeLink() {
    const r = await fetch(`${API}/books/${id}/links`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label, days }) });
    const d = await r.json().catch(() => ({})); if (!r.ok) { setError(d.error || "Länken kunde inte skapas."); return; }
    setNewLink(location.origin + d.path); setLabel(""); await load();
  }
  async function closeLink(l: Link) { if (!confirm("Stänga länken? Producenten kan då inte ladda upp fler filer.")) return; await fetch(`${API}/links/${l.id}/close`, { method: "POST" }); await load(); }
  const approved = chapters.filter(c => c.status === "approved" && c.stored).length;

  if (!book) return <Shell><div className="ab-heading"><div><p className="ab-eyebrow">BOK</p><h1>…</h1></div></div>{error ? <p role="alert" className="ab-error">{error}</p> : <p className="ab-status"><span className="ab-spinner" />Laddar boken…</p>}</Shell>;
  return <Shell>
    <p className="sp-small"><Link href="/tools/audiobook/sjoberg/portal">← Alla böcker</Link></p>
    <div className="ab-heading"><div><p className="ab-eyebrow">BOK{book.is_test ? " · TEST" : ""}</p><h1>{book.title}<span>.</span></h1></div><p>{book.narrator ? `Inläsare: ${book.narrator}` : "Ingen inläsare angiven"}{book.isbn ? ` · ISBN ${book.isbn}` : ""}<br />{chapters.length} kapitel · {approved} godkända{book.expires_at ? ` · filerna raderas ${dateSv(book.expires_at)}` : ""}</p></div>

    <section className="ab-workspace"><div className="ab-filebar"><div><span className="ab-eyebrow">01 · LADDA UPP KAPITEL</span><h2>Sjöbergs egna inspelningar</h2></div><button className="ab-secondary" onClick={() => input.current?.click()}>Välj filer</button></div>
      <input ref={input} hidden multiple type="file" accept={ACCEPT} onChange={e => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
      <div className="ab-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}><div className="ab-drop-icon">↑</div><p>Dra kapitelfilerna hit</p><span>Varje fil blir ett kapitel och mastras automatiskt mot Audiobook Nordic.<br />Kapitelnumret läses från filnamnet, till exempel ”Kapitel 03.wav”. WAV, MP3, M4A, AIFF eller FLAC, högst 1 000 MB per fil.</span></div>
      {ups.map(u => <div key={u.name} className="sp-grid" style={{ marginTop: 10 }}><div className="sp-row"><strong>{u.name}</strong><span className="sp-small">{u.error ? "" : u.sent < u.total ? `Laddar upp ${Math.round(u.sent / u.total * 100)} %` : "Läser in…"}</span></div>{u.error ? <p className="ab-error">{u.error}</p> : <div className="sp-progress"><span style={{ width: `${u.sent / u.total * 100}%` }} /></div>}</div>)}
      <p className="sp-small">Vill du lyssna innan? <a href="/tools/audiobook/sjoberg/prov">Provmastra ett utdrag</a> först. Det är valfritt.</p>
    </section>
    {error && <p role="alert" className="ab-error">{error}</p>}

    <section className="ab-result"><div><p className="ab-eyebrow">02 · KAPITEL</p><h2>{chapters.length ? "Kapitellista" : "Inga kapitel ännu."}</h2><p>Grönt betyder att kapitlet klarar specen. Rött visar vilken punkt som inte klaras och varför.</p></div>
      {chapters.length > 0 && <div className="ab-report-table"><table className="sp-table"><thead><tr><th>Nr</th><th>Kapitel</th><th>Källa</th><th>Status</th><th>Spec</th><th /></tr></thead><tbody>{chapters.map(c => { const [st0, cls] = STATUS[c.status] || [c.status, ""]; const st = c.status === "processing" ? (c.source === "producer" ? "Mäts…" : "Mastrar…") : st0; return <tr key={c.id}>
        <td><input className="sp-name" style={{ width: 64 }} aria-label="Kapitelnummer" type="number" min={0} max={9999} defaultValue={c.number} onBlur={e => { const n = Number(e.target.value); if (n !== c.number) void patch(c, { number: n }); }} /></td>
        <td><input className="sp-name" aria-label="Kapitelnamn" maxLength={200} defaultValue={c.name} onBlur={e => { const n = e.target.value.trim(); if (n && n !== c.name) void patch(c, { name: n }); }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} /><div className="sp-small">{c.filename}{c.duration ? ` · ${mins(c.duration)}` : ""}</div></td>
        <td>{c.source === "producer" ? "Producent" : "Sjöberg"}<div className="sp-small">{c.source === "producer" ? "mäts, mastras inte" : "mastras"}</div></td>
        <td><span className={`sp-pill ${cls}`}>{c.status === "processing" && <span className="ab-spinner" />}{st}</span>{c.error && <div className="sp-small sp-bad">{c.error}</div>}</td>
        <td>{c.checks ? <ul className="sp-checks">{c.checks.map(k => <li key={k.id} className={k.pass ? "sp-ok" : "sp-bad"} title={k.pass ? "" : reason(k)}><span className="sp-dot" /><span>{k.pass ? `${k.label} ${val(k)}` : reason(k).replace(/^./, s => s.toUpperCase())}</span></li>)}</ul> : <span className="sp-small">—</span>}</td>
        <td className="sp-row">{c.stored && <a className="sp-small" href={`${API}/chapters/${c.id}/audio`} target="_blank" rel="noreferrer">Lyssna</a>}{c.status !== "processing" && <button className="ab-secondary" onClick={() => setDel(c)}>Ta bort</button>}</td></tr>; })}</tbody></table></div>}
      <div className="ab-downloads"><a className="ab-master" aria-disabled={!approved} href={approved ? `${API}/books/${id}/zip` : undefined} onClick={() => setTimeout(() => void load(), 1500)}>Ladda ner hela boken (zip) <span>↓</span></a><a className="ab-secondary" href={`${API}/books/${id}/rapport.csv`}>Mätrapport (CSV)</a></div>
      <p className="sp-small">Zip-filen innehåller alla godkända kapitel, namngivna som Titel_01_Kapitelnamn.wav, och mätrapporten.</p>
    </section>

    <section className="ab-next-step"><p className="ab-eyebrow">03 · EXTERNA PRODUCENTER</p><h2>Uppladdningslänk</h2><p>Skapa en länk och skicka den till producenten. Producenten behöver inget konto och kan bara ladda upp till den här boken, inte lyssna eller ladda ner. Filerna ska vara färdigmastrade; de mastras inte utan mäts mot specen.</p>
      <div className="sp-form" style={{ gridTemplateColumns: "2fr 1fr auto" }}><label>Mottagare (för er egen skull)<input maxLength={120} value={label} onChange={e => setLabel(e.target.value)} placeholder="Till exempel producentens namn" /></label>
        <label>Giltig i<select className="sp-name" style={{ borderColor: "currentColor" }} value={days} onChange={e => setDays(Number(e.target.value))}>{[7, 14, 30].map(d => <option key={d} value={d}>{d} dagar</option>)}</select></label>
        <button className="ab-master" onClick={() => void makeLink()}>Skapa länk <span>+</span></button></div>
      {newLink && <div className="sp-grid" style={{ marginTop: 12 }}><p className="ab-info">Kopiera länken nu. Av säkerhetsskäl visas den bara en gång.</p><div className="sp-row"><code className="sp-new">{newLink}</code><button className="ab-secondary" onClick={() => void navigator.clipboard?.writeText(newLink)}>Kopiera</button></div></div>}
      {links.length > 0 && <div className="sp-links" style={{ marginTop: 14 }}>{links.map(l => <div key={l.id} className="sp-link"><div><strong>{l.label || "Producentlänk"}</strong><div className="sp-small">{l.closed_at ? `Stängd ${dateSv(l.closed_at)}` : l.open ? `Öppen till ${dateSv(l.expires_at)}` : `Gick ut ${dateSv(l.expires_at)}`}</div></div>{l.open ? <button className="ab-secondary" onClick={() => void closeLink(l)}>Stäng länken</button> : <span className={`sp-pill ${l.closed_at ? "sp-bad" : "sp-wait"}`}>{l.closed_at ? "Stängd" : "Utgången"}</span>}</div>)}</div>}
    </section>
    <section className="sp-dangerzone"><p className="ab-eyebrow sp-bad">TA BORT BOKEN</p><p className="sp-small">Raderar boken, alla kapitel och filer samt uppladdningslänkarna permanent.</p><button className="ab-secondary" disabled={chapters.some(c => c.status === "processing")} onClick={() => setDel("book")}>Ta bort boken</button></section>
    {del === "book" && <ConfirmDelete title={`Ta bort ”${book.title}”?`} what={`Boken, ${chapters.length} kapitel med alla filer och uppladdningslänkarna raderas.`} expect={book.title} onCancel={() => setDel(null)} onConfirm={async t => { const e = await remove(`${API}/books/${id}`, t); if (e) return e; location.href = "/tools/audiobook/sjoberg/portal"; }} />}
    {del && del !== "book" && <ConfirmDelete title={`Ta bort kapitel ${del.number}?`} what={`Kapitel ${del.number} – ${del.name} och dess fil raderas.`} expect={del.name} alt={String(del.number)} onCancel={() => setDel(null)} onConfirm={async t => { const e = await remove(`${API}/chapters/${del.id}`, t); if (e) return e; setDel(null); await load(); }} />}
    <Spec />
    <p className="ab-retention">Masters och godkända filer sparas i 30 dagar efter leverans (första nedladdningen av boken) och raderas sedan automatiskt. Underkända producentfiler sparas inte.</p>
  </Shell>;
}
