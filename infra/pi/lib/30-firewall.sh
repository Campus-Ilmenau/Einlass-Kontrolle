#!/bin/bash
# Verhindert jegliches Routing zwischen dem WLAN des Pi und dem Ethernet-Uplink.
# Docker schaltet ip_forward selbst ein. Diese Regeln greifen davor (Priorität filter - 10)
# und lassen nur den Weg WLAN → Docker-Container zu.

step_firewall() {
  write_if_changed "$EINLASS_ETC/firewall.nft" 0644 <<'NFT' || true
#!/usr/sbin/nft -f
# Einlass-Kontrolle: kein Routing zwischen WLAN (wlan0) und Uplink (eth0)
table inet einlass
delete table inet einlass
table inet einlass {
  chain forward {
    type filter hook forward priority filter - 10; policy accept;
    iifname "wlan0" oifname "eth0" counter drop
    iifname "eth0" oifname "wlan0" counter drop
  }
}
NFT

  write_if_changed /etc/systemd/system/einlass-firewall.service <<'UNIT' || true
[Unit]
Description=Einlass-Kontrolle: Firewall (kein Routing WLAN <-> Ethernet)
DefaultDependencies=no
Before=network-pre.target docker.service
Wants=network-pre.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/sbin/nft -f /etc/einlass/firewall.nft
ExecStop=/usr/sbin/nft delete table inet einlass

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable einlass-firewall.service >/dev/null 2>&1
  systemctl restart einlass-firewall.service
  log "Firewall aktiv (kein Routing WLAN <-> Ethernet)"
}
