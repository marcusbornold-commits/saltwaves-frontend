#!/usr/bin/env python3
"""Visa Sjöbergs aktivitetslogg (sjoberg_events) i terminalen. Läser Storage-nycklar ur ~/Saltwaves-Audiobook/.env.audiobook.
Användning: python3 scripts/sjoberg-activity.py [antal=50]"""
import json, os, sys, urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo
env = {}
for line in open(os.environ.get("STUDIO_STORAGE_ENV", os.path.expanduser("~/Saltwaves-Audiobook/.env.audiobook"))):
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.rstrip("\n").split("=", 1); env[k.strip()] = v.strip().strip('"')
url, key = env["AUDIOBOOK_STORAGE_URL"].rstrip("/"), env["AUDIOBOOK_STORAGE_SERVICE_ROLE_KEY"]
n = int(sys.argv[1]) if len(sys.argv) > 1 else 50
req = urllib.request.Request(f"{url}/rest/v1/sjoberg_events?select=at,who,action,book_id,chapter_id,detail&order=at.desc&limit={n}", headers={"apikey": key, "Authorization": f"Bearer {key}"})
for e in reversed(json.load(urllib.request.urlopen(req, timeout=15))):
    t = datetime.fromisoformat(e["at"]).astimezone(ZoneInfo("Europe/Stockholm")).strftime("%Y-%m-%d %H:%M")
    print(f'{t}  {e["who"]:<18} {e["action"]:<16} bok={(e["book_id"] or "-")[:8]} kap={(e["chapter_id"] or "-")[:8]} {json.dumps(e["detail"], ensure_ascii=False) if e["detail"] else ""}')
