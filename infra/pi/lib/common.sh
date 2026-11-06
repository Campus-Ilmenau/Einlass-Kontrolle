#!/bin/bash
# Gemeinsame Hilfsfunktionen für die Setup-Schritte.
# shellcheck disable=SC2034  # Variablen werden in den Schritten genutzt

EINLASS_ETC=/etc/einlass
EINLASS_CONFIG="$EINLASS_ETC/config.env"

log() { printf '\033[1;34m[einlass]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[einlass] WARNUNG:\033[0m %s\n' "$*" >&2; }
die() {
  printf '\033[1;31m[einlass] FEHLER:\033[0m %s\n' "$*" >&2
  exit 1
}

require_root() {
  [ "$(id -u)" -eq 0 ] || die "Bitte mit sudo ausführen."
}

# Schreibt eine Datei nur, wenn sich der Inhalt geändert hat.
# Gibt 0 zurück, wenn geschrieben wurde, sonst 1.
write_if_changed() {
  local target=$1 mode=${2:-0644} tmp
  tmp=$(mktemp)
  cat >"$tmp"
  if [ -f "$target" ] && cmp -s "$tmp" "$target"; then
    rm -f "$tmp"
    return 1
  fi
  install -m "$mode" -D "$tmp" "$target"
  rm -f "$tmp"
  return 0
}

# Setzt KEY=VALUE in einer env-Datei (ersetzt oder hängt an).
set_config_value() {
  local file=$1 key=$2 value=$3
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$file"
  fi
}

# Zufälliges, gut abtippbares Passwort (ohne 0/O, 1/l/I).
# Liest eine feste Menge Zufallsbytes (kein SIGPIPE unter `set -o pipefail`).
random_password() {
  local len=${1:-12} pw=''
  while [ ${#pw} -lt "$len" ]; do
    pw+=$(head -c 512 /dev/urandom | LC_ALL=C tr -dc 'A-HJ-NP-Za-km-z2-9')
  done
  printf '%s' "${pw:0:len}"
}

load_config() {
  # shellcheck source=/dev/null
  . "$EINLASS_CONFIG"
}
