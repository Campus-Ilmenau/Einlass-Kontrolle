#!/bin/bash
# DHCP + DNS für das WLAN des Pi (dnsmasq). Kein Upstream-DNS: das Netz ist offline.

step_dns() {
  if write_if_changed /etc/dnsmasq.d/einlass.conf <<CONF; then
# Einlass-Kontrolle – nur im WLAN des Pi aktiv
interface=wlan0
except-interface=lo
bind-dynamic
no-resolv
no-hosts
domain-needed
bogus-priv

dhcp-authoritative
dhcp-range=${DHCP_START},${DHCP_END},255.255.255.0,12h
dhcp-option=option:router,${AP_IP}
dhcp-option=option:dns-server,${AP_IP}

# App-Name
address=/${DOMAIN}/${AP_IP}
CONF
    log "dnsmasq-Konfiguration geändert"
  fi
  systemctl enable dnsmasq >/dev/null 2>&1
  systemctl restart dnsmasq
  log "DHCP/DNS aktiv ($DOMAIN → $AP_IP)"
}
