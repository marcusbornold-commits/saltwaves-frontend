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

## EQ, panorering och spår (gren `opendoors-pan-eq`)

- Uppladdning: 1 spår eller fler, alla valfria. Namn är valfritt (filnamnet används annars). Ingen tvåfilsgräns längre (gamla gränsen: `tracks.length < 2` i både `nytt/page.tsx` och `start` i API-routen).
- Panorering per spår, -100 (vänster) till +100 (höger), konstant effekt. Standard: 1 spår = mitten, 2 eller fler = jämnt från -50 till +50 (första spåret vänster). Rumsspår (`_room` i filnamnet) panoreras inte.
- EQ: samma 4 band som Earselect-studions EQ, ±3 dB per band, standard platt. Band 2 (200–1000 Hz) täcker 325 Hz. Gäller alla talarspår, före mixen. Klampas på servern (`app/opendoors_eq.py` i PodMaster) och i `lib/opendoors-eq.ts`. Ändra bandens spann på båda ställena.
- Inställningarna går med i `start`-anropet och sparas i `analysis.settings` (ingen ny databaskolumn). "Mastra om" på avsnittssidan startar om samma filer med nya värden.
- Spåren för sig: `stem_NN.wav` (mono, 48 kHz/24-bit, EQ:ade, opanorerade, samma nivå som i mastern) lagras bredvid mastern under `opendoors-portal/<id>/`.
- `OPENDOORS_TENANT` (endast testkopior): byter tenant så testrader inte syns i den riktiga listan. Live sätter den inte.
