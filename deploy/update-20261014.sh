#!/usr/bin/env bash
# One-off release for the archive whose SHA256 was verified in the Windows screenshot.
# Upload alongside the archive; run with: bash update-20261014.sh
set -Eeuo pipefail
umask 077

cd /opt/paperswipe-beta
archive='paperswipe-update-20261014-235817.tar.gz'
expected_sha='64ab79edf4d63bc14d0667d756bc34cff7c1b11b761702d97f57b7ab3df444e8'
compose=(docker compose -p paperswipe-beta -f compose.public.yaml)
backup_dir=''
rollback=''
restart_old=0

on_exit() {
    status=$?
    trap - EXIT
    if (( status != 0 )); then
        printf '\nUPDATE STOPPED (exit %s). Do not delete any data.\n' "$status" >&2
        if (( restart_old )); then
            "${compose[@]}" start app || true
        fi
        if [[ -n "$backup_dir" ]]; then
            printf 'Backup directory: %s\n' "$backup_dir" >&2
        fi
        if [[ -n "$rollback" ]]; then
            printf 'Rollback command (run from /opt/paperswipe-beta):\n' >&2
            printf 'RELEASE_TAG=%q docker compose -p paperswipe-beta -f compose.public.yaml up -d --no-deps --no-build --force-recreate --wait --wait-timeout 120 app\n' "$rollback" >&2
        fi
    fi
    exit "$status"
}
trap on_exit EXIT

test -f "$archive"
test -f .env.beta
test -f deploy/Caddyfile
printf '%s  %s\n' "$expected_sha" "$archive" | sha256sum --check --strict
mounts=$(docker inspect paperswipe-beta-app-1 --format '{{range .Mounts}}{{println .Type .Name .Destination}}{{end}}')
grep -qx 'volume paperswipe-beta_app_data /app/data' <<< "$mounts"
"${compose[@]}" up --help | grep -q -- '--wait-timeout'

tag="beta-$(date -u +%Y%m%d-%H%M%S)"
export RELEASE_TAG="$tag"
"${compose[@]}" config -q
configured_images=$("${compose[@]}" config --images)
grep -Fxq "paperswipe-beta:$tag" <<< "$configured_images"

release_dir="/opt/paperswipe-beta/releases/$tag"
backup_dir="/opt/paperswipe-beta/backups/$tag"
mkdir -p /opt/paperswipe-beta/releases /opt/paperswipe-beta/backups
mkdir "$release_dir" "$backup_dir"
tar -xzf "$archive" -C "$release_dir"
test -f "$release_dir/web/locales.js"
test -f "$release_dir/web/schedule-calendar.js"
grep -q 'class="login-panel"' "$release_dir/web/login.html"

old_id=$(docker inspect paperswipe-beta-app-1 --format '{{.Image}}')
docker image tag "$old_id" "paperswipe-beta:rollback-$tag"
rollback="rollback-$tag"
cp -p .env.beta compose.public.yaml "$backup_dir/"
cp -p deploy/Caddyfile "$backup_dir/Caddyfile"
printf 'RELEASE_TAG=%s\nROLLBACK_TAG=%s\nOLD_IMAGE_ID=%s\n' "$tag" "$rollback" "$old_id" > "$backup_dir/release.txt"

printf '\nBuilding new image; existing app is still running...\n'
docker build -t "paperswipe-beta:$tag" "$release_dir"

printf '\nBriefly stopping the app for a consistent data backup...\n'
restart_old=1
"${compose[@]}" stop app
"${compose[@]}" cp -a app:/app/data "$backup_dir/data"
"${compose[@]}" start app
restart_old=0

"${compose[@]}" up -d --no-deps --no-build --force-recreate --wait --wait-timeout 120 app
expected_id=$(docker image inspect "paperswipe-beta:$tag" --format '{{.Id}}')
actual_id=$(docker inspect paperswipe-beta-app-1 --format '{{.Image}}')
test "$actual_id" = "$expected_id"
docker exec paperswipe-beta-app-1 wget -q -O - http://127.0.0.1:8080/api/health
"${compose[@]}" ps
printf '\nDEPLOYMENT SUCCESS\nVersion: %s\nBackup: %s\nRollback tag: %s\n' "$tag" "$backup_dir" "$rollback"
printf '\nPreview: https://paperswipe.site/login\n'
printf 'IMPORTANT: future compose up commands must explicitly set RELEASE_TAG=%s\n' "$tag"
