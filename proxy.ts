// Studio v1-preview: invite-skydd. Aktivt bara när STUDIO_INVITES_FILE är satt (ops/start-studio.sh).
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { STUDIO_COOKIE, studioInviteFile, verifyStudioInvite } from "@/lib/studio-invite";

const PREVIEW_HOST = "studio-preview.saltwaves.studio";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "100.125.138.87"]);
// Producentlänkar (/sjoberg/lamna/<token>) är öppna: token kontrolleras i API:t, som bara kan ta emot uppladdningar.
const OPEN = ["/tools/audiobook/studio/invite", "/tools/audiobook/sjoberg/invite", "/api/studio-invite", "/tools/audiobook/sjoberg/lamna", "/api/sjoberg-lamna", "/api/sjoberg-health"];
const PREVIEW_ALLOWED = ["/tools/audiobook/studio", "/tools/audiobook/sjoberg", "/api/audiobook-sjoberg", "/api/sjoberg-portal", "/api/sjoberg-lamna", "/api/audiobook-studio", "/api/studio-invite", "/_next"];
// Exakta statiska filer som studion använder (Wordmark-emblemet + ikoner). Typsnitt (next/font) ligger under /_next/static.
const PREVIEW_ASSETS = new Set(["/assets/emblem-ink.png", "/assets/emblem-paper.png", "/favicon.ico", "/icon.png", "/apple-icon.png"]);

// Sjöberg-invites (scope "sjoberg") når bara Sjöberg-sidan och dess eget API (/api/audiobook-sjoberg, vitlistade och rensade anrop).
const SJOBERG_PAGE = "/tools/audiobook/sjoberg";
const SJOBERG_API = [/^\/api\/audiobook-sjoberg\//, /^\/api\/sjoberg-portal\//];
// Egen domän för Sjöberg-testet (preview-tunneln → localhost:3092). Där finns bara Sjöberg-sidan, dess invite och API.
const SJOBERG_HOST = "sjoberg.saltwaves.studio";
const SJOBERG_ALLOWED = [SJOBERG_PAGE, "/api/audiobook-sjoberg", "/api/sjoberg-portal", "/api/sjoberg-lamna", "/api/sjoberg-health", "/api/studio-invite", "/_next"];
const notFound = () => new NextResponse("Not found", { status: 404, headers: { "cache-control": "no-store" } }); // så Cloudflare inte cachar 404:or
const under = (path: string, list: string[]) => list.some(p => path === p || path.startsWith(p + "/"));

// Sjöberg-domänen serverar inga JS-chunks från resten av sajten som nämner det interna kedjenamnet.
// Varje chunk kontrolleras en gång (filen läses från bygget) och resultatet cachas; Sjöberg-sidorna laddar aldrig dessa chunks.
const chunkOk = new Map<string, boolean>();
const INTERNAL = new RegExp(["pod", "master"].join(""), "i");
function chunkAllowed(file: string) {
  if (!/^[A-Za-z0-9_.~-]+\.(js|css)$/.test(file)) return true;
  let ok = chunkOk.get(file);
  if (ok === undefined) { try { ok = !INTERNAL.test(readFileSync(join(process.cwd(), ".next/static/chunks", file), "utf8")); } catch { ok = true; } chunkOk.set(file, ok); }
  return ok;
}

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const sjHost = host === SJOBERG_HOST;
  if (path.startsWith("/_next/static/")) return sjHost && path.startsWith("/_next/static/chunks/") && !chunkAllowed(path.slice("/_next/static/chunks/".length)) ? notFound() : NextResponse.next();
  // Sjöberg-domänen: bara Sjöberg-sidan + API + statiska filer; fail-closed om invite-filen saknas.
  if (sjHost && !PREVIEW_ASSETS.has(path) && !under(path, SJOBERG_ALLOWED)) return notFound();
  if (!studioInviteFile()) return sjHost && !PREVIEW_ASSETS.has(path) && !path.startsWith("/_next") ? notFound() : NextResponse.next();
  const viaCloudflare = req.headers.has("cf-connecting-ip") || req.headers.has("cf-ray");
  // Preview-hosten exponerar bara studion.
  if (!sjHost && (host === PREVIEW_HOST || viaCloudflare) && !PREVIEW_ASSETS.has(path) && !under(path, PREVIEW_ALLOWED)) return notFound();
  const sjPage = path === SJOBERG_PAGE || path.startsWith(SJOBERG_PAGE + "/");
  const gated = sjPage || path === "/tools/audiobook/studio" || path.startsWith("/tools/audiobook/studio/") || path.startsWith("/api/audiobook-studio") || path.startsWith("/api/audiobook-sjoberg") || path.startsWith("/api/sjoberg-portal") || path.startsWith("/api/sjoberg-lamna");
  if (!gated || OPEN.some(p => path === p || path.startsWith(p + "/"))) return NextResponse.next();
  // Marcus lokalt / via Tailscale (aldrig via Cloudflare).
  if (!viaCloudflare && LOCAL_HOSTS.has(host)) return NextResponse.next();
  const inv = verifyStudioInvite(req.cookies.get(STUDIO_COOKIE)?.value);
  if (inv?.scope === "studio" && !sjHost && !sjPage && !path.startsWith("/api/audiobook-sjoberg") && !path.startsWith("/api/sjoberg-portal")) return NextResponse.next();
  if (inv?.scope === "sjoberg" && (sjPage || SJOBERG_API.some(r => r.test(path)))) return NextResponse.next();
  if (path.startsWith("/api/")) return NextResponse.json({ error: "invite required" }, { status: 401 });
  return new NextResponse(
    '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Saltwaves</title><main style="font-family:system-ui;max-width:600px;margin:15vh auto;padding:32px"><h1>Saltwaves</h1><p>Du behöver en inbjudningslänk.</p></main>',
    { status: 401, headers: { "content-type": "text/html; charset=utf-8" } });
}
export const config = { matcher: ["/((?!_next/static|_next/image).*)", "/_next/static/chunks/:path*"] };
