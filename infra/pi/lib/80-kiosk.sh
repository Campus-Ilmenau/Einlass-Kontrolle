#!/bin/bash
# Kiosk auf dem DSI-Display: cage (Wayland) + Chromium, Hochformat, ohne Mauszeiger.

step_kiosk() {
  local files="$SCRIPT_DIR/files"

  log "Kiosk-Pakete installieren"
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
    cage chromium wlr-randr grim qrencode fonts-dejavu-core python3 libnss3-tools >/dev/null

  if ! id kiosk >/dev/null 2>&1; then
    log "Systembenutzer 'kiosk' anlegen"
    useradd --system --create-home --home-dir /var/lib/einlass-kiosk --shell /usr/sbin/nologin \
      --groups video,render,input kiosk
  fi

  log "Unsichtbares Cursor-Theme"
  python3 "$files/make-blank-cursor.py" /usr/share/icons/einlass-blank >/dev/null
  # cage/wlroots lädt immer das Theme "default" (XCURSOR_THEME wird ignoriert).
  # Nur für den Kiosk-Benutzer: ~/.icons/default erbt vom unsichtbaren Theme.
  install -d -o kiosk -g kiosk /var/lib/einlass-kiosk/.icons/default
  printf '[Icon Theme]\nInherits=einlass-blank\n' >/var/lib/einlass-kiosk/.icons/default/index.theme

  # Zertifikat im Kiosk-Browser als vertrauenswürdig hinterlegen (NSS-Datenbank des Kiosk-Benutzers),
  # damit https://<DOMAIN>/display ohne Warnung lädt
  if [ -f "$EINLASS_ETC/tls/cert.pem" ]; then
    local nssdb=/var/lib/einlass-kiosk/.pki/nssdb
    install -d -o kiosk -g kiosk -m 0700 /var/lib/einlass-kiosk/.pki "$nssdb"
    [ -f "$nssdb/cert9.db" ] || sudo -u kiosk certutil -d "sql:$nssdb" -N --empty-password
    sudo -u kiosk certutil -d "sql:$nssdb" -D -n einlass 2>/dev/null || true
    sudo -u kiosk certutil -d "sql:$nssdb" -A -n einlass -t "P,," -i "$EINLASS_ETC/tls/cert.pem"
  fi

  install -m 0755 "$files/einlass-kiosk" /usr/local/bin/einlass-kiosk
  install -m 0755 "$files/einlass-display-render" /usr/local/bin/einlass-display-render
  /usr/local/bin/einlass-display-render

  # Chromium-Richtlinien: keine Übersetzungsleiste, keine Passwort-/Anmelde-Dialoge
  write_if_changed /etc/chromium/policies/managed/einlass-kiosk.json <<'JSON' || true
{
  "TranslateEnabled": false,
  "PasswordManagerEnabled": false,
  "BrowserSignin": 0,
  "DefaultBrowserSettingEnabled": false,
  "SpellcheckEnabled": false,
  "AutofillAddressEnabled": false,
  "AutofillCreditCardEnabled": false
}
JSON

  # Statusseite als eigener Dienst (nicht als ExecStartPre am TTY, sonst trifft ihn das vhangup)
  write_if_changed /etc/systemd/system/einlass-display-render.service <<'UNIT' || true
[Unit]
Description=Einlass-Kontrolle: Statusseite für das Display erzeugen
Before=einlass-kiosk.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/einlass-display-render
UNIT

  write_if_changed /etc/systemd/system/einlass-kiosk.service <<'UNIT' || true
[Unit]
Description=Einlass-Kontrolle: Kiosk auf dem Display (cage + Chromium)
After=systemd-user-sessions.service plymouth-quit-wait.service docker.service einlass-display-render.service
Wants=docker.service
Requires=einlass-display-render.service
Conflicts=getty@tty1.service

[Service]
User=kiosk
PAMName=login
TTYPath=/dev/tty1
TTYReset=yes
TTYVHangup=yes
TTYVTDisallocate=yes
UtmpIdentifier=tty1
UtmpMode=user
StandardInput=tty-fail
StandardOutput=journal
StandardError=journal
Environment=XCURSOR_THEME=einlass-blank
Environment=XCURSOR_SIZE=1
ExecStart=/usr/bin/cage -d -s -- /usr/local/bin/einlass-kiosk
Restart=always
RestartSec=3

[Install]
WantedBy=graphical.target
UNIT
  systemctl daemon-reload
  systemctl set-default graphical.target >/dev/null
  systemctl disable getty@tty1.service >/dev/null 2>&1 || true
  systemctl enable einlass-kiosk.service >/dev/null 2>&1
  systemctl restart einlass-kiosk.service
  log "Kiosk läuft ($DISPLAY_OUTPUT, Drehung: $DISPLAY_TRANSFORM)"
}
