// Studio v1-preview: invite-skydd. Aktivt bara när STUDIO_INVITES_FILE är satt (ops/start-studio.sh).
import { NextRequest, NextResponse } from "next/server";
import { STUDIO_COOKIE, studioInviteFile, verifyStudioInvite } from "@/lib/studio-invite";

const PREVIEW_HOST = "studio-preview.saltwaves.studio";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "100.125.138.87"]);
const OPEN = ["/tools/audiobook/studio/invite", "/tools/audiobook/sjoberg/invite", "/api/studio-invite"];
const PREVIEW_ALLOWED = ["/tools/audiobook/studio", "/tools/audiobook/sjoberg", "/api/audiobook-studio", "/api/studio-invite", "/_next"];
// Exakta statiska filer som studion använder (Wordmark-emblemet + ikoner). Typsnitt (next/font) ligger under /_next/static.
const PREVIEW_ASSETS = new Set(["/assets/emblem-ink.png", "/assets/emblem-paper.png", "/favicon.ico", "/icon.png", "/apple-icon.png"]);

// Sjöberg-invites (scope "sjoberg") når bara Sjöberg-sidan och de API-anrop den gör: uppladdning, master, jobbstatus, masterfilen.
const SJOBERG_PAGE = "/tools/audiobook/sjoberg";
const SJOBERG_API = [/^\/api\/audiobook-studio\/(tus|upload|ingest)$/, /^\/api\/audiobook-studio\/[A-Za-z0-9_-]+\/master$/, /^\/api\/audiobook-studio\/jobs\/[a-f0-9]+$/, /^\/api\/audiobook-studio\/[A-Za-z0-9_-]+\/audio\/master$/];

export function proxy(req: NextRequest) {
  if (!studioInviteFile()) return NextResponse.next();
  const path = req.nextUrl.pathname;
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const viaCloudflare = req.headers.has("cf-connecting-ip") || req.headers.has("cf-ray");
  // Preview-hosten exponerar bara studion.
  if ((host === PREVIEW_HOST || viaCloudflare) && !PREVIEW_ASSETS.has(path) && !PREVIEW_ALLOWED.some(p => path === p || path.startsWith(p + "/")))
    return new NextResponse("Not found", { status: 404, headers: { "cache-control": "no-store" } }); // så Cloudflare inte cachar 404:or
  const sjPage = path === SJOBERG_PAGE || path.startsWith(SJOBERG_PAGE + "/");
  const gated = sjPage || path === "/tools/audiobook/studio" || path.startsWith("/tools/audiobook/studio/") || path.startsWith("/api/audiobook-studio");
  if (!gated || OPEN.some(p => path === p || path.startsWith(p + "/"))) return NextResponse.next();
  // Marcus lokalt / via Tailscale (aldrig via Cloudflare).
  if (!viaCloudflare && LOCAL_HOSTS.has(host)) return NextResponse.next();
  const inv = verifyStudioInvite(req.cookies.get(STUDIO_COOKIE)?.value);
  if (inv?.scope === "studio" && !sjPage) return NextResponse.next();
  if (inv?.scope === "sjoberg" && (sjPage || SJOBERG_API.some(r => r.test(path)))) return NextResponse.next();
  if (path.startsWith("/api/")) return NextResponse.json({ error: "invite required" }, { status: 401 });
  return new NextResponse(
    '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Saltwaves</title><main style="font-family:system-ui;max-width:600px;margin:15vh auto;padding:32px"><h1>Saltwaves</h1><p>Du behöver en inbjudningslänk.</p></main>',
    { status: 401, headers: { "content-type": "text/html; charset=utf-8" } });
}
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
