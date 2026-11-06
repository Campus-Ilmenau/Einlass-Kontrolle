#!/bin/bash
# WLAN-Access-Point über NetworkManager (ohne NAT, feste IP, DHCP/DNS macht dnsmasq).

step_accesspoint() {
  local con=einlass-ap

  raspi-config nonint do_wifi_country "$COUNTRY" >/dev/null 2>&1 || iw reg set "$COUNTRY"
  rfkill unblock wifi || true
  nmcli radio wifi on

  local args=(
    connection.autoconnect yes
    connection.autoconnect-priority 100
    802-11-wireless.ssid "$WIFI_SSID"
    802-11-wireless.mode ap
    802-11-wireless.band bg
    802-11-wireless.channel "$WIFI_CHANNEL"
    ipv4.method manual
    ipv4.addresses "$AP_IP/$AP_PREFIX"
    ipv4.never-default yes
    ipv6.method disabled
    wifi-sec.key-mgmt wpa-psk
    wifi-sec.psk "$WIFI_PASSWORD"
    wifi-sec.proto rsn
    wifi-sec.pairwise ccmp
    wifi-sec.group ccmp
    wifi-sec.pmf disable
  )

  if nmcli -t -f NAME connection show | grep -qx "$con"; then
    log "Access Point aktualisieren"
    nmcli connection modify "$con" "${args[@]}"
  else
    log "Access Point anlegen"
    nmcli connection add type wifi ifname wlan0 con-name "$con" "${args[@]}" >/dev/null
  fi
  nmcli connection up "$con" >/dev/null
  log "WLAN \"$WIFI_SSID\" aktiv auf $AP_IP"
}
