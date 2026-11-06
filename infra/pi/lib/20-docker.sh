#!/bin/bash
# Docker Engine + Compose-Plugin aus dem offiziellen Docker-Repository.

step_docker() {
  if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
    log "Docker-Repository einrichten"
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    # shellcheck source=/dev/null
    local codename
    codename=$(. /etc/os-release && echo "$VERSION_CODENAME")
    write_if_changed /etc/apt/sources.list.d/docker.list <<LIST || true
deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${codename} stable
LIST
    apt-get update -qq
    log "Docker installieren"
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
      docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
  else
    log "Docker ist bereits installiert"
  fi

  # Logs begrenzen (SD-Karte schonen)
  if write_if_changed /etc/docker/daemon.json <<'JSON'; then
{
  "log-driver": "local",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
    log "Docker-Konfiguration geändert → Neustart"
    systemctl restart docker
  fi
  systemctl enable --now docker >/dev/null

  if [ -n "${SUDO_USER:-}" ] && ! id -nG "$SUDO_USER" | grep -qw docker; then
    log "Benutzer $SUDO_USER zur Gruppe docker hinzufügen"
    usermod -aG docker "$SUDO_USER"
  fi
}
