#!/usr/bin/env bash
set -euo pipefail

# Cloud Agent install script for skintwinnector.
# Idempotent: safe to run repeatedly and against cached/partially-prepared state.

# 1. Install MongoDB 8.0 (system dependency) if not already present.
if ! command -v mongod >/dev/null 2>&1; then
  curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc \
    | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor --yes
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" \
    | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y mongodb-org
fi

# 2. Prepare the MongoDB data and log directories.
sudo mkdir -p /data/db /var/log/mongodb
sudo chown -R "$(id -u)":"$(id -g)" /data/db /var/log/mongodb

# 3. Move into the skintwinnector repository (the workspace checks out
#    multiple repos, so resolve the correct one explicitly).
REPO_DIR="/agent/repos/skintwinnector"
if [ ! -d "$REPO_DIR" ]; then
  REPO_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
cd "$REPO_DIR"

# 4. Seed a local .env for development if one is not already present.
#    Real Stripe keys can be supplied via Cursor secrets to unlock the full
#    Stripe Connect experience; these placeholders let the app build and run.
if [ ! -f .env ]; then
  cat > .env <<ENVEOF
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-sk_test_placeholder}"
STRIPE_PUBLIC_KEY="${STRIPE_PUBLIC_KEY:-pk_test_placeholder}"
STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_placeholder}"
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=\$STRIPE_PUBLIC_KEY
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-dev-only-secret-change-me}"
PORT=3000
SECRET=\$NEXTAUTH_SECRET
MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017/skintwin}"
ENVEOF
fi

# 5. Install Node dependencies from the lockfile.
cd "$REPO_DIR"
yarn install --frozen-lockfile
