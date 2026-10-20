"use client";
import { useEffect, useRef, useState } from "react";
import { portalTusUpload, ACCEPT } from "@/lib/portal-upload";
import { Shell, Spec, dateSv } from "../../portal/ui";
type Info = { title: string; narrator: string; open: boolean; expires: string };
type Up = { name: string; sent: number; total: number; state: "up" | "done" | "error"; error?: string };
export default function Drop({ token }: { token: string }) {
  const api = `/api/sjoberg-lamna/${token}`;
  const [info, setInfo] = useState<Info | null>(null), [error, setError] = useState(""), [ups, setUps] = useState<Up[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { fetch(api).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setInfo(d); }).catch(e => setError(e.message || "Länken finns inte.")); }, [api]);
  async function upload(files: FileList) {
    for (const f of Array.from(files)) {
      setUps(u => [...u, { name: f.name, sent: 0, total: f.size, state: "up" }]);
      const set = (p: Partial<Up>) => setUps(u => u.map(x => x.name === f.name ? { ...x, ...p } : x));
      try {
        const path = await portalTusUpload(f, `${api}/tus`, (sent, total) => set({ sent, total }));
        const r = await fetch(`${api}/klar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path, filename: f.name }) });
        const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Filen kunde inte tas emot.");
        set({ state: "done" });
      } catch (e) { set({ state: "error", error: (e as Error).message }); }
    }
  }
  return <Shell badge="LEVERANS TILL SJÖBERG FÖRLAG" home={`/tools/audiobook/sjoberg/lamna/${token}`}>
    <div className="ab-heading"><div><p className="ab-eyebrow">LEVERERA KAPITEL</p><h1>{info?.title || "Leverans"}<span>.</span></h1></div><p>{info ? <>{info.narrator ? `Inläsare: ${info.narrator}. ` : ""}Ladda upp färdigmastrade kapitel till Sjöberg förlag. Filerna kontrolleras mot leveransspecen och förlaget ser resultatet.</> : ""}</p></div>
    {error && <p role="alert" className="ab-error">{error}</p>}
    {info && !info.open && <p role="alert" className="ab-error">Länken är stängd eller har gått ut. Kontakta förlaget för en ny länk.</p>}
    {info?.open && <section className="ab-workspace"><div className="ab-filebar"><div><span className="ab-eyebrow">LADDA UPP</span><h2>Välj kapitelfiler</h2></div><button className="ab-secondary" onClick={() => input.current?.click()}>Välj filer</button></div>
      <input ref={input} hidden multiple type="file" accept={ACCEPT} onChange={e => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
      <div className="ab-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}><div className="ab-drop-icon">↑</div><p>Dra kapitelfilerna hit</p><span>En fil per kapitel, med kapitelnumret i filnamnet. WAV 44,1 kHz / 16 bit mono rekommenderas, högst 1 000 MB per fil.<br />Uppladdningen är krypterad och går direkt till lagringen. Länken gäller till {dateSv(info.expires)}.</span></div>
      {ups.map(u => <div key={u.name} className="sp-grid" style={{ marginTop: 10 }}><div className="sp-row"><strong>{u.name}</strong><span className={`sp-small ${u.state === "done" ? "sp-ok" : u.state === "error" ? "sp-bad" : ""}`}>{u.state === "done" ? "✓ Mottagen av förlaget" : u.state === "error" ? u.error : u.sent < u.total ? `Laddar upp ${Math.round(u.sent / u.total * 100)} %` : "Tar emot…"}</span></div>{u.state === "up" && <div className="sp-progress"><span style={{ width: `${u.sent / u.total * 100}%` }} /></div>}</div>)}
    </section>}
    <Spec />
    <p className="ab-retention">Du kan bara ladda upp via den här länken. Uppladdade filer kan inte visas, spelas upp eller laddas ner härifrån.</p>
  </Shell>;
}
