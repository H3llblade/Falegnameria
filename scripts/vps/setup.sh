#!/usr/bin/env bash
# Prima installazione sulla VPS, idempotente e limitata alla Falegnameria.
# NON tocca altri vhost, processi PM2 o database.
#
#   sudo bash scripts/vps/setup.sh            (dalla directory /Falegnameria già clonata)
#
# Passi: database e utente dedicati · .env · npm ci · migrazioni · build · PM2 (+ avvio al boot)
#        · vhost Nginx dedicato · certificato Let's Encrypt · cron dei backup.
# Ogni passo chiede conferma.
set -Eeuo pipefail
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DOMAIN="${DOMAIN:-falegnameria.devicloud.me}"
APP_USER="${APP_USER:-${SUDO_USER:-$(whoami)}}"
DB_NAME="${DB_NAME:-falegnameria}"
DB_USER="${DB_USER:-falegnameria}"
PM2_NAME="${PM2_NAME:-falegnameria}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/falegnameria}"

ask() { read -r -p "$1 [s/N] " a; [[ "$a" =~ ^[sS]$ ]]; }
as_app() { sudo -u "$APP_USER" -H bash -lc "cd '$APP_DIR' && $*"; }
[[ $EUID -eq 0 ]] || { echo "eseguire con sudo"; exit 1; }
echo "Directory: $APP_DIR · utente applicazione: $APP_USER · dominio: $DOMAIN"

# ------------------------------------------------------------- porta
PORT="$(grep -E '^PORT=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2 | tr -d '"' || true)"
if [[ -z "$PORT" ]]; then
  for p in $(seq 3100 3199); do ss -ltn | grep -q ":$p " || { PORT=$p; break; }; done
fi
ss -ltnp | grep -q ":$PORT " && ! (sudo -u "$APP_USER" pm2 describe "$PM2_NAME" >/dev/null 2>&1) && { echo "porta $PORT occupata da un altro processo"; exit 1; }
echo "porta applicazione: $PORT"

# ------------------------------------------------------------- database
if ask "Creare (se mancano) database '$DB_NAME' e utente '$DB_USER' in PostgreSQL?"; then
  if sudo -u postgres psql -Atc "select 1 from pg_roles where rolname='$DB_USER'" | grep -q 1; then
    echo "utente $DB_USER già esistente: password invariata"
    DB_PASS=""
  else
    DB_PASS="$(openssl rand -base64 30 | tr -dc 'A-Za-z0-9' | head -c 32)"
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS'"
  fi
  sudo -u postgres psql -Atc "select 1 from pg_database where datname='$DB_NAME'" | grep -q 1 \
    || sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB_NAME OWNER $DB_USER ENCODING 'UTF8' TEMPLATE template0"
fi

# ------------------------------------------------------------- .env
if [[ ! -f "$APP_DIR/.env" ]]; then
  [[ -n "${DB_PASS:-}" ]] || read -r -s -p "Password dell'utente PostgreSQL $DB_USER: " DB_PASS; echo
  cat > "$APP_DIR/.env" <<EOF
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME?schema=public"
APP_URL="https://$DOMAIN"
PORT=$PORT
PM2_NAME=$PM2_NAME
BACKUP_DIR=$BACKUP_DIR
BACKUP_RETENTION_DAYS=30
NEXT_PUBLIC_TIMEZONE=Europe/Rome
EOF
  chown "$APP_USER" "$APP_DIR/.env"; chmod 600 "$APP_DIR/.env"
  echo ".env creato (permessi 600)"
fi
mkdir -p "$BACKUP_DIR"; chown "$APP_USER" "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"

# ------------------------------------------------------------- app
if ask "Installare dipendenze, applicare migrazioni e compilare?"; then
  as_app "npm ci --no-audit --no-fund && npx prisma migrate deploy && npm run build"
fi
if ask "Avviare il processo PM2 '$PM2_NAME' e abilitarne l'avvio al boot?"; then
  as_app "pm2 describe $PM2_NAME >/dev/null 2>&1 && pm2 reload $PM2_NAME --update-env || pm2 start ecosystem.config.cjs"
  as_app "pm2 save"
  env PATH="$PATH:$(dirname "$(command -v node)")" "$(command -v pm2)" startup systemd -u "$APP_USER" --hp "$(getent passwd "$APP_USER" | cut -d: -f6)" | tail -1
fi

# ------------------------------------------------------------- nginx
CONF=/etc/nginx/sites-available/$DOMAIN.conf
if ask "Installare il vhost Nginx dedicato $CONF?"; then
  if grep -Rl "server_name[^;]*$DOMAIN" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | grep -v "$DOMAIN.conf"; then
    echo "il dominio è già definito in un altro file: interrompo per non toccarlo"; exit 1
  fi
  sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__PORT__/$PORT/g" "$APP_DIR/deploy/nginx/falegnameria.conf" > "$CONF"
  ln -sf "$CONF" "/etc/nginx/sites-enabled/$DOMAIN.conf"
  nginx -t && systemctl reload nginx
fi
if ask "Richiedere il certificato HTTPS Let's Encrypt per $DOMAIN (il DNS deve già puntare qui)?"; then
  certbot --nginx -d "$DOMAIN" --redirect --non-interactive --agree-tos -m "${LE_EMAIL:?impostare LE_EMAIL=indirizzo per Let\'s Encrypt}"
  nginx -t && systemctl reload nginx
fi

# ------------------------------------------------------------- backup periodico
if ask "Installare il backup giornaliero (03:30) nel crontab di $APP_USER?"; then
  LINE="30 3 * * * cd $APP_DIR && bash scripts/backup.sh periodico >> $BACKUP_DIR/backup.log 2>&1"
  (crontab -u "$APP_USER" -l 2>/dev/null | grep -vF "scripts/backup.sh periodico"; echo "$LINE") | crontab -u "$APP_USER" -
  echo "cron installato"
fi

echo
echo "Fatto. Creare l'amministratore con:  cd $APP_DIR && npm run admin:create"
echo "Verifica: curl -fsS http://127.0.0.1:$PORT/api/health"
