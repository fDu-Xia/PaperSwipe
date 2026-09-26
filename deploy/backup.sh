#!/bin/sh
# Run from repository root on the Linux deployment host.
set -eu
umask 077
destination="backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$destination"
docker compose stop app
trap 'docker compose start app' EXIT HUP INT TERM
docker compose cp -a app:/app/data "$destination/data"
printf 'Backup saved to %s/data; copy to encrypted off-server storage.\n' "$destination"
