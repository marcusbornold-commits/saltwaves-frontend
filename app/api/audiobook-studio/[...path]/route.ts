// Proxy till Saltwaves Studio-tjänsten (backend/studio_service.py). Lokalt: 127.0.0.1:8791.
import { NextRequest } from "next/server";
import { audiobookAccess } from "@/lib/audiobook-access";

export const dynamic = "force-dynamic";
const base = () => process.env.AUDIOBOOK_STUDIO_API_URL || (process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:8791");

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const api = base();
  if (!api) return new Response("Not found", { status: 404 });
  if (process.env.NODE_ENV === "production" || process.env.AUDIOBOOK_REMOTE_DEV === "true") {
    const { allowed } = await audiobookAccess();
    if (!allowed) return new Response("Forbidden", { status: 403 });
  }
  const { path } = await ctx.params;
  const url = `${api}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const init: RequestInit & { duplex?: "half" } = { method: req.method, headers: { "content-type": req.headers.get("content-type") || "application/octet-stream" } };
  if (req.method !== "GET" && req.method !== "HEAD") { init.body = req.body; init.duplex = "half"; }
  const res = await fetch(url, init);
  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-disposition"]) { const v = res.headers.get(h); if (v) headers.set(h, v); }
  return new Response(res.body, { status: res.status, headers });
}
export const GET = forward;
export const POST = forward;
