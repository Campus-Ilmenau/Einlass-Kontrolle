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

  # Der Pi selbst soll seinen App-Namen auflösen können. Unter Raspberry Pi OS mit cloud-init
  # wird /etc/hosts bei jedem Boot aus einer Vorlage erzeugt → Eintrag auch dort ergänzen.
  local hosts
  for hosts in /etc/hosts /etc/cloud/templates/hosts.debian.tmpl; do
    [ -f "$hosts" ] || continue
    grep -q "[[:space:]]${DOMAIN}\$" "$hosts" || printf '%s\t%s\n' "$AP_IP" "$DOMAIN" >>"$hosts"
  done
}
