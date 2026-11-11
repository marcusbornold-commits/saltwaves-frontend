#!/usr/bin/env python3
"""Open Doors-invites (scope "opendoors"). Usage: opendoors-invite.py create <namn> | list | revoke <namn>
Token (256 bit) visas bara vid create; filen innehåller bara sha256."""
import hashlib, json, os, secrets, sys, datetime
FILE = os.environ.get("OPENDOORS_INVITES_FILE", os.path.expanduser("~/opendoors-test/invites.json"))
BASE = os.environ.get("OPENDOORS_PUBLIC_URL", "http://127.0.0.1:3095")
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
def load():
    try: return json.load(open(FILE))
    except FileNotFoundError: return {"invites": []}
def save(d):
    os.makedirs(os.path.dirname(FILE), exist_ok=True)
    tmp = FILE + ".tmp"
    with os.fdopen(os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w") as f: json.dump(d, f, indent=2)
    os.replace(tmp, FILE)
def main(a):
    d = load(); rows = [i for i in d["invites"] if i.get("scope") == "opendoors"]
    if a[:1] == ["create"] and len(a) == 2:
        n = "opendoors-" + a[1] if not a[1].startswith("opendoors-") else a[1]
        if any(i["name"] == n and not i.get("revoked") for i in d["invites"]):
            sys.exit(f"{n} har redan en aktiv invite (revoke först)")
        t = secrets.token_urlsafe(32)
        d["invites"].append({"name": n, "hash": hashlib.sha256(t.encode()).hexdigest(), "created": now(), "revoked": None, "scope": "opendoors"})
        save(d)
        print(f"{BASE}/tools/opendoors/invite#{t}")
    elif a == ["list"]:
        for i in rows:
            print(f'{i["name"]:28} created {i["created"]}  {"REVOKED " + i["revoked"] if i.get("revoked") else "active"}')
    elif a[:1] == ["revoke"] and len(a) == 2:
        n = "opendoors-" + a[1] if not a[1].startswith("opendoors-") else a[1]; c = 0
        for i in rows:
            if i["name"] == n and not i.get("revoked"):
                i["revoked"] = now(); c += 1
        save(d); print(f"revoked {c}")
    else:
        sys.exit(__doc__)
if __name__ == "__main__":
    main(sys.argv[1:])
