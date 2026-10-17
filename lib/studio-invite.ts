// Invite-skydd för Studio v1-preview. Tokens sparas bara som sha256 i STUDIO_INVITES_FILE (utanför git).
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

export const STUDIO_COOKIE = "sw_studio_invite";
type Invite = { name: string; hash: string; created: string; revoked?: string | null };

export function studioInviteFile(): string | undefined { return process.env.STUDIO_INVITES_FILE || undefined; }

export function verifyStudioToken(token: string | undefined | null): string | null {
  const file = studioInviteFile();
  if (!file || !token || token.length < 20 || token.length > 200) return null;
  let invites: Invite[] = [];
  try { invites = JSON.parse(readFileSync(file, "utf8")).invites || []; } catch { return null; }
  const h = createHash("sha256").update(token).digest();
  for (const inv of invites) {
    if (inv.revoked) continue;
    const b = Buffer.from(inv.hash || "", "hex");
    if (b.length === h.length && timingSafeEqual(b, h)) return inv.name;
  }
  return null;
}
