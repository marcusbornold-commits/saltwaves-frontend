# Local Run — intern ljudpanel

Verifierat mot startskript och runner 2026-09-08. Sidan finns i webbprojektet, har `noindex` och länkas inte i navigationen. `noindex` är ingen åtkomstkontroll och innebär inte att sidan utesluts ur ett produktionsbygge.

## Alternativ 1: helt på MacBook

Använd det befintliga skriptet:
`/Users/marcusbornold/Documents/PRODUCTION/SaltWavesStudio/codtraning/LocalRun-MacBook.command`.

Det arbetar i `~/PodMaster`, stänger eventuell äldre tunnel på 8766, startar frontend vid behov och öppnar `http://localhost:3000/tools/local-run`. Det kör därefter lokal `.venv/bin/python runner.py` med `PODMASTER_PYTHON` satt till samma lokala miljö.

Förutsätter fungerande lokal Pythonmiljö, modell och installerade frontendberoenden. Vid överlämningen saknades `node_modules`; kör `npm ci` i frontendmappen när utvecklingsmiljön ska förberedas. Startskriptet har lästs, inte körts i överlämningen.

## Alternativ 2: frontend på MacBook, ljud på Mac Mini

Mac Minis runner kör redan via `studio.saltwaves.runner` på localhost 8766. Kontrollera tjänsten före användning; starta inte en extra runner manuellt.

På MacBook, när ingen lokal runner använder 8766:

```bash
ssh -N -L 8766:127.0.0.1:8766 mac-mini
```

I en separat terminal i frontendmappen:

```bash
npm run dev
```

Öppna `http://localhost:3000/tools/local-run`.
Lokal runner och tunnel är alternativa sätt att använda samma port. Byt inte mellan dem genom att döda en process utan att kontrollera om ett jobb pågår.

## Filer och version

- Runner och panel förväntar sig version `6-jobs-dir`. Uppdatera båda vid en avsiktlig versionsändring.
- Enfilskörningar använder `~/Saltwaves/Panel/<jobid>/` på datorn där runnern arbetar; före-/efterfiler och `~/Saltwaves/Panel/specs.json` hör till denna miljö.
- Runnern startar ljudkedjan med `PODMASTER_PYTHON`; utan överstyrning är standarden `~/podmaster-env/bin/python`.
- Runnern stöder också multitrack/jobbfolder. Läs `runner.py` och panelens aktuella kod för detta flöde; anta inte att alla jobb går via samma `before_mastered.wav`.
- Browsern analyserar före/efter med samma analysmotor som `/tools/ab-analyzer`.
- MacBooks ljudkedja har en bevarad lokal limiterändring som ännu inte är godkänd som produktionskedja. Se backendens `AGENTS.md` före jämförelse eller publicering.
