#!/usr/bin/env bash
# Template used by New-Release.ps1. Runs only when explicitly invoked on server.
set -Eeuo pipefail
umask 077
base_dir='/opt/paperswipe-beta'
archive=${1:?Usage: bash release-server.sh ARCHIVE SHA256}
expected_sha=${2:?Missing SHA256}
[[ "$archive" =~ ^paperswipe-update-[0-9]{8}-[0-9]{6}-[0-9a-f]{6}\.tar\.gz$ ]] || { echo 'Invalid archive filename'; exit 1; }
[[ "$expected_sha" =~ ^[0-9a-f]{64}$ ]] || { echo 'Invalid SHA256'; exit 1; }
cd "$base_dir"
compose=(docker compose -p paperswipe-beta -f compose.public.yaml)
backup_dir=''
rollback=''
restart_old=0
stage='preflight'

on_exit() {
    status=$?
    trap - EXIT
    if (( status != 0 )); then
        printf '\nUPDATE STOPPED: stage=%s exit=%s\n' "$stage" "$status" >&2
        if (( restart_old )); then
            printf 'Trying to restart the original container...\n' >&2
            "${compose[@]}" start app || true
        fi
        if [[ -n "$backup_dir" ]]; then
            printf 'Backup directory: %s\n' "$backup_dir" >&2
        fi
        if [[ -n "$rollback" ]]; then
            printf 'Program rollback command (does NOT restore data):\n' >&2
            printf 'cd %q && RELEASE_TAG=%q docker compose -p paperswipe-beta -f compose.public.yaml up -d --no-deps --no-build --force-recreate --wait --wait-timeout 120 app\n' "$base_dir" "$rollback" >&2
        fi
        printf 'Do not delete volumes. Read the error before retrying.\n' >&2
    fi
    exit "$status"
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for cmd in docker flock sha256sum tar; do command -v "$cmd" >/dev/null; done
exec 9> .deploy.lock
flock -n 9 || { echo 'Another deployment is running. Stop here.'; exit 1; }
for file in "$archive" .env.beta compose.public.yaml deploy/Caddyfile; do
    [[ -f "$file" ]] || { printf 'Missing file: %s\n' "$file"; exit 1; }
done
printf '%s  %s\n' "$expected_sha" "$archive" | sha256sum --check --strict
mounts=$(docker inspect paperswipe-beta-app-1 --format '{{range .Mounts}}{{println .Type .Name .Destination}}{{end}}')
grep -qx 'volume paperswipe-beta_app_data /app/data' <<< "$mounts"
up_help=$("${compose[@]}" up --help)
grep -q -- '--wait-timeout' <<< "$up_help"

tag="beta-$(date -u +%Y%m%d-%H%M%S)-$$"
export RELEASE_TAG="$tag"
"${compose[@]}" config -q
configured_images=$("${compose[@]}" config --images)
grep -Fxq "paperswipe-beta:$tag" <<< "$configured_images" || { echo 'Compose does not select the new RELEASE_TAG'; exit 1; }

stage='extract-and-build'
release_dir="$base_dir/releases/$tag"
backup_dir="$base_dir/backups/$tag"
mkdir -p "$base_dir/releases" "$base_dir/backups"
mkdir "$release_dir" "$backup_dir"
tar -xzf "$archive" -C "$release_dir"
for file in Dockerfile go.mod main.go web/login.html web/locales.js web/i18n.js; do
    [[ -f "$release_dir/$file" ]] || { printf 'Missing source: %s\n' "$file"; exit 1; }
done

old_id=$(docker inspect paperswipe-beta-app-1 --format '{{.Image}}')
docker image tag "$old_id" "paperswipe-beta:rollback-$tag"
rollback="rollback-$tag"
cp -p .env.beta compose.public.yaml "$backup_dir/"
cp -p deploy/Caddyfile "$backup_dir/Caddyfile"
printf 'RELEASE_TAG=%s\nROLLBACK_TAG=%s\nOLD_IMAGE_ID=%s\nARCHIVE=%s\nSHA256=%s\n' "$tag" "$rollback" "$old_id" "$archive" "$expected_sha" > "$backup_dir/release.txt"
printf '\nBackup directory: %s\nBuilding image; old app is still running...\n' "$backup_dir"
docker build -t "paperswipe-beta:$tag" "$release_dir"

stage='data-backup'
printf '\nBriefly stopping app to back up user data...\n'
restart_old=1
"${compose[@]}" stop app
"${compose[@]}" cp -a app:/app/data "$backup_dir/data"
test -d "$backup_dir/data"
printf 'DATA_BACKUP_COMPLETE=yes\n' >> "$backup_dir/release.txt"
"${compose[@]}" start app
restart_old=0

stage='switch-and-healthcheck'
"${compose[@]}" up -d --no-deps --no-build --force-recreate --wait --wait-timeout 120 app
expected_id=$(docker image inspect "paperswipe-beta:$tag" --format '{{.Id}}')
actual_id=$(docker inspect paperswipe-beta-app-1 --format '{{.Image}}')
test "$actual_id" = "$expected_id"
docker exec paperswipe-beta-app-1 wget -q -O - http://127.0.0.1:8080/api/health
"${compose[@]}" ps
printf 'NEW_IMAGE_ID=%s\nDEPLOYMENT_SUCCESS=yes\n' "$actual_id" >> "$backup_dir/release.txt"
printf '\nDEPLOYMENT SUCCESS\nVersion: %s\nBackup: %s\nRollback tag: %s\n' "$tag" "$backup_dir" "$rollback"
printf 'Check https://paperswipe.site/login in a private browser window.\n'
printf 'Future compose up commands MUST explicitly set RELEASE_TAG=%s\n' "$tag"
printf 'Server configuration and its default image tag were NOT changed.\n'
