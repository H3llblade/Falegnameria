#!/usr/bin/env bash
# =============================================================================
# Deploy della Falegnameria sulla VPS. Eseguito da GitHub Actions via SSH
# (o a mano):   bash scripts/deploy.sh <commit-sha>
#
# - lock contro deploy concorrenti
# - si ferma se nella copia del server ci sono modifiche locali ai file tracciati
# - verifica che il commit appartenga al branch di produzione
# - backup del database prima di ogni migrazione
# - blocca migrazioni distruttive se ALLOW_DESTRUCTIVE_MIGRATIONS != 1
# - build in cartella separata (.next-build) e scambio: il sito resta attivo
# - riavvia SOLO il processo PM2 della falegnameria
# - health check; se fallisce ripristina automaticamente codice e build precedenti
# =============================================================================
set -Eeuo pipefail

TARGET="${1:-}"
APP_DIR="${APP_DIR:-/Falegnameria}"
BRANCH="${PRODUCTION_BRANCH:-main}"
ALLOW_DESTRUCTIVE="${ALLOW_DESTRUCTIVE_MIGRATIONS:-0}"

log() { printf '[deploy %s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
die() { log "ERRORE: $*"; exit 1; }

[[ -n "$TARGET" ]] || die "uso: deploy.sh <commit-sha>"
[[ "$TARGET" =~ ^[0-9a-f]{7,40}$ ]] || die "commit non valido: $TARGET"
cd "$APP_DIR" || die "directory $APP_DIR non trovata"
[[ -f .env ]] || die ".env mancante in $APP_DIR (vedere .env.example)"

# ---------------------------------------------------------------- lock
mkdir -p "$APP_DIR/.deploy"
exec 9>"$APP_DIR/.deploy/lock"
flock -n 9 || die "un altro deploy è in corso"

# ---------------------------------------------------------------- ambiente
set -a
# shellcheck disable=SC1091
source ./.env
set +a
PM2_NAME="${PM2_NAME:-falegnameria}"
PORT="${PORT:-3100}"
export NODE_ENV=production

# ---------------------------------------------------------------- git
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  git status --short --untracked-files=no
  die "modifiche locali ai file tracciati sulla VPS: salvarle o annullarle a mano prima del deploy"
fi
PREV="$(git rev-parse HEAD)"
log "versione attuale: ${PREV:0:10} → richiesta: ${TARGET:0:10}"
git fetch --quiet origin "$BRANCH"
git cat-file -e "${TARGET}^{commit}" 2>/dev/null || die "commit $TARGET non trovato"
git merge-base --is-ancestor "$TARGET" "origin/$BRANCH" || die "il commit non appartiene a origin/$BRANCH"
TARGET="$(git rev-parse "$TARGET")"

rollback() {
  log "ROLLBACK alla versione ${PREV:0:10}"
  git checkout --quiet --detach "$PREV" || true
  if [[ -d .next-prev ]]; then
    rm -rf .next-failed && mv .next .next-failed 2>/dev/null || true
    mv .next-prev .next
  fi
  npm ci --no-audit --no-fund >/dev/null 2>&1 || true
  pm2 reload "$PM2_NAME" --update-env >/dev/null 2>&1 || true
  echo "$(date -Is) rollback ${PREV} (fallito ${TARGET})" >> .deploy/history.log
}

# ---------------------------------------------------------------- migrazioni distruttive?
NEW_MIGRATIONS="$(git diff --name-only "$PREV" "$TARGET" -- prisma/migrations | grep 'migration.sql$' || true)"
if [[ -n "$NEW_MIGRATIONS" ]]; then
  log "nuove migrazioni: $(echo "$NEW_MIGRATIONS" | tr '\n' ' ')"
  DESTRUCTIVE="$(for f in $NEW_MIGRATIONS; do git show "$TARGET:$f" | grep -inE 'DROP (TABLE|COLUMN|TYPE|INDEX)|TRUNCATE|DELETE FROM|ALTER COLUMN .* TYPE|RENAME (COLUMN|TO)' | sed "s|^|$f: |"; done || true)"
  if [[ -n "$DESTRUCTIVE" ]]; then
    echo "$DESTRUCTIVE"
    [[ "$ALLOW_DESTRUCTIVE" == "1" ]] || die "migrazione potenzialmente distruttiva: rilanciare il deploy manuale con 'allow_destructive_migrations' dopo aver verificato il backup"
    log "migrazione distruttiva AUTORIZZATA esplicitamente"
  fi
fi

# ---------------------------------------------------------------- checkout + dipendenze
git checkout --quiet --detach "$TARGET"
log "installazione dipendenze (npm ci)"
if ! npm ci --no-audit --no-fund; then
  git checkout --quiet --detach "$PREV"; die "npm ci fallito: codice ripristinato"
fi

# ---------------------------------------------------------------- backup + migrazioni
if ! npx prisma migrate status >/dev/null 2>&1; then
  log "migrazioni in sospeso: backup del database prima di applicarle"
  bash scripts/backup.sh pre-migrazione || { rollback; die "backup fallito: migrazioni NON applicate"; }
  npx prisma migrate deploy || { rollback; die "migrazione fallita (backup disponibile)"; }
else
  log "database già aggiornato"
fi

# ---------------------------------------------------------------- build in cartella separata
log "build di produzione"
rm -rf .next-build
if ! NEXT_DIST_DIR=.next-build APP_VERSION="${TARGET:0:10}" npm run build; then
  rm -rf .next-build
  git checkout --quiet --detach "$PREV"
  npm ci --no-audit --no-fund >/dev/null 2>&1 || true
  die "build fallita: il sito continua con la versione precedente"
fi
rm -rf .next-prev
[[ -d .next ]] && mv .next .next-prev
mv .next-build .next

# ---------------------------------------------------------------- riavvio (solo questo processo)
export APP_VERSION="${TARGET:0:10}"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 reload "$PM2_NAME" --update-env
else
  pm2 start ecosystem.config.cjs --update-env
fi
pm2 save >/dev/null

# ---------------------------------------------------------------- health check
log "health check su http://127.0.0.1:${PORT}/api/health"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" | grep -q '"status":"ok"'; then
    echo "$(date -Is) ok ${TARGET} (da ${PREV})" >> .deploy/history.log
    log "DEPLOY COMPLETATO: ${TARGET:0:10}"
    exit 0
  fi
  sleep 2
done
rollback
die "health check fallito: ripristinata la versione precedente"
