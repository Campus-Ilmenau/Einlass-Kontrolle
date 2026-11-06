# syntax=docker/dockerfile:1
# Reverse-Proxy (Build-Kontext: Repository-Wurzel)
# TLS mit dem self-signed Zertifikat des Pi, /api → API-Container, / → Web-App.
# Solange es noch keine Web-App gibt, wird eine Platzhalterseite ausgeliefert.

FROM nginx:1.29-alpine
COPY infra/docker/proxy/nginx.conf /etc/nginx/conf.d/default.conf
COPY infra/docker/proxy/placeholder/ /usr/share/nginx/html/
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
