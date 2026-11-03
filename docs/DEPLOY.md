# Deploy: GitHub → VPS

Flusso: **Codespaces → commit → push su GitHub → GitHub Actions (verifica) → SSH sulla VPS → `scripts/deploy.sh` → sito aggiornato.**

Il repository GitHub è la fonte ufficiale del codice. La VPS ne mantiene una copia in `/Falegnameria`. Il database PostgreSQL e i backup stanno fuori dal repository: nessun deploy li reinizializza.

---

## 1. Ricognizione della VPS (sola lettura)

```bash
cd /Falegnameria           # oppure clonare prima: vedi punto 3
bash scripts/vps/check-environment.sh
```

Mostra porte occupate, vhost Nginx, processi PM2, database, certificati, DNS e una porta libera suggerita (3100–3199). Non modifica nulla.

## 2. DNS

Presso il gestore di `devicloud.me` creare:

| Tipo | Nome | Valore |
|---|---|---|
| A | `falegnameria` | IP pubblico IPv4 della VPS |
| AAAA (solo se la VPS ha IPv6) | `falegnameria` | IP pubblico IPv6 |

Verifica: `getent hosts falegnameria.devicloud.me` deve restituire l'IP della VPS.

## 3. Accesso della VPS al repository

Se il repository è **privato**, generare sulla VPS una *deploy key* in sola lettura:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/falegnameria_repo -N "" -C "vps-falegnameria-readonly"
cat ~/.ssh/falegnameria_repo.pub   # GitHub → repo → Settings → Deploy keys → Add (senza "write access")
cat >> ~/.ssh/config <<'EOF'
Host github-falegnameria
  HostName github.com
  IdentityFile ~/.ssh/falegnameria_repo
  IdentitiesOnly yes
EOF
```

Clone (se `/Falegnameria` non esiste ancora — creare la cartella richiede `sudo` una sola volta):

```bash
sudo mkdir -p /Falegnameria && sudo chown "$USER": /Falegnameria
git clone git@github-falegnameria:<UTENTE>/Falegnameria.git /Falegnameria
```

Se la cartella esiste già con una copia del repository: `cd /Falegnameria && git status && git pull --ff-only`.

## 4. Prima installazione

Requisiti: Node.js ≥ 20.9, npm, PM2 (`npm i -g pm2`), PostgreSQL ≥ 14 con `pg_dump`, Nginx, Certbot.

```bash
cd /Falegnameria
sudo LE_EMAIL=indirizzo@esempio.it bash scripts/vps/setup.sh
```

Lo script chiede conferma a ogni passo e tocca **solo** risorse della Falegnameria:

1. database `falegnameria` e utente dedicato (password generata, scritta solo in `.env`, permessi 600);
2. `.env` con `DATABASE_URL`, `APP_URL`, `PORT` libera, `PM2_NAME`, `BACKUP_DIR`;
3. `npm ci`, `prisma migrate deploy`, build;
4. processo PM2 `falegnameria` (solo `127.0.0.1:PORT`) e avvio automatico al boot;
5. vhost `/etc/nginx/sites-available/falegnameria.devicloud.me.conf` (si ferma se il dominio è già definito altrove), `nginx -t` prima del reload;
6. certificato Let's Encrypt con reindirizzamento HTTP → HTTPS;
7. backup giornaliero alle 03:30 nel crontab dell'utente applicazione.

Poi creare l'amministratore (nessuna credenziale predefinita esiste):

```bash
npm run admin:create
```

## 5. Configurazione di GitHub Actions

Generare una **chiave SSH dedicata al deploy** (sul proprio computer, non sulla VPS):

```bash
ssh-keygen -t ed25519 -f falegnameria_deploy -N "" -C "github-actions-falegnameria"
```

Sulla VPS, aggiungere `falegnameria_deploy.pub` a `~/.ssh/authorized_keys` dell'utente che possiede `/Falegnameria`. Consigliato: un utente dedicato al deploy, senza `sudo`, proprietario solo di `/Falegnameria` e della cartella dei backup.

In GitHub → Settings → Secrets and variables → Actions:

| Tipo | Nome | Valore |
|---|---|---|
| Secret | `VPS_HOST` | IP o hostname della VPS |
| Secret | `VPS_USER` | utente SSH del deploy |
| Secret | `VPS_SSH_KEY` | contenuto di `falegnameria_deploy` (chiave privata) |
| Secret | `VPS_PORT` | porta SSH, se diversa da 22 |
| Secret | `VPS_KNOWN_HOSTS` | output di `ssh-keyscan -p PORTA HOST` (consigliato) |
| Variable | `AUTO_DEPLOY` | `true` per il deploy automatico a ogni push su `main` |
| Variable | `DEPLOY_DIR` | `/Falegnameria` (default) |
| Variable | `PM2_NAME` | `falegnameria` (default) |
| Variable | `PRODUCTION_BRANCH` | `main` (default) |
| Variable | `PUBLIC_URL` | `https://falegnameria.devicloud.me` (default) |

