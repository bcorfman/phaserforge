#!/usr/bin/env bash
set -euo pipefail

IMAGE_TAG="phaserforge-playwright:1.60.0-node26"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not installed or not on PATH" >&2
  exit 1
fi

if ! docker image inspect "$IMAGE_TAG" >/dev/null 2>&1; then
  docker build -f Dockerfile.playwright -t "$IMAGE_TAG" .
fi

RUN_ARGS=(
  --rm
  --init
  --ipc=host
  -e CI=1
  -e HOME=/tmp/phaserforge-home
  -e PW_PROJECTS=webkit
  --user "$(id -u):$(id -g)"
  -v "$PWD:/work"
  -v "${HOME}/.npm:/tmp/phaserforge-home/.npm"
  -w /work
)

PLAYWRIGHT_ARGS=""
if [[ "$#" -gt 0 ]]; then
  printf -v PLAYWRIGHT_ARGS '%q ' "$@"
fi

docker run "${RUN_ARGS[@]}" "$IMAGE_TAG" bash -lc \
  "mkdir -p \"\$HOME/.npm\" && if [ ! -d node_modules/@playwright/test ]; then npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000; fi && node scripts/playwright-no-deprecation.cjs test --project=webkit ${PLAYWRIGHT_ARGS}"
