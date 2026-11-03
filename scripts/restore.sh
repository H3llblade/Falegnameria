#!/usr/bin/env bash
# Ripristino del database da un backup.
#   bash scripts/restore.sh /var/backups/falegnameria/falegnameria-AAAAMMGG-HHMMSS-etichetta.dump
# Prima del ripristino viene fatto un backup di sicurezza dello stato attuale.
# Il processo PM2 viene fermato durante l'operazione e poi riavviato.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
FILE="${1:-}"
[[ -f "$FILE" ]] || { echo "uso: restore.sh <file.dump>"; ls -1t "${BACKUP_DIR:-/var/backups/falegnameria}" 2>/dev/null | head; exit 1; }
set -a; source ./.env; set +a
PM2_NAME="${PM2_NAME:-falegnameria}"
DB_URL="${DATABASE_URL%%\?*}"

pg_restore --list "$FILE" >/dev/null || { echo "file di backup non valido"; exit 1; }
echo "ATTENZIONE: il database attuale verrà SOSTITUITO con: $FILE"
read -r -p "Digitare RIPRISTINA per confermare: " ok
[[ "$ok" == "RIPRISTINA" ]] || { echo "annullato"; exit 1; }

bash scripts/backup.sh pre-ripristino
pm2 stop "$PM2_NAME" || true
pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --dbname="$DB_URL" "$FILE"
npx prisma migrate deploy
pm2 start "$PM2_NAME" || pm2 start ecosystem.config.cjs
echo "ripristino completato"
