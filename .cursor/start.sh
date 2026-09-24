#!/usr/bin/env bash
set -euo pipefail

# Cloud Agent start script for skintwinnector.
# Runs on every boot: brings up MongoDB and waits until it is ready.
# Idempotent: detects an already-running server and cleans up stale locks.

sudo mkdir -p /data/db /var/log/mongodb
sudo chown -R "$(id -u)":"$(id -g)" /data/db /var/log/mongodb

if ! mongosh --quiet --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1; then
  # Clean up any stale lock from a previous boot.
  rm -f /data/db/mongod.lock
  mongod --dbpath /data/db --bind_ip 127.0.0.1 --port 27017 \
    --logpath /var/log/mongodb/mongod.log --fork
fi

# Wait until MongoDB is ready to accept connections.
for i in $(seq 1 30); do
  if mongosh --quiet --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1; then
    echo "MongoDB is ready."
    break
  fi
  sleep 1
done