Creare anche l'environment `production` (Settings → Environments): si possono richiedere approvazioni manuali.

## 6. Deploy

- **Manuale:** Actions → *Verifica e deploy* → *Run workflow* (branch `main`).
- **Automatico:** con `AUTO_DEPLOY=true`, ogni push su `main` che supera la verifica viene pubblicato.

Il workflow: typecheck → lint → test (con PostgreSQL) → build → SSH → `scripts/deploy.sh <sha>`, preso dal commit approvato. Lo script:

- impedisce deploy concorrenti (`flock`), anche dal workflow (`concurrency`);
- si ferma se sulla VPS ci sono modifiche locali ai file tracciati (niente `git reset --hard`);
- accetta solo commit presenti su `origin/main`;
- esegue `npm ci` con lockfile;
- **fa il backup del database prima di ogni migrazione** e blocca le migrazioni potenzialmente distruttive (`DROP`, `TRUNCATE`, cambi di tipo…) salvo l'opzione esplicita *allow_destructive_migrations*;
- compila in `.next-build` e lo scambia con `.next`: il sito resta online durante la build e una build fallita non lo rompe;
- riavvia **solo** il processo PM2 della falegnameria (`pm2 reload falegnameria`, mai `restart all`);
- controlla `/api/health`; se fallisce ripristina automaticamente codice e build precedenti.

Lo storico è in `/Falegnameria/.deploy/history.log`.

## 7. Rollback

```bash
cd /Falegnameria
bash scripts/rollback.sh          # alla versione precedente
bash scripts/rollback.sh <sha>    # a un commit specifico di main
```

Il rollback riguarda il **codice**. Per restare compatibili, le migrazioni seguono la regola *expand/contract*: si aggiungono colonne/tabelle (facoltative o con default) e si rimuove ciò che non serve solo in un rilascio successivo, quando nessuna versione in uso lo legge più. Così il codice precedente funziona anche con lo schema più recente.

## 8. Backup e ripristino

```bash
bash scripts/backup.sh manuale                       # backup immediato
ls -lt /var/backups/falegnameria                      # elenco
bash scripts/restore.sh /var/backups/falegnameria/falegnameria-AAAAMMGG-HHMMSS-etichetta.dump
```

- formato `pg_dump --format=custom`, verificato con `pg_restore --list`;
- cartella fuori dal repository, permessi 700, file 600;
- retention configurabile con `BACKUP_RETENTION_DAYS` (default 30 giorni);
- `restore.sh` chiede di digitare `RIPRISTINA`, fa prima un backup di sicurezza, ferma e riavvia solo il processo della falegnameria.

Consigliato copiare periodicamente i backup anche fuori dalla VPS.

## 9. Verifiche utili

```bash
curl -fsS http://127.0.0.1:$PORT/api/health
curl -fsS https://falegnameria.devicloud.me/api/health
pm2 logs falegnameria --lines 100
sudo nginx -t
```
