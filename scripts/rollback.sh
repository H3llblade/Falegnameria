#!/usr/bin/env bash
# Rollback del CODICE a un commit precedente (il database non viene toccato).
#   bash scripts/rollback.sh            → versione precedente registrata in .deploy/history.log
#   bash scripts/rollback.sh <sha>      → commit specifico
# Compatibilità: le migrazioni sono sempre additive (expand/contract), quindi il codice
# precedente funziona con lo schema più recente. Vedi docs/DEPLOY.md.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
SHA="${1:-}"
if [[ -z "$SHA" ]]; then
  SHA="$(grep ' ok ' .deploy/history.log 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '()')"
  [[ -n "$SHA" ]] || { echo "nessuna versione precedente registrata: indicare uno sha"; exit 1; }
fi
echo "rollback del codice a $SHA"
# Le migrazioni non vengono annullate: si salta il controllo sulle nuove migrazioni
# perché tornando indietro non ce ne sono da applicare.
bash scripts/deploy.sh "$SHA"
