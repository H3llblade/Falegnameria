#!/usr/bin/env bash
# Ricognizione della VPS in SOLA LETTURA: non modifica nulla.
#   bash scripts/vps/check-environment.sh
# Mostra: strumenti installati, porte occupate, virtual host Nginx, processi PM2,
# database PostgreSQL, DNS del dominio. Da eseguire prima del setup.
DOMAIN="${DOMAIN:-falegnameria.devicloud.me}"
APP_DIR="${APP_DIR:-/Falegnameria}"
h() { printf '\n==== %s ====\n' "$*"; }

h "Sistema"
uname -a; (lsb_release -ds 2>/dev/null || cat /etc/os-release | head -2); echo "utente: $(whoami)"

h "Strumenti"
for c in git node npm pm2 nginx psql pg_dump certbot curl flock; do
  printf '%-8s ' "$c"; command -v "$c" >/dev/null && ("$c" --version 2>&1 | head -1) || echo "NON INSTALLATO"
done

h "Directory $APP_DIR"
if [[ -d "$APP_DIR" ]]; then ls -la "$APP_DIR" | head -20; (cd "$APP_DIR" && git remote -v 2>/dev/null && git log --oneline -3 2>/dev/null); else echo "non esiste"; fi
echo "scrivibile: $([[ -w "$APP_DIR" || -w "$(dirname "$APP_DIR")" ]] && echo sì || echo no)"

h "Porte in ascolto (TCP)"
(ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | awk 'NR==1 || /LISTEN/'
echo; echo "Porte libere suggerite tra 3100 e 3199:"
for p in $(seq 3100 3199); do (ss -ltn 2>/dev/null | grep -q ":$p ") || { echo "  $p"; break; }; done

h "PM2"
pm2 jlist >/dev/null 2>&1 && pm2 list || echo "pm2 non disponibile per questo utente"

h "Nginx: virtual host"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null; ls -la /etc/nginx/conf.d/ 2>/dev/null
echo; echo "server_name configurati:"; grep -RhoE 'server_name[^;]+' /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | sort -u
echo; grep -Rl "$DOMAIN" /etc/nginx 2>/dev/null && echo "^ il dominio è GIÀ presente in questi file" || echo "nessun vhost per $DOMAIN"

h "Certificati Let's Encrypt"
sudo -n certbot certificates 2>/dev/null | grep -E 'Certificate Name|Domains|Expiry' || ls /etc/letsencrypt/live 2>/dev/null || echo "non leggibili senza sudo"

h "PostgreSQL"
systemctl is-active postgresql 2>/dev/null || echo "servizio postgresql non attivo/non presente"
sudo -n -u postgres psql -Atc "select datname from pg_database where not datistemplate" 2>/dev/null || echo "(elenco database non leggibile senza sudo)"

h "DNS $DOMAIN"
getent hosts "$DOMAIN" || echo "il dominio non risolve ancora"
echo "IP pubblico della VPS: $(curl -fsS https://api.ipify.org 2>/dev/null || echo 'non rilevato')"
