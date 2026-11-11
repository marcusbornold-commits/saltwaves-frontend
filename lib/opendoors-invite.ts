// Invite-skydd för Open Doors. Tokens sparas bara som sha256 i OPENDOORS_INVITES_FILE (utanför git).
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

export const OPENDOORS_COOKIE = "sw_opendoors_invite";
type Invite = { name: string; hash: string; created: string; revoked?: string | null; scope?: string };

export function opendoorsInviteFile(): string | undefined {
  return process.env.OPENDOORS_INVITES_FILE || undefined;
}

export function verifyOpendoorsInvite(token: string | undefined | null): { name: string; scope: "opendoors" } | null {
  const file = opendoorsInviteFile();
  if (!file || !token || token.length < 20 || token.length > 200) return null;
  let invites: Invite[] = [];
  try { invites = JSON.parse(readFileSync(file, "utf8")).invites || []; } catch { return null; }
  const h = createHash("sha256").update(token).digest();
  for (const inv of invites) {
    if (inv.revoked) continue;
    if (inv.scope && inv.scope !== "opendoors") continue;
    const b = Buffer.from(inv.hash || "", "hex");
    if (b.length === h.length && timingSafeEqual(b, h)) return { name: inv.name, scope: "opendoors" };
  }
  return null;
}
