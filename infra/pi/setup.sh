#!/bin/bash
# Richtet einen frisch installierten Raspberry Pi (Raspberry Pi OS Lite, 64 Bit) als Einlass-Gerät ein.
# Idempotent: kann beliebig oft ausgeführt werden.
#
#   sudo ./setup.sh                  # alle Schritte
#   sudo ./setup.sh --skip-upgrade   # ohne apt full-upgrade
#   sudo ./setup.sh dns tls          # nur einzelne Schritte
#
# Schritte: base docker firewall accesspoint dns rtc tls hostd kiosk
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"
for f in "$SCRIPT_DIR"/lib/[0-9][0-9]-*.sh; do
  # shellcheck source=/dev/null
  . "$f"
done

ALL_STEPS=(base docker firewall accesspoint dns rtc tls hostd kiosk)
STEPS=()
export SKIP_UPGRADE=0
NEEDS_REBOOT=0

for arg in "$@"; do
  case "$arg" in
  --skip-upgrade) SKIP_UPGRADE=1 ;;
  -h | --help)
    sed -n '2,10p' "$0"
    exit 0
    ;;
  *) STEPS+=("$arg") ;;
  esac
done
[ ${#STEPS[@]} -eq 0 ] && STEPS=("${ALL_STEPS[@]}")

require_root

# Konfiguration anlegen bzw. ergänzen
install -d -m 0755 "$EINLASS_ETC"
if [ ! -f "$EINLASS_CONFIG" ]; then
  log "Konfiguration anlegen: $EINLASS_CONFIG"
  install -m 0600 "$SCRIPT_DIR/config.env.example" "$EINLASS_CONFIG"
fi
# Neue Schlüssel aus der Vorlage ergänzen, bestehende Werte bleiben unverändert
while IFS='=' read -r key value; do
  case "$key" in '' | \#*) continue ;; esac
  grep -q "^${key}=" "$EINLASS_CONFIG" || printf '%s=%s\n' "$key" "$value" >>"$EINLASS_CONFIG"
done <"$SCRIPT_DIR/config.env.example"
load_config
if [ -z "${WIFI_PASSWORD:-}" ]; then
  WIFI_PASSWORD=$(random_password 12)
  set_config_value "$EINLASS_CONFIG" WIFI_PASSWORD "$WIFI_PASSWORD"
  log "WLAN-Passwort erzeugt und in $EINLASS_CONFIG gespeichert"
fi
if [ ${#WIFI_PASSWORD} -lt 8 ] || [ ${#WIFI_PASSWORD} -gt 63 ]; then
  die "WIFI_PASSWORD muss 8–63 Zeichen lang sein"
fi

for step in "${STEPS[@]}"; do
  declare -F "step_$step" >/dev/null || die "Unbekannter Schritt: $step"
  log "──── Schritt: $step ────"
  "step_$step"
done

log "Fertig."
log "  WLAN:  $WIFI_SSID"
log "  App:   https://$DOMAIN"
log "  Konfiguration (inkl. WLAN-Passwort): $EINLASS_CONFIG"
if [ "$NEEDS_REBOOT" = 1 ]; then
  warn "Neustart erforderlich, damit alle Änderungen wirksam werden: sudo reboot"
fi
