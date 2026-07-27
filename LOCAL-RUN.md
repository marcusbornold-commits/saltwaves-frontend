# Local Run — intern driftpanel

Internt verktyg för att köra PodMaster-kedjan lokalt. **Deployas aldrig** — sidan har `noindex` och länkas inte från navigation.

## Startsekvens

1. **Mac Mini:** `cd ~/PodMaster && python3 runner.py`  
   (`runner.py` hämtas dit med `git pull` — den checkas in i repot)

2. **MacBook:** `ssh -L 8766:127.0.0.1:8766 mac-mini`

3. **MacBook:** `npm run dev` i frontendmappen

4. Öppna **http://localhost:3000/tools/local-run**

## Vad som händer

- Frontend på `localhost:3000` anropar runnern på `127.0.0.1:8766` (via SSH-forward).
- Indata sparas som `~/Saltwaves/Panel/<jobid>/before.<ext>` utan konvertering.
- Kedjan körs: `~/podmaster-env/bin/python -m app.main <input> <mode> <mic> false`
- Output hämtas deterministiskt från `~/PodMaster/output/before_mastered.wav` och flyttas till `~/Saltwaves/Panel/<jobid>/after.wav`.
- Before/after analyseras i browsern med samma motor som `/tools/ab-analyzer`.

## Specs

Målspecar läses från `~/Saltwaves/Panel/specs.json`. Skapas automatiskt med defaults vid första körning om filen saknas.
