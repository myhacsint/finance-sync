#!/bin/sh
set -eu

# The image carries a fresh signature set. Keep it current in the background;
# document processing itself fails closed if the database becomes stale.
freshclam --quiet || true
freshclam --daemon --foreground=true --checks=24 >/tmp/finance-freshclam.log 2>&1 &

exec node --experimental-sqlite dist/server.js
