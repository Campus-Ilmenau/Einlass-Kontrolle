#!/bin/bash
# Grundsystem: Pakete, Zeitzone, Hostname-Auflösung.

step_base() {
  log "Paketquellen aktualisieren"
  apt-get update -qq

  if [ "${SKIP_UPGRADE:-0}" != 1 ]; then
    log "System aktualisieren (kann einige Minuten dauern)"
    DEBIAN_FRONTEND=noninteractive apt-get full-upgrade -y -qq
  fi

  log "Benötigte Pakete installieren"
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    ca-certificates curl gnupg openssl nftables dnsmasq i2c-tools >/dev/null

  log "Zeitzone Europe/Berlin"
  timedatectl set-timezone Europe/Berlin

  # Der Pi selbst soll seinen App-Namen auflösen können (z. B. für den Kiosk)
  if ! grep -q "[[:space:]]${DOMAIN}\$" /etc/hosts; then
    printf '%s\t%s\n' "$AP_IP" "$DOMAIN" >>/etc/hosts
  fi
}
