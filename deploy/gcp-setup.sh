#!/usr/bin/env bash
# Sets up CodeSynq on a fresh Debian/Ubuntu VM (e.g. a Google Cloud e2-micro):
# swap, Docker, the repo, and the production stack with HTTPS.
#
#   curl -fsSL https://raw.githubusercontent.com/sarvesh-raam/codesynq/main/deploy/gcp-setup.sh | bash
#
# Optional: DOMAIN=code.example.com RUNTIMES="python node gcc java go" before `bash`.
# Re-running it updates the code and restarts the stack.
set -euo pipefail

REPO=https://github.com/sarvesh-raam/codesynq.git
DIR="$HOME/codesynq"

# 1 GB of RAM is not enough to build the client or compile Java; add swap.
if ! sudo swapon --show | grep -q /swapfile; then
  echo "==> Adding 2 GB swap"
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

if ! command -v git >/dev/null; then
  echo "==> Installing git"
  sudo apt-get update -qq && sudo apt-get install -y -qq git
fi

if ! command -v docker >/dev/null; then
  echo "==> Installing Docker"
  curl -fsSL https://get.docker.com | sudo sh
fi

if [ -d "$DIR/.git" ]; then
  echo "==> Updating code"
  git -C "$DIR" pull --ff-only
else
  echo "==> Cloning repo"
  git clone "$REPO" "$DIR"
fi
cd "$DIR"

if [ -z "${DOMAIN:-}" ]; then
  IP=$(curl -fsS -H 'Metadata-Flavor: Google' \
    http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip 2>/dev/null \
    || curl -fsS https://api.ipify.org)
  # sslip.io resolves 34-12-56-78.sslip.io to 34.12.56.78, so no domain is needed.
  DOMAIN="${IP//./-}.sslip.io"
fi

cat > .env <<EOF
DOMAIN=$DOMAIN
RUNTIMES=${RUNTIMES:-python node gcc java}
EOF

echo "==> Building and starting (the first build takes several minutes)"
sudo docker compose -f docker-compose.prod.yml up -d --build

echo
echo "CodeSynq is starting at https://$DOMAIN"
echo "Language runtimes install in the background; follow with:"
echo "  cd $DIR && sudo docker compose -f docker-compose.prod.yml logs -f runtimes"
