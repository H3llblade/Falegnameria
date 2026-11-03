#!/usr/bin/env bash
# Backup del database PostgreSQL (formato custom pg_dump, compresso).
#   bash scripts/backup.sh [etichetta]
# Variabili (.env): DATABASE_URL, BACKUP_DIR (default /var/backups/falegnameria), BACKUP_RETENTION_DAYS (default 30)
# I backup sono FUORI dalla directory del repository e leggibili solo dal proprietario.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
if [[ -f .env ]]; then set -a; source ./.env; set +a; fi
: "${DATABASE_URL:?DATABASE_URL non impostata}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/falegnameria}"
RETENTION="${BACKUP_RETENTION_DAYS:-30}"
LABEL="${1:-periodico}"
[[ "$LABEL" =~ ^[a-z0-9-]+$ ]] || { echo "etichetta non valida"; exit 1; }

umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
DB_URL="${DATABASE_URL%%\?*}" # pg_dump non accetta ?schema=
FILE="$BACKUP_DIR/falegnameria-$(date +%Y%m%d-%H%M%S)-$LABEL.dump"
pg_dump --format=custom --no-owner --no-privileges --file="$FILE.part" "$DB_URL"
mv "$FILE.part" "$FILE"
pg_restore --list "$FILE" >/dev/null # verifica leggibilità
echo "backup creato: $FILE ($(du -h "$FILE" | cut -f1))"

find "$BACKUP_DIR" -name 'falegnameria-*.dump' -type f -mtime +"$RETENTION" -print -delete | sed 's/^/rimosso (retention): /'
