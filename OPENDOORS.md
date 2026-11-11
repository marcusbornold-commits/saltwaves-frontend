# Open Doors – privat portal (testkopia på Mac Mini)

Privat ingång för Open Doors / Motljus.

- Publik URL: `https://opendoors.saltwaves.studio` (preview-tunneln → `127.0.0.1:3095`)
- Frontend: worktree `~/saltwaves-frontend-opendoors`, gren `opendoors-v1`, port 3095
- API: worktree `~/PodMaster-studio-chain`, gren `podmaster-studio-chain`, port 8795, kö `opendoors-test`
- Filer och invites: `~/opendoors-test/` (`invites.json` innehåller bara sha256)

Körs av launchd, isolerat från Sjöberg (port 3092) och live-PodMaster. `OPENDOORS_NOTIFY` är av. Cookies är Secure (`OPENDOORS_COOKIE_INSECURE=0`).

Launchd-agenter:

- `studio.saltwaves.opendoors-api`
- `studio.saltwaves.opendoors-worker`
- `studio.saltwaves.opendoors-frontend`

Manuell omstart (rör inte Sjöberg eller preview-tunneln i onödan):

```bash
launchctl kickstart -k gui/$(id -u)/studio.saltwaves.opendoors-api
launchctl kickstart -k gui/$(id -u)/studio.saltwaves.opendoors-worker
# efter next build:
launchctl kickstart -k gui/$(id -u)/studio.saltwaves.opendoors-frontend
```

Skapa en personlig länk (token skrivs bara ut en gång; spara den privat, t.ex. mode 600):

```bash
OPENDOORS_PUBLIC_URL=https://opendoors.saltwaves.studio python3 ~/saltwaves-frontend-opendoors/scripts/opendoors-invite.py create <namn>
```

Kundtexten nämner bara Open Doors, Motljus och Saltwaves.
