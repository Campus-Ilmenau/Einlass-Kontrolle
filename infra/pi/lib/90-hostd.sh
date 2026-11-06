#!/bin/bash
# Host-Dienst für die API: Systemzeit setzen, RTC schreiben, Herunterfahren.
# Zugriff nur über den Unix-Socket /run/einlass/hostd.sock für die Gruppe "einlass".

HOSTD_GROUP=einlass

step_hostd() {
  if ! getent group "$HOSTD_GROUP" >/dev/null; then
    log "Systemgruppe '$HOSTD_GROUP' anlegen"
    groupadd --system "$HOSTD_GROUP"
  fi

  install -m 0755 "$SCRIPT_DIR/files/einlass-hostd" /usr/local/sbin/einlass-hostd

  write_if_changed /etc/systemd/system/einlass-hostd.service <<'UNIT' || true
[Unit]
Description=Einlass-Kontrolle: Host-Dienst (Zeit, RTC, Herunterfahren)
After=time-set.target systemd-timesyncd.service
Before=docker.service einlass-kiosk.service

[Service]
Type=simple
ExecStart=/usr/bin/python3 /usr/local/sbin/einlass-hostd
Restart=always
RestartSec=2
RuntimeDirectory=einlass
RuntimeDirectoryMode=0750
StateDirectory=einlass
StateDirectoryMode=0755
# Laufzeitverzeichnis für die Gruppe einlass öffnen (Socket selbst: 0660 root:einlass)
ExecStartPost=/bin/chgrp einlass /run/einlass
# Härtung: nur was für Zeit/RTC/Shutdown nötig ist
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=/var/lib/einlass /var/lib/systemd/timesync
ProtectHome=yes
PrivateTmp=yes
PrivateNetwork=yes
RestrictAddressFamilies=AF_UNIX
CapabilityBoundingSet=CAP_SYS_TIME CAP_CHOWN CAP_FOWNER CAP_DAC_OVERRIDE
DeviceAllow=/dev/rtc0 rw
DevicePolicy=closed

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable einlass-hostd.service >/dev/null 2>&1
  systemctl restart einlass-hostd.service
  log "Host-Dienst aktiv: /run/einlass/hostd.sock (Gruppe $HOSTD_GROUP, GID $(getent group "$HOSTD_GROUP" | cut -d: -f3))"
}
