#!/bin/bash
# Self-signed TLS-Zertifikat für die Web-App.
# Wird nur bei synchronisierter Uhr erzeugt, notBefore liegt 1 Tag in der Vergangenheit.

step_tls() {
  local dir="$EINLASS_ETC/tls" cert key renew_seconds
  cert="$dir/cert.pem"
  key="$dir/key.pem"
  renew_seconds=$((TLS_RENEW_BEFORE_DAYS * 86400))
  install -d -m 0750 "$dir"

  if [ -f "$cert" ] && openssl x509 -in "$cert" -noout -checkend "$renew_seconds" >/dev/null &&
    openssl x509 -in "$cert" -noout -ext subjectAltName 2>/dev/null | grep -q "DNS:${DOMAIN}"; then
    log "TLS-Zertifikat gültig bis $(openssl x509 -in "$cert" -noout -enddate | cut -d= -f2)"
    return
  fi

  if [ "$(timedatectl show -p NTPSynchronized --value)" != yes ] && [ "${FORCE_TLS:-0}" != 1 ]; then
    warn "Uhr nicht per NTP synchronisiert → Zertifikat wird NICHT erzeugt (FORCE_TLS=1 zum Erzwingen)"
    return
  fi

  log "TLS-Zertifikat erzeugen ($TLS_DAYS Tage, $DOMAIN / $AP_IP)"
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes \
    -keyout "$key.new" -out "$cert.new" \
    -subj "/CN=${DOMAIN}/O=Einlass-Kontrolle" \
    -not_before "$(date -u -d '-1 day' +%Y%m%d%H%M%SZ)" -days "$TLS_DAYS" \
    -addext "subjectAltName=DNS:${DOMAIN},IP:${AP_IP}" \
    -addext "basicConstraints=critical,CA:FALSE" \
    -addext "keyUsage=critical,digitalSignature" \
    -addext "extendedKeyUsage=serverAuth" 2>/dev/null
  chmod 0600 "$key.new"
  chmod 0644 "$cert.new"
  mv "$key.new" "$key"
  mv "$cert.new" "$cert"
  log "Zertifikat gültig bis $(openssl x509 -in "$cert" -noout -enddate | cut -d= -f2)"
}
