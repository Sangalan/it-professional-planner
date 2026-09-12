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
INCLUDE_DATA="${INCLUDE_DATA:-false}"
BUILD_ID="${BUILD_ID:-$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short=12 HEAD 2>/dev/null || printf 'sin-git')}"

if [[ -z "$TARGET_SERVER" ]]; then
  echo "Falta TARGET_SERVER. Ejemplo: TARGET_SERVER=203.0.113.10 ./scripts/build-and-upload.sh" >&2
  exit 1
fi

if [[ ! "$BUILD_ID" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "BUILD_ID solo puede contener letras, numeros, punto, guion y guion bajo." >&2
  exit 1
fi

ssh_opts=(-p "$SSH_PORT")
scp_opts=(-P "$SSH_PORT")
if [[ -n "$SSH_KEY" ]]; then
  if [[ "$SSH_KEY" == "~/"* ]]; then
    SSH_KEY="${HOME}/${SSH_KEY#"~/"}"
  fi
  if [[ ! -f "$SSH_KEY" ]]; then
    echo "No existe SSH_KEY: $SSH_KEY" >&2
    exit 1
  fi
  ssh_opts+=(-i "$SSH_KEY" -o IdentitiesOnly=yes -o BatchMode=yes)
  scp_opts+=(-i "$SSH_KEY" -o IdentitiesOnly=yes -o BatchMode=yes)
fi

STAGING_DIR="$(mktemp -d)"
ARCHIVE="${STAGING_DIR}/${APP_NAME}.tar.gz"

cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

echo "Compilando aplicacion..."
cd "$ROOT_DIR"
npm run build --prefix frontend

APP_STAGE="${STAGING_DIR}/${APP_NAME}"
mkdir -p "$APP_STAGE"

echo "Preparando artefacto..."
printf '{\n  "buildId": "%s"\n}\n' "$BUILD_ID" > "$APP_STAGE/build-info.json"
cp .env.example "$APP_STAGE/.env.example"
mkdir -p "$APP_STAGE/backend" "$APP_STAGE/frontend"
rsync -a \
  --exclude 'data/' \
  --exclude 'node_modules/' \
  --exclude '.DS_Store' \
  backend/ "$APP_STAGE/backend/"
cp -R frontend/dist "$APP_STAGE/frontend/dist"

mkdir -p "$APP_STAGE/backend/data"
if [[ "$INCLUDE_DATA" == "true" ]]; then
  echo "Incluyendo datos runtime de backend/data..."
  rsync -a \
    --exclude '*.sqlite-wal' \
    --exclude '*.sqlite-shm' \
    --exclude '*.bak*' \
    backend/data/ "$APP_STAGE/backend/data/"
fi

if [[ -f .env.deploy ]]; then
  cp .env.deploy "$APP_STAGE/.env"
fi

mkdir -p "$APP_STAGE/scripts"
cp scripts/server-setup.sh "$APP_STAGE/scripts/server-setup.sh"

tar -czf "$ARCHIVE" -C "$STAGING_DIR" "$APP_NAME"

echo "Subiendo artefacto a ${REMOTE_USER}@${TARGET_SERVER}:${REMOTE_DIR}..."
ssh "${ssh_opts[@]}" "${REMOTE_USER}@${TARGET_SERVER}" "mkdir -p '$REMOTE_DIR'"
scp "${scp_opts[@]}" "$ARCHIVE" "${REMOTE_USER}@${TARGET_SERVER}:${REMOTE_DIR}/${APP_NAME}.tar.gz"
scp "${scp_opts[@]}" "$ROOT_DIR/scripts/server-setup.sh" "${REMOTE_USER}@${TARGET_SERVER}:${REMOTE_DIR}/server-setup.sh"

echo "Artefacto subido: ${REMOTE_DIR}/${APP_NAME}.tar.gz (build: ${BUILD_ID})"
