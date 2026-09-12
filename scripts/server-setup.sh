#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-pro-plan}"
ZIP="${ZIP:-/tmp/${APP_NAME}-deploy/${APP_NAME}.tar.gz}"
APP_DIR="${APP_DIR:-/opt/${APP_NAME}}"
SERVICE_NAME="${SERVICE_NAME:-${APP_NAME}}"
SERVICE_USER="${SERVICE_USER:-${APP_NAME}}"
PORT="${PORT:-3001}"
HEALTH_PATH="${HEALTH_PATH:-/api/health}"
INSTALL_NGINX="${INSTALL_NGINX:-false}"
DOMAIN="${DOMAIN:-}"
TLS_EMAIL="${TLS_EMAIL:-}"
ENABLE_TLS="${ENABLE_TLS:-false}"
SYNC_ENV="${SYNC_ENV:-false}"
NODE_MAJOR="${NODE_MAJOR:-24}"

if [[ "$(id -u)" -ne 0 ]]; then
  exec sudo -E bash "$0" "$@"
fi

if [[ ! -f "$ZIP" ]]; then
  echo "No existe el artefacto: $ZIP" >&2
  exit 1
fi

if [[ "$INSTALL_NGINX" == "true" && -z "$DOMAIN" ]]; then
  echo "INSTALL_NGINX=true requiere DOMAIN." >&2
  exit 1
fi

if [[ "$ENABLE_TLS" == "true" && -z "$TLS_EMAIL" ]]; then
  echo "ENABLE_TLS=true requiere TLS_EMAIL." >&2
  exit 1
fi

if [[ "$SERVICE_USER" == "root" ]]; then
  echo "SERVICE_USER no puede ser root. Usa un usuario de sistema dedicado, por ejemplo ${APP_NAME}." >&2
  exit 1
fi

echo "Instalando dependencias de sistema..."
apt-get update
apt-get install -y ca-certificates curl tar rsync build-essential python3

if ! command -v node >/dev/null 2>&1 || ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= Number(process.env.NODE_MAJOR || '$NODE_MAJOR') ? 0 : 1)"; then
  echo "Instalando Node.js ${NODE_MAJOR}.x..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

if [[ "$INSTALL_NGINX" == "true" ]]; then
  apt-get install -y nginx
fi

if [[ "$ENABLE_TLS" == "true" ]]; then
  apt-get install -y certbot python3-certbot-nginx
fi

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Descomprimiendo artefacto..."
tar -xzf "$ZIP" -C "$TMP_DIR"

mkdir -p "$APP_DIR"
if [[ -d "$APP_DIR/backend/data" ]]; then
  mkdir -p "$TMP_DIR/preserved-data"
  rsync -a "$APP_DIR/backend/data/" "$TMP_DIR/preserved-data/"
fi

rsync -a --delete \
  --exclude '.env' \
  --exclude 'backend/data/' \
  "$TMP_DIR/${APP_NAME}/" "$APP_DIR/"

mkdir -p "$APP_DIR/backend/data"
if [[ -d "$TMP_DIR/preserved-data" ]]; then
  rsync -a "$TMP_DIR/preserved-data/" "$APP_DIR/backend/data/"
else
  rsync -a "$TMP_DIR/${APP_NAME}/backend/data/" "$APP_DIR/backend/data/"
fi

if [[ "$SYNC_ENV" == "true" && -f "$TMP_DIR/${APP_NAME}/.env" ]]; then
  cp "$TMP_DIR/${APP_NAME}/.env" "$APP_DIR/.env"
  echo "Actualizado $APP_DIR/.env desde el artefacto (SYNC_ENV=true)."
elif [[ ! -f "$APP_DIR/.env" ]]; then
  if [[ -f "$TMP_DIR/${APP_NAME}/.env" ]]; then
    cp "$TMP_DIR/${APP_NAME}/.env" "$APP_DIR/.env"
  else
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    echo "Se creo $APP_DIR/.env desde .env.example. Revisa secretos y dominios antes de exponer la app." >&2
  fi
fi

chown -R root:root "$APP_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/backend/data"
find "$APP_DIR/backend/data" -xdev -type d -exec chmod 0700 {} +
find "$APP_DIR/backend/data" -xdev -type f -exec chmod 0600 {} +
chmod 0755 "$APP_DIR"

echo "Instalando dependencias Node de produccion..."
cd "$APP_DIR/backend"
npm ci --omit=dev
chown -R root:root "$APP_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/backend/data"
find "$APP_DIR/backend/data" -xdev -type d -exec chmod 0700 {} +
find "$APP_DIR/backend/data" -xdev -type f -exec chmod 0600 {} +
chown root:"$SERVICE_USER" "$APP_DIR/.env"
chmod 0640 "$APP_DIR/.env"

cat >"/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=IT Professional Planner
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${APP_DIR}/backend
Environment=NODE_ENV=production
Environment=PORT=${PORT}
EnvironmentFile=-${APP_DIR}/.env
ExecStart=/usr/bin/node ${APP_DIR}/backend/server.js
Restart=always
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=${APP_DIR}/backend/data

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

if [[ "$INSTALL_NGINX" == "true" ]]; then
  cat >"/etc/nginx/sites-available/${SERVICE_NAME}" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 300m;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
        proxy_send_timeout 300;
    }
}
EOF
  ln -sfn "/etc/nginx/sites-available/${SERVICE_NAME}" "/etc/nginx/sites-enabled/${SERVICE_NAME}"
  nginx -t
  systemctl reload nginx

  if [[ "$ENABLE_TLS" == "true" ]]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$TLS_EMAIL" --redirect

    # SSE mantiene una conexión abierta por pestaña. Sin HTTP/2 los navegadores
    # pueden agotar su pequeño límite de conexiones HTTP/1.1 por origen y dejar
    # las llamadas REST en pending aunque Express siga sano.
    nginx_site="/etc/nginx/sites-available/${SERVICE_NAME}"
    sed -i 's/listen 443 ssl;/listen 443 ssl http2;/' "$nginx_site"
    nginx -t
    systemctl reload nginx
  fi
fi

echo "Verificando salud..."
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}${HEALTH_PATH}" >/dev/null; then
    echo "Despliegue completado correctamente."
    exit 0
  fi
  sleep 1
done

systemctl status "$SERVICE_NAME" --no-pager || true
journalctl -u "$SERVICE_NAME" -n 80 --no-pager || true
echo "La app no respondio en ${HEALTH_PATH}." >&2
exit 1
