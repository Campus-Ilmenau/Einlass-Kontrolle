#!/bin/bash
# Anwendung (Docker Compose): /opt/einlass mit compose.yml und .env (Geheimnisse).

APP_DIR=/opt/einlass

step_app() {
  local env_file="$APP_DIR/.env" gid
  install -d -m 0755 "$APP_DIR" "$APP_DIR/poc"
  install -m 0644 "$SCRIPT_DIR/../docker/compose.yml" "$APP_DIR/compose.yml"
  gid=$(getent group einlass | cut -d: -f3)
  [ -n "$gid" ] || die "Gruppe 'einlass' fehlt – zuerst Schritt 'hostd' ausführen"

  if [ ! -f "$env_file" ]; then
    log "Geheimnisse erzeugen: $env_file"
    install -m 0600 /dev/null "$env_file"
    cat >"$env_file" <<ENV
# Erzeugt von infra/pi/setup.sh – nicht ins Repository!
POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 48)
ADMIN_INITIAL_NAME=admin
# Nur für den allerersten Start (danach ohne Wirkung). Nach dem ersten Login ändern!
ADMIN_INITIAL_PASSWORD=$(random_password 12)
EINLASS_GID=${gid}
EINLASS_VERSION=main
EINLASS_POC_DIR=${APP_DIR}/poc
ENV
  fi
  set_config_value "$env_file" EINLASS_GID "$gid"

  local compose=(docker compose --project-directory "$APP_DIR" -f "$APP_DIR/compose.yml")
  if "${compose[@]}" pull --quiet --ignore-pull-failures 2>/dev/null; then :; fi
  if "${compose[@]}" up -d --no-build --wait --wait-timeout 180; then
    log "Anwendung läuft: https://$DOMAIN"
  else
    warn "Anwendung konnte nicht gestartet werden (Images vorhanden? 'docker compose build' im Repo oder Registry prüfen)"
    "${compose[@]}" ps
  fi
}
