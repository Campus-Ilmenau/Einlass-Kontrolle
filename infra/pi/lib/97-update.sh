#!/bin/bash
# Auto-Update: einlass-update per systemd-Timer und beim Einstecken des Ethernet-Kabels.

step_update() {
  install -m 0755 "$SCRIPT_DIR/files/einlass-update" /usr/local/sbin/einlass-update

  write_if_changed /etc/systemd/system/einlass-update.service <<'UNIT' || true
[Unit]
Description=Einlass-Kontrolle: Docker-Images aktualisieren
After=network-online.target docker.service einlass-hostd.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/einlass-update
TimeoutStartSec=20min
Nice=10
UNIT

  write_if_changed /etc/systemd/system/einlass-update.timer <<'UNIT' || true
[Unit]
Description=Einlass-Kontrolle: regelmäßig nach Updates sehen

[Timer]
OnBootSec=2min
OnUnitActiveSec=15min
RandomizedDelaySec=60
Persistent=false

[Install]
WantedBy=timers.target
UNIT

  # Sofort nach dem Einstecken des Ethernet-Kabels (NetworkManager-Dispatcher)
  write_if_changed /etc/NetworkManager/dispatcher.d/90-einlass-update 0755 <<'HOOK' || true
#!/bin/sh
# $1 = Interface, $2 = Aktion
if [ "$1" = "eth0" ] && [ "$2" = "up" ]; then
  systemctl start --no-block einlass-update.service
fi
HOOK

  systemctl daemon-reload
  systemctl enable --now einlass-update.timer >/dev/null 2>&1
  log "Auto-Update aktiv (alle 15 min und bei eth0 up), Status: /var/lib/einlass/update-status.json"
}
