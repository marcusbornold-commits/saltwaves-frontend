// Aktivitetslogg, bara för admin-inviten (SJOBERG_ADMIN_INVITE, standard sjoberg-marcus). Alla andra får 404.
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdmin, storageBytes } from "@/lib/sjoberg-events";
import { Shell } from "../ui";
import "../../../audiobook.css"; import "../../sjoberg.css"; import "../portal.css";
export const dynamic = "force-dynamic";
const LABEL: Record<string, string> = { login: "Inloggning", upload: "Uppladdning", master_start: "Mastring startad", chapter_saved: "Kapitel sparat", download_zip: "Zip nedladdad", report: "Mätrapport", delete: "Radering", producer_upload: "Producentuppladdning" };
export default async function Page() {
  if (!isAdmin({ cookies: await cookies() })) notFound();
  const url = process.env.AUDIOBOOK_STORAGE_URL!, key = process.env.AUDIOBOOK_STORAGE_SERVICE_ROLE_KEY!;
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: ev }, { data: books }, bytes] = await Promise.all([
    db.from("sjoberg_events").select("id, at, who, action, book_id, chapter_id, detail").order("at", { ascending: false }).limit(300),
    db.from("sjoberg_books").select("id, title"),
    storageBytes().catch(() => null),
  ]);
  const title = new Map((books || []).map(b => [b.id, b.title]));
  const t = (s: string) => new Date(s).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm", dateStyle: "short", timeStyle: "short" });
  return <Shell badge="SJÖBERG FÖRLAG · AKTIVITET">
    <div className="ab-heading"><div><p className="ab-eyebrow">ENDAST ADMIN</p><h1>Aktivitet<span>.</span></h1></div><p>Senaste 300 händelserna. Lagring totalt: {bytes === null ? "okänd" : `${(bytes / 1e9).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} GB av 100 GB`}.</p></div>
    <div className="ab-report-table"><table className="sp-table"><thead><tr><th>Tid</th><th>Vem</th><th>Händelse</th><th>Bok</th><th>Detaljer</th></tr></thead><tbody>
      {(ev || []).map(e => <tr key={e.id}><td>{t(e.at)}</td><td>{e.who}</td><td>{LABEL[e.action] || e.action}</td><td>{e.book_id ? <a href={`/tools/audiobook/sjoberg/portal/${e.book_id}`}>{title.get(e.book_id) || "(raderad)"}</a> : "—"}</td><td className="sp-small">{e.detail ? Object.entries(e.detail as Record<string, unknown>).map(([k, v]) => `${k}: ${v}`).join(" · ") : ""}</td></tr>)}
    </tbody></table></div>
  </Shell>;
}
