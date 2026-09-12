#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "$ROOT_DIR/.env.deploy" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT_DIR/scripts/load-env.sh"
  load_env_file "$ROOT_DIR/.env.deploy"
fi

APP_NAME="${APP_NAME:-pro-plan}"
TARGET_SERVER="${TARGET_SERVER:-}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/tmp/${APP_NAME}-deploy}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"
APP_DIR="${APP_DIR:-/opt/${APP_NAME}}"
SERVICE_NAME="${SERVICE_NAME:-${APP_NAME}}"
SERVICE_USER="${SERVICE_USER:-${APP_NAME}}"
PORT="${PORT:-3101}"
INSTALL_NGINX="${INSTALL_NGINX:-false}"
DOMAIN="${DOMAIN:-}"
TLS_EMAIL="${TLS_EMAIL:-}"
ENABLE_TLS="${ENABLE_TLS:-false}"
INCLUDE_DATA="${INCLUDE_DATA:-false}"
SYNC_ENV="${SYNC_ENV:-false}"
NODE_MAJOR="${NODE_MAJOR:-24}"

if [[ -z "$TARGET_SERVER" ]]; then
  echo "Falta TARGET_SERVER. Ejemplo: TARGET_SERVER=203.0.113.10 DOMAIN=tienda.example.com INSTALL_NGINX=true ./scripts/deploy.sh" >&2
  exit 1
fi

if [[ "$ENABLE_TLS" == "true" && "$INSTALL_NGINX" != "true" ]]; then
  echo "ENABLE_TLS=true requiere INSTALL_NGINX=true." >&2
  exit 1
fi

ssh_opts=(-p "$SSH_PORT")
if [[ -n "$SSH_KEY" ]]; then
  if [[ "$SSH_KEY" == "~/"* ]]; then
    SSH_KEY="${HOME}/${SSH_KEY#"~/"}"
  fi
  if [[ ! -f "$SSH_KEY" ]]; then
    echo "No existe SSH_KEY: $SSH_KEY" >&2
    exit 1
  fi
  ssh_opts+=(-i "$SSH_KEY" -o IdentitiesOnly=yes -o BatchMode=yes)
fi

if [[ "$INSTALL_NGINX" == "true" && -n "$DOMAIN" ]]; then
  resolved_ip="$(dig +short A "$DOMAIN" | tail -n 1 || true)"
  if [[ -n "$resolved_ip" && "$resolved_ip" != "$TARGET_SERVER" ]]; then
    echo "Aviso: ${DOMAIN} resuelve a ${resolved_ip}, no a ${TARGET_SERVER}." >&2
  fi
fi

TARGET_SERVER="$TARGET_SERVER" \
REMOTE_USER="$REMOTE_USER" \
REMOTE_DIR="$REMOTE_DIR" \
SSH_PORT="$SSH_PORT" \
SSH_KEY="$SSH_KEY" \
APP_NAME="$APP_NAME" \
INCLUDE_DATA="$INCLUDE_DATA" \
"$ROOT_DIR/scripts/build-and-upload.sh"

remote_env=(
  "APP_NAME=$APP_NAME"
  "ZIP=$REMOTE_DIR/$APP_NAME.tar.gz"
  "APP_DIR=$APP_DIR"
  "SERVICE_NAME=$SERVICE_NAME"
  "SERVICE_USER=$SERVICE_USER"
  "PORT=$PORT"
  "HEALTH_PATH=${HEALTH_PATH:-/api/health}"
  "INSTALL_NGINX=$INSTALL_NGINX"
  "DOMAIN=$DOMAIN"
  "TLS_EMAIL=$TLS_EMAIL"
  "ENABLE_TLS=$ENABLE_TLS"
  "SYNC_ENV=$SYNC_ENV"
  "NODE_MAJOR=$NODE_MAJOR"
)

printf -v remote_prefix '%q ' "${remote_env[@]}"

ssh "${ssh_opts[@]}" "${REMOTE_USER}@${TARGET_SERVER}" "${remote_prefix} bash '$REMOTE_DIR/server-setup.sh'"

if [[ "$INSTALL_NGINX" == "true" && -n "$DOMAIN" ]]; then
  if [[ "$ENABLE_TLS" == "true" ]]; then
    echo "URL: https://${DOMAIN}"
  else
    echo "URL: http://${DOMAIN}"
  fi
else
  echo "URL: http://${TARGET_SERVER}:${PORT}"
fi
