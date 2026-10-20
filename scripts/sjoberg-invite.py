#!/usr/bin/env python3
"""Sjöberg-invites (scope "sjoberg": bara /tools/audiobook/sjoberg). Usage: sjoberg-invite.py create <namn> | list | revoke <namn>
Samma fil som ops/invite.py (STUDIO_INVITES_FILE). Token (256 bit) visas bara vid create; filen innehåller bara sha256."""
import hashlib, json, os, secrets, sys, datetime
FILE = os.environ.get("STUDIO_INVITES_FILE", os.path.expanduser("~/Saltwaves-Audiobook-studio/studio-data/invites.json"))
BASE = os.environ.get("SJOBERG_PUBLIC_URL", "https://sjoberg.saltwaves.studio")
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
def load():
    try: return json.load(open(FILE))
    except FileNotFoundError: return {"invites": []}
def save(d):
    tmp = FILE + ".tmp"
    with open(os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w") as f: json.dump(d, f, indent=2)
    os.replace(tmp, FILE)
def main(a):
    d = load(); sj = [i for i in d["invites"] if i.get("scope") == "sjoberg"]
    if a[:1] == ["create"] and len(a) == 2:
        n = "sjoberg-" + a[1] if not a[1].startswith("sjoberg-") else a[1]
        if any(i["name"] == n and not i.get("revoked") for i in d["invites"]): sys.exit(f"{n} har redan en aktiv invite (revoke först)")
        t = secrets.token_urlsafe(32)
        d["invites"].append({"name": n, "hash": hashlib.sha256(t.encode()).hexdigest(), "created": now(), "revoked": None, "scope": "sjoberg"})
        save(d); print(f"{BASE}/tools/audiobook/sjoberg/invite#{t}")
    elif a == ["list"]:
        for i in sj: print(f'{i["name"]:24} created {i["created"]}  {"REVOKED " + i["revoked"] if i.get("revoked") else "active"}')
    elif a[:1] == ["revoke"] and len(a) == 2:
        n = "sjoberg-" + a[1] if not a[1].startswith("sjoberg-") else a[1]; c = 0
        for i in sj:
            if i["name"] == n and not i.get("revoked"): i["revoked"] = now(); c += 1
        save(d); print(f"revoked {c}")
    else: sys.exit(__doc__)
if __name__ == "__main__": main(sys.argv[1:])
