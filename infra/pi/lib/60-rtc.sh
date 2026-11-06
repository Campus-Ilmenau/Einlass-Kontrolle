#!/bin/bash
# Echtzeituhr DS3231 (I²C, Adresse 0x68). Wird nur aktiviert, wenn das Modul erkannt wird.

CONFIG_TXT=/boot/firmware/config.txt
RTC_OVERLAY="dtoverlay=i2c-rtc,ds3231"

step_rtc() {
  raspi-config nonint do_i2c 0 >/dev/null 2>&1 || true
  dtparam i2c_arm=on 2>/dev/null || true
  modprobe i2c-dev 2>/dev/null || true

  if grep -q "^${RTC_OVERLAY}" "$CONFIG_TXT"; then
    if [ -e /dev/rtc0 ]; then
      log "RTC aktiv: $(hwclock -r 2>/dev/null || echo 'nicht lesbar')"
    else
      warn "RTC-Overlay gesetzt, aber /dev/rtc0 fehlt (Neustart nötig oder Modul abgezogen?)"
    fi
    return
  fi

  if i2cdetect -y 1 0x68 0x68 2>/dev/null | grep -Eq '(68|UU)'; then
    log "RTC-Modul gefunden → Overlay aktivieren (wirksam nach Neustart)"
    printf '\n[all]\n%s\n' "$RTC_OVERLAY" >>"$CONFIG_TXT"
    # fake-hwclock würde die RTC-Zeit beim Boot überschreiben
    DEBIAN_FRONTEND=noninteractive apt-get purge -y -qq fake-hwclock >/dev/null 2>&1 || true
    # shellcheck disable=SC2034  # wird in setup.sh ausgewertet
    NEEDS_REBOOT=1
  else
    warn "Kein RTC-Modul (DS3231) gefunden. Nach Stromausfall startet die Uhr beim letzten gespeicherten Stand (systemd-timesyncd) und muss per Client-Abgleich korrigiert werden!"
  fi
}
