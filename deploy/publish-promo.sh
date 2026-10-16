#!/usr/bin/env bash
# Publish only the bundled public promotional page on the existing server.
# No app recreation, builds, pulls, credentials, database changes or volume deletion.
set -Eeuo pipefail
umask 077
base_dir='/opt/paperswipe-beta'
package_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
domain='intro.paperswipe.site'
expected_ip='118.89.156.215'
proxy='paperswipe-beta-proxy-1'
app='paperswipe-beta-app-1'
backup_dir=''
changed=0
need_recreate=0
previous_target=''
stage='preflight'

die() { printf 'STOP: %s\n' "$*" >&2; exit 1; }
compose() { docker compose --project-directory "$base_dir" -p paperswipe-beta -f "$base_dir/compose.public.yaml" "$@"; }
app_identity() { docker inspect "$app" --format '{{.Id}} {{.Image}} {{.State.StartedAt}}'; }

on_exit() {
    status=$?
    trap - EXIT
    if (( status != 0 )); then
        printf '\nDEPLOYMENT STOPPED: %s (exit %s)\n' "$stage" "$status" >&2
        if (( changed )); then
            printf 'Restoring previous proxy configuration and website...\n' >&2
            set +e
            rollback_ok=1
            # Write in place: the existing Caddyfile is a single-file bind mount.
            cat "$backup_dir/compose.public.yaml" > "$base_dir/compose.public.yaml" || rollback_ok=0
            cat "$backup_dir/Caddyfile" > "$base_dir/deploy/Caddyfile" || rollback_ok=0
            if [[ -n "$previous_target" ]]; then
                ln -s "$previous_target" "$base_dir/website/.rollback-$release_id" &&
                    mv -Tf "$base_dir/website/.rollback-$release_id" "$base_dir/website/current" || rollback_ok=0
            elif [[ -L "$base_dir/website/current" ]]; then
                # Only the new current symlink; release files and backups remain.
                rm -- "$base_dir/website/current" || rollback_ok=0
            fi
            if (( need_recreate )); then
                compose up -d --no-deps --no-build --pull never --force-recreate proxy || rollback_ok=0
            else
                # A stopped/broken proxy cannot reload: recreate only this service.
                if [[ $(docker inspect "$proxy" --format '{{.State.Running}}') != true ]] ||
                   ! docker exec "$proxy" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
                    compose up -d --no-deps --no-build --pull never --force-recreate proxy || rollback_ok=0
                fi
            fi
            rollback_healthy=0
            for attempt in {1..8}; do
                if curl -fsS --connect-timeout 3 --max-time 8 --resolve paperswipe.site:443:127.0.0.1 https://paperswipe.site/api/health >/dev/null 2>&1; then
                    rollback_healthy=1; break
                fi
                sleep 2
            done
            (( rollback_healthy )) || rollback_ok=0
            [[ $(app_identity) == "$app_before" ]] || rollback_ok=0
            [[ $(docker inspect "$proxy" --format '{{.Image}}') == "$proxy_before" ]] || rollback_ok=0
            if (( rollback_ok )); then
                printf 'Previous configuration restored. Check https://paperswipe.site/login.\n' >&2
            else
                printf 'ROLLBACK NEEDS ATTENTION. Send this output to the team; do not delete containers or volumes.\n' >&2
            fi
        fi
        [[ -z "$backup_dir" ]] || printf 'Backup: %s\n' "$backup_dir" >&2
    fi
    exit "$status"
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for cmd in docker flock curl getent sha256sum awk grep cmp cp find readlink; do command -v "$cmd" >/dev/null || die "Missing command: $cmd"; done
cd "$base_dir"
exec 9> .deploy.lock
flock -n 9 || die 'Another deployment is running.'
for file in .env.beta compose.public.yaml deploy/Caddyfile; do [[ -f "$file" ]] || die "Missing $file"; done
[[ -d "$package_dir/site/paperswipe-assets" && -f "$package_dir/site/index.html" && -f "$package_dir/SHA256SUMS" ]] || die 'Incomplete upload package.'
[[ -z "$(find "$package_dir/site" -type l -print -quit)" ]] || die 'Symlinks are not allowed in the public payload.'
(cd "$package_dir" && sha256sum --check --strict SHA256SUMS)
grep -Fq 'trending-user-20261015.png' "$package_dir/site/index.html" || die 'The latest screenshot is missing.'
grep -Fq 'https://beian.miit.gov.cn/' "$package_dir/site/index.html" || die 'The ICP link is missing.'

ips=$(getent ahostsv4 "$domain" | awk '{print $1}' | sort -u) || true
[[ "$ips" == "$expected_ip" ]] || die "First add the DNS A record: intro -> $expected_ip (domain $domain)."
ipv6=$(getent hosts "$domain" | awk '$1 ~ /:/ {print $1}' | sort -u) || true
[[ -z "$ipv6" ]] || die 'Unexpected IPv6 DNS record for intro. Check DNS before continuing.'
[[ $(docker inspect "$proxy" --format '{{.State.Running}}') == true ]] || die 'The existing proxy is not running.'
[[ $(docker inspect "$app" --format '{{.State.Running}}') == true ]] || die 'The existing app is not running.'
app_before=$(app_identity)
app_ref=$(docker inspect "$app" --format '{{.Config.Image}}')
[[ "$app_ref" == paperswipe-beta:* ]] || die 'Unexpected app image reference; ask the team to inspect it.'
export RELEASE_TAG=${app_ref#paperswipe-beta:}
proxy_before=$(docker inspect "$proxy" --format '{{.Image}}')
[[ $(docker image inspect caddy:2-alpine --format '{{.Id}}') == "$proxy_before" ]] || die 'The local Caddy image tag differs from the running proxy. No changes made.'
grep -Eq '^    image: caddy:2-alpine[[:space:]]*$' compose.public.yaml || die 'Unexpected proxy image configuration.'
mounts=$(docker inspect "$proxy" --format '{{range .Mounts}}{{println .Source .Destination .RW}}{{end}}')
grep -Fxq "$base_dir/deploy/Caddyfile /etc/caddy/Caddyfile false" <<< "$mounts" || die 'Unexpected Caddyfile mount.'
curl -fsS --connect-timeout 5 --max-time 15 --resolve paperswipe.site:443:127.0.0.1 https://paperswipe.site/api/health >/dev/null

release_id="promo-$(date -u +%Y%m%d-%H%M%S)-$$"
backup_dir="$base_dir/backups/$release_id"
mkdir -p "$base_dir/backups"
mkdir "$backup_dir"
chmod 700 "$backup_dir"
cp -p compose.public.yaml "$backup_dir/compose.public.yaml"
cp -p deploy/Caddyfile "$backup_dir/Caddyfile"
printf 'APP=%s\nPROXY_IMAGE=%s\n' "$app_before" "$proxy_before" > "$backup_dir/before.txt"

[[ ! -L "$base_dir/website" ]] || die 'website must be a real directory, not a symlink.'
if [[ -e "$base_dir/website" ]]; then
    [[ -d "$base_dir/website" && -f "$base_dir/website/.paperswipe-managed" ]] || die 'An unmanaged website directory already exists; no overwrite performed.'
fi
[[ ! -L "$base_dir/website/releases" ]] || die 'website/releases must be a real directory.'
mkdir -p "$base_dir/website/releases"
printf 'PaperSwipe public website releases\n' > "$base_dir/website/.paperswipe-managed"
chmod 755 "$base_dir/website" "$base_dir/website/releases"
if [[ -L "$base_dir/website/current" ]]; then
    previous_target=$(readlink "$base_dir/website/current")
    [[ "$previous_target" =~ ^releases/promo-[0-9]{8}-[0-9]{6}-[0-9]+$ ]] || die 'Unexpected existing website link.'
    [[ -d "$base_dir/website/$previous_target" ]] || die 'The previous website release is missing.'
elif [[ -e "$base_dir/website/current" ]]; then
    die 'website/current already exists and is not a managed symlink.'
fi
printf '%s\n' "$previous_target" > "$backup_dir/previous-website.txt"
mkdir "$base_dir/website/releases/$release_id"
cp -R "$package_dir/site/." "$base_dir/website/releases/$release_id/"
find "$base_dir/website/releases/$release_id" -type d -exec chmod 755 {} +
find "$base_dir/website/releases/$release_id" -type f -exec chmod 644 {} +

stage='prepare-and-validate'
mount_line='      - ./website:/srv/paperswipe-website:ro'
if grep -Fq '/srv/paperswipe-website' compose.public.yaml; then
    [[ $(grep -Fxc "$mount_line" compose.public.yaml) == 1 ]] || die 'Unexpected website mount configuration.'
    cp compose.public.yaml "$backup_dir/compose.next.yaml"
else
    awk -v addition="$mount_line" '
        /^  proxy:$/ {proxy=1}
        proxy && /^  [^ ]/ && !/^  proxy:$/ {proxy=0}
        {print}
        proxy && $0 == "      - ./deploy/Caddyfile:/etc/caddy/Caddyfile:ro" {print addition; n++}
        END {if(n != 1) exit 1}
    ' compose.public.yaml > "$backup_dir/compose.next.yaml" || die 'Could not safely locate the proxy volume list.'
    need_recreate=1
fi
if ! grep -Fxq "$base_dir/website /srv/paperswipe-website false" <<< "$mounts"; then need_recreate=1; fi

begin_count=$(grep -c '^# BEGIN PAPERSWIPE PROMO$' deploy/Caddyfile || true)
end_count=$(grep -c '^# END PAPERSWIPE PROMO$' deploy/Caddyfile || true)
[[ "$begin_count" == "$end_count" && "$begin_count" -le 1 ]] || die 'Invalid managed Caddy block.'
awk '/^# BEGIN PAPERSWIPE PROMO$/ {skip=1;next} /^# END PAPERSWIPE PROMO$/ {skip=0;next} !skip {print} END {if(skip) exit 1}' deploy/Caddyfile > "$backup_dir/Caddyfile.next"
if grep -Fq "$domain" "$backup_dir/Caddyfile.next"; then die 'An unmanaged intro site already exists; no overwrite performed.'; fi
cat >> "$backup_dir/Caddyfile.next" <<'CADDY'

# BEGIN PAPERSWIPE PROMO
intro.paperswipe.site {
    root * /srv/paperswipe-website/current
    encode zstd gzip
    header X-Content-Type-Options "nosniff"
    @html path / /index.html
    header @html Cache-Control "no-cache"
    file_server
}
# END PAPERSWIPE PROMO
CADDY
docker compose --project-directory "$base_dir" -p paperswipe-beta -f "$backup_dir/compose.next.yaml" config -q
docker exec -i "$proxy" caddy validate --config - --adapter caddyfile < "$backup_dir/Caddyfile.next"

stage='activate-proxy-only'
printf '\nValidated. Activating the website; the app container and data stay unchanged.\n'
if (( need_recreate )); then printf 'The proxy will briefly restart to mount the public website directory.\n'; fi
changed=1
cat "$backup_dir/compose.next.yaml" > compose.public.yaml
cat "$backup_dir/Caddyfile.next" > deploy/Caddyfile
ln -s "releases/$release_id" "$base_dir/website/.current-$release_id"
mv -Tf "$base_dir/website/.current-$release_id" "$base_dir/website/current"
if (( need_recreate )); then
    compose up -d --no-deps --no-build --pull never --force-recreate proxy
else
    docker exec "$proxy" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
fi
[[ $(app_identity) == "$app_before" ]] || die 'The app identity changed unexpectedly.'
[[ $(docker inspect "$proxy" --format '{{.Image}}') == "$proxy_before" ]] || die 'The proxy image changed unexpectedly.'

stage='verify-https'
verified=0
for attempt in {1..12}; do
    printf 'Checking HTTPS (%s/12)...\n' "$attempt"
    if curl -fsS --connect-timeout 3 --max-time 8 --resolve "$domain:443:127.0.0.1" "https://$domain/" -o "$backup_dir/served-index.html" 2> "$backup_dir/https-check.log" &&
       cmp -s "$backup_dir/served-index.html" "$package_dir/site/index.html" &&
       curl -fsS --connect-timeout 3 --max-time 8 --resolve paperswipe.site:443:127.0.0.1 https://paperswipe.site/api/health > /dev/null 2>> "$backup_dir/https-check.log"; then
        verified=1; break
    fi
    sleep 3
done
(( verified )) || die 'HTTPS or existing app health check failed. Restoring the previous proxy.'
[[ $(app_identity) == "$app_before" ]] || die 'The app identity changed unexpectedly.'
printf 'PROMO_DEPLOYMENT_SUCCESS=yes\n' > "$backup_dir/result.txt"
changed=0
printf '\nPROMO DEPLOYMENT SUCCESS\nWebsite: https://%s/\nBackup: %s\nThe existing app container and user data were not changed.\n' "$domain" "$backup_dir"
