"use client";
import { useState } from "react";
/* eslint-disable @next/next/no-img-element */
// Egen kopia av Wordmark: saltwaves-ui drar med sig hela uppladdningsklienten för podcastsidan i bundlen.
export function Wordmark({ href }: { href: string }) {
  return <a className="nav-brand" href={href} aria-label="Saltwaves.studio"><img src="/assets/emblem-ink.png" alt="Saltwaves emblem" /><span>saltwaves<span style={{ color: "var(--orange)" }}>.studio</span></span></a>;
}
export type Check = { id: string; label: string; value: number | string | null; unit: string; requirement: string; pass: boolean };
export const sv = (t: string) => t.replace(/(\d)\.(\d)/g, "$1,$2").replace(/-(?=\d)/g, "−");
export const val = (c: Check) => typeof c.value === "number" ? `${sv(c.value.toFixed(1))} ${c.unit}`.trim() : sv(String(c.value ?? "—"));
export const reason = (c: Check) => `${c.label.toLowerCase()} ${val(c)}, krav ${c.requirement}`;
export const STATUS: Record<string, [string, string]> = { uploaded: ["Uppladdad", "sp-wait"], processing: ["Mäts / mastras", "sp-wait"], approved: ["Godkänd", "sp-ok"], rejected: ["Underkänd", "sp-bad"], failed: ["Fel", "sp-bad"] };
export const dateSv = (s: string) => new Date(s).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
export function Shell({ children, badge = "SJÖBERG FÖRLAG · PORTAL", home = "/tools/audiobook/sjoberg/portal" }: { children: React.ReactNode; badge?: string; home?: string }) {
  return <main className="ab-studio" lang="sv"><header className="ab-header"><Wordmark href={home} /><span className="ab-badge">{badge}</span></header>{children}
    <footer className="ab-footer"><span>SALTWAVES STUDIO</span><span>Audiobook Nordic · −17,5 LUFS · ≤ −3 dBTP · ≤ −80 dBFS · 44,1 kHz/16 bit mono</span></footer></main>;
}
export function Spec() {
  return <section className="ab-master-panel sj-spec"><div><p className="ab-eyebrow">LEVERANSSPEC</p><h2>Audiobook Nordic</h2><p>Varje kapitel kontrolleras mot samma fasta spec. Sjöbergs egna filer mastras automatiskt, producenternas filer mäts.</p></div>
    <dl className="sj-specgrid"><div><dt>Ljudnivå</dt><dd>−17,5 LUFS ±0,5</dd></div><div><dt>True peak</dt><dd>≤ −3,0 dBTP</dd></div><div><dt>Brusgolv</dt><dd>≤ −80 dBFS</dd></div><div><dt>Format</dt><dd>44,1 kHz / 16 bit mono</dd></div></dl></section>;
}

// Tvåstegsradering: dialog där man måste skriva namnet exakt innan knappen aktiveras.
export function ConfirmDelete({ title, what, expect, alt, onCancel, onConfirm }: { title: string; what: string; expect: string; alt?: string; onCancel: () => void; onConfirm: (typed: string) => Promise<string | void> }) {
  const [typed, setTyped] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const n = (v: string) => v.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("sv-SE");
  const ok = !!n(typed) && (n(typed) === n(expect) || (alt !== undefined && n(typed) === n(alt)));
  async function go() { setBusy(true); setErr(""); const e = await onConfirm(typed.trim()); if (e) { setErr(e); setBusy(false); } }
  return <div className="sp-modal-bg" role="presentation" onClick={e => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
    <div className="sp-modal" role="dialog" aria-modal="true" aria-labelledby="sp-del-h" onKeyDown={e => { if (e.key === "Escape" && !busy) onCancel(); }}>
      <p className="ab-eyebrow sp-bad">RADERA PERMANENT</p><h2 id="sp-del-h">{title}</h2>
      <p>{what} Det går inte att ångra.</p>
      <label><span>Skriv <strong>{expect}</strong>{alt !== undefined ? <> eller <strong>{alt}</strong></> : null} för att bekräfta</span><input className="sp-name" autoFocus value={typed} onChange={e => setTyped(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && ok && !busy) void go(); }} /></label>
      {err && <p role="alert" className="ab-error">{err}</p>}
      <div className="sp-row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 14 }}><button className="ab-secondary" disabled={busy} onClick={onCancel}>Avbryt</button><button className="sp-danger" disabled={!ok || busy} onClick={() => void go()}>{busy ? "Raderar…" : "Radera permanent"}</button></div>
    </div></div>;
}
