# Open Doors – testkopia

Privat ingång för Open Doors / Motljus. Körs bara som test på Mac Mini:

- Frontend: `127.0.0.1:3095` (den här worktreet, gren `opendoors-v1`)
- API: `127.0.0.1:8795` (PodMaster-worktreet `~/PodMaster-studio-chain`, kö `opendoors-test`)
- Filer och invites: `~/opendoors-test/` (invites.json innehåller bara sha256)

Starta inte launchd, rör inte Sjöberg (port 3092) och inte live-`~/PodMaster`.

```bash
# terminal 1
~/PodMaster-studio-chain/scripts/run-opendoors-api.sh
# terminal 2
~/PodMaster-studio-chain/scripts/run-opendoors-worker.sh
# efter next build:
~/saltwaves-frontend-opendoors/scripts/run-opendoors-frontend.sh
```

Från en annan dator:

```bash
ssh -L 3095:127.0.0.1:3095 mac-mini
```

Skapa en personlig länk (token skrivs bara ut en gång):

```bash
OPENDOORS_PUBLIC_URL=http://127.0.0.1:3095 python3 ~/saltwaves-frontend-opendoors/scripts/opendoors-invite.py create marcus-test
```

Kundtexten nämner bara Open Doors, Motljus och Saltwaves.
