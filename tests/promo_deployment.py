"""Offline control-flow tests for promotional publishing; never contact Docker or a server."""

import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from types import SimpleNamespace
import unittest


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "deploy" / "publish-promo.sh"
BASH = os.environ.get("PAPERSWIPE_TEST_BASH") or shutil.which("bash")
if not BASH and os.name == "nt":
    git = shutil.which("git")
    if git:
        candidate = Path(git).parent.parent / "bin" / "bash.exe"
        if candidate.is_file():
            BASH = str(candidate)


def shell_path(path):
    value = Path(path).resolve().as_posix()
    if os.name == "nt":
        return "/" + value[0].lower() + value[2:]
    return value


COMPOSE = """services:
  app:
    image: paperswipe-beta:${RELEASE_TAG:-old-default}
    restart: unless-stopped
    env_file: .env.beta
    volumes:
      - app_data:/app/data
  proxy:
    image: caddy:2-alpine
    restart: unless-stopped
    env_file: .env.beta
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deploy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      app:
        condition: service_healthy
volumes:
  app_data:
  caddy_data:
  caddy_config:
"""
CADDY = """{$PUBLIC_ORIGIN} {
    header Strict-Transport-Security "max-age=31536000"
    reverse_proxy app:8080
}
"""

DOCKER = r'''#!/usr/bin/env bash
set -eu
printf 'docker %s\n' "$*" >> "$MOCK_LOG"
case "$1" in
  inspect)
    target=$2
    format=${@: -1}
    case "$format" in
      *'.State.Running'*)
        if [[ "$target" == paperswipe-beta-proxy-1 && -f "$MOCK_ROOT/proxy-stopped" ]]; then
          echo false
        else
          echo true
        fi
        ;;
      *'.State.Health.Status'*) echo healthy ;;
      *'.State.StartedAt'*) echo 'app-id sha256:app-running 2026-10-14T00:00:00Z' ;;
      *'.Config.Image'*) echo 'paperswipe-beta:beta-20261014-161533' ;;
      *'.Mounts'*)
        printf '%s/deploy/Caddyfile /etc/caddy/Caddyfile false\n' "$MOCK_ROOT"
        if [[ -f "$MOCK_ROOT/mounted" ]]; then
          printf '%s/website /srv/paperswipe-website false\n' "$MOCK_ROOT"
        fi
        ;;
      *'.Image'*) echo 'sha256:caddy-running' ;;
      *) echo "Unexpected Docker inspect format: $format" >&2; exit 95 ;;
    esac
    ;;
  image)
    [[ "$2" == inspect && "$3" == caddy:2-alpine ]] || exit 96
    if [[ "$MOCK_SCENARIO" == wrong_proxy_image ]]; then
      echo sha256:different
    else
      echo sha256:caddy-running
    fi
    ;;
  compose)
    shift
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --project-directory|-p|-f) shift 2 ;;
        *) break ;;
      esac
    done
    case "$1" in
      config)
        [[ "$MOCK_SCENARIO" != compose_invalid ]] || exit 41
        ;;
      up)
        [[ "${@: -1}" == proxy ]] || { echo 'Forbidden app mutation' >&2; exit 97; }
        [[ " $* " == *' --no-deps '* && " $* " == *' --no-build '* && " $* " == *' --pull never '* ]] || exit 98
        [[ "$RELEASE_TAG" == beta-20261014-161533 ]] || exit 99
        count=0
        [[ ! -f "$MOCK_ROOT/up-count" ]] || read -r count < "$MOCK_ROOT/up-count"
        count=$((count + 1))
        printf '%s\n' "$count" > "$MOCK_ROOT/up-count"
        [[ ! -f "$MOCK_ROOT/proxy-stopped" ]] || rm "$MOCK_ROOT/proxy-stopped"
        if grep -Fq '/srv/paperswipe-website' "$MOCK_ROOT/compose.public.yaml"; then
          touch "$MOCK_ROOT/mounted"
        elif [[ -f "$MOCK_ROOT/mounted" ]]; then
          rm "$MOCK_ROOT/mounted"
        fi
        if [[ "$MOCK_SCENARIO" == proxy_fail && "$count" == 1 ]]; then exit 42; fi
        ;;
      *) echo "Unexpected Docker compose call: $*" >&2; exit 94 ;;
    esac
    ;;
  exec)
    shift
    [[ "${1:-}" != -i ]] || shift
    [[ "$1" == paperswipe-beta-proxy-1 && "$2" == caddy ]] || exit 93
    case "$3" in
      validate)
        cat >/dev/null
        [[ "$MOCK_SCENARIO" != caddy_invalid ]] || exit 43
        ;;
      reload)
        count=0
        [[ ! -f "$MOCK_ROOT/reload-count" ]] || read -r count < "$MOCK_ROOT/reload-count"
        count=$((count + 1))
        printf '%s\n' "$count" > "$MOCK_ROOT/reload-count"
        if [[ "$MOCK_SCENARIO" == reload_fail && "$count" == 1 ]]; then exit 44; fi
        if [[ "$MOCK_SCENARIO" == reload_both_fail && "$count" -le 2 ]]; then exit 44; fi
        if [[ "$MOCK_SCENARIO" == proxy_stopped_on_reload && "$count" == 1 ]]; then
          touch "$MOCK_ROOT/proxy-stopped"
          exit 44
        fi
        ;;
      *) echo "Unexpected caddy command: $*" >&2; exit 92 ;;
    esac
    ;;
  *) echo "Forbidden/unexpected Docker call: $*" >&2; exit 91 ;;
esac
'''

CURL = r'''#!/usr/bin/env bash
set -eu
printf 'curl %s\n' "$*" >> "$MOCK_LOG"
output=''
url=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--output) output=$2; shift 2 ;;
    --connect-timeout|--max-time|--resolve) shift 2 ;;
    https://*) url=$1; shift ;;
    *) shift ;;
  esac
done
case "$url" in
  https://paperswipe.site/api/health)
    [[ "$MOCK_SCENARIO" != unhealthy_before ]] || exit 7
    if [[ "$MOCK_SCENARIO" == rollback_health_fail && -f "$MOCK_ROOT/up-count" ]]; then
      read -r count < "$MOCK_ROOT/up-count"
      [[ "$count" -lt 2 ]] || exit 7
    fi
    printf '{"status":"ok"}\n'
    ;;
  https://intro.paperswipe.site/)
    [[ "$MOCK_SCENARIO" != tls_fail && "$MOCK_SCENARIO" != rollback_health_fail ]] || exit 60
    [[ -n "$output" ]] || exit 90
    if [[ "$MOCK_SCENARIO" == wrong_content ]]; then
      printf '<html>wrong website</html>\n' > "$output"
    else
      cp "$MOCK_PACKAGE/site/index.html" "$output"
    fi
    ;;
  *) echo "Unexpected URL: $url" >&2; exit 89 ;;
esac
'''

GETENT = r'''#!/usr/bin/env bash
set -eu
printf 'getent %s\n' "$*" >> "$MOCK_LOG"
[[ "$2" == intro.paperswipe.site ]] || exit 88
[[ "$MOCK_SCENARIO" != dns_missing ]] || exit 2
case "$1" in
  ahostsv4)
    if [[ "$MOCK_SCENARIO" == dns_wrong ]]; then
      echo '192.0.2.1 STREAM intro.paperswipe.site'
    else
      echo '118.89.156.215 STREAM intro.paperswipe.site'
    fi
    ;;
  hosts)
    if [[ "$MOCK_SCENARIO" == dns_ipv6 ]]; then
      echo '2001:db8::1 STREAM intro.paperswipe.site'
    else
      echo '118.89.156.215 STREAM intro.paperswipe.site'
    fi
    ;;
  *) exit 87 ;;
esac
'''


@unittest.skipUnless(BASH, "Bash required (Git Bash on Windows)")
class PromoDeploymentControlFlow(unittest.TestCase):
    def fixture(self):
        temporary = tempfile.TemporaryDirectory(prefix="paperswipe-promo-test-")
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        base = root / "server"
        package = root / "package"
        binaries = root / "bin"
        (base / "deploy").mkdir(parents=True)
        (package / "site" / "paperswipe-assets").mkdir(parents=True)
        binaries.mkdir()
        (base / ".env.beta").write_text("PUBLIC_ORIGIN=https://paperswipe.site\n", encoding="utf-8", newline="\n")
        (base / "compose.public.yaml").write_text(COMPOSE, encoding="utf-8", newline="\n")
        (base / "deploy" / "Caddyfile").write_text(CADDY, encoding="utf-8", newline="\n")
        payload = {
            "index.html": '<html><img src="paperswipe-assets/trending-user-20261015.png"><a href="https://beian.miit.gov.cn/">粤ICP备2026152562号-1</a></html>\n',
            "paperswipe-assets/trending-user-20261015.png": "offline screenshot fixture\n",
            "paperswipe-assets/product-demo-20261015.mp4": "offline video fixture\n",
        }
        manifest = []
        for relative, content in payload.items():
            path = package / "site" / relative
            path.write_text(content, encoding="utf-8", newline="\n")
            manifest.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  site/{relative}\n")
        (package / "SHA256SUMS").write_text("".join(manifest), encoding="utf-8", newline="\n")
        mocks = {
            "docker": DOCKER,
            "curl": CURL,
            "getent": GETENT,
            "flock": '#!/usr/bin/env bash\n[[ "$MOCK_SCENARIO" != locked ]]\n',
            "sleep": '#!/usr/bin/env bash\nprintf "sleep %s\\n" "$*" >> "$MOCK_LOG"\n',
            "wget": '#!/usr/bin/env bash\necho "Unexpected network tool" >&2\nexit 86\n',
        }
        for name, content in mocks.items():
            path = binaries / name
            path.write_text(content, encoding="utf-8", newline="\n")
            path.chmod(0o755)
        source = TEMPLATE.read_text(encoding="utf-8")
        self.assertEqual(source.count("base_dir='/opt/paperswipe-beta'"), 1)
        source = source.replace("base_dir='/opt/paperswipe-beta'", "base_dir='" + shell_path(base) + "'")
        source = "export PATH='" + shell_path(binaries) + "':\"$PATH\"\n" + source
        runner = package / "publish-promo.sh"
        runner.write_text(source, encoding="utf-8", newline="\n")
        return SimpleNamespace(root=root, base=base, package=package, runner=runner, log=root / "calls.log")

    def run_publish(self, fixture, scenario="success"):
        env = os.environ.copy()
        env.update(
            MOCK_ROOT=shell_path(fixture.base),
            MOCK_PACKAGE=shell_path(fixture.package),
            MOCK_LOG=shell_path(fixture.log),
            MOCK_SCENARIO=scenario,
            MSYS="winsymlinks:nativestrict",
        )
        result = subprocess.run(
            [BASH, "--noprofile", "--norc", shell_path(fixture.runner)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=env,
            timeout=45,
        )
        calls = fixture.log.read_text(encoding="utf-8") if fixture.log.exists() else ""
        self.assert_safe_docker_calls(calls)
        return result, calls

    def assert_safe_docker_calls(self, calls):
        for line in calls.splitlines():
            if not line.startswith("docker "):
                continue
            self.assertNotRegex(line, r"^docker (build|pull|rm|rmi|volume)\b")
            if line.startswith("docker compose "):
                self.assertNotRegex(line, r"\b(down|restart|stop|start|build|pull)\s+(app|proxy)\b")
                if " up " in line:
                    self.assertTrue(line.endswith(" proxy"), line)
                    self.assertIn("--no-deps --no-build --pull never", line)
            elif "paperswipe-beta-app-1" in line:
                self.assertTrue(line.startswith("docker inspect "), line)

    def assert_original_config(self, fixture):
        self.assertEqual((fixture.base / "compose.public.yaml").read_text(encoding="utf-8"), COMPOSE)
        self.assertEqual((fixture.base / "deploy" / "Caddyfile").read_text(encoding="utf-8"), CADDY)
        self.assertEqual((fixture.base / ".env.beta").read_text(encoding="utf-8"), "PUBLIC_ORIGIN=https://paperswipe.site\n")

    def test_success_preserves_app_and_installs_public_payload(self):
        fixture = self.fixture()
        result, calls = self.run_publish(fixture)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PROMO DEPLOYMENT SUCCESS", result.stdout)
        self.assertEqual(calls.count(" up -d "), 1)
        current = fixture.base / "website" / "current"
        self.assertTrue(current.is_symlink())
        self.assertEqual((current / "index.html").read_bytes(), (fixture.package / "site" / "index.html").read_bytes())
        self.assertEqual((fixture.base / "compose.public.yaml").read_text().count("./website:/srv/paperswipe-website:ro"), 1)
        self.assertEqual((fixture.base / "deploy" / "Caddyfile").read_text().count("# BEGIN PAPERSWIPE PROMO"), 1)
        self.assertIn(CADDY.strip(), (fixture.base / "deploy" / "Caddyfile").read_text())
        backups = list((fixture.base / "backups").glob("promo-*"))
        self.assertEqual(len(backups), 1)
        self.assertEqual((backups[0] / "compose.public.yaml").read_text(), COMPOSE)
        self.assertEqual((backups[0] / "Caddyfile").read_text(), CADDY)
        self.assertEqual((backups[0] / "result.txt").read_text(), "PROMO_DEPLOYMENT_SUCCESS=yes\n")

    def test_dns_guards_do_not_mutate_production(self):
        for scenario in ("dns_missing", "dns_wrong", "dns_ipv6"):
            with self.subTest(scenario=scenario):
                fixture = self.fixture()
                result, calls = self.run_publish(fixture, scenario)
                self.assertNotEqual(result.returncode, 0)
                self.assert_original_config(fixture)
                self.assertNotIn("docker ", calls)
                self.assertFalse((fixture.base / "website").exists())

    def test_validation_failures_do_not_mutate_production(self):
        for scenario in ("compose_invalid", "caddy_invalid"):
            with self.subTest(scenario=scenario):
                fixture = self.fixture()
                result, calls = self.run_publish(fixture, scenario)
                self.assertNotEqual(result.returncode, 0)
                self.assert_original_config(fixture)
                self.assertNotIn(" up ", calls)
                self.assertNotIn("caddy reload", calls)
                self.assertFalse((fixture.base / "website" / "current").exists())

    def test_proxy_start_failure_restores_original_config(self):
        fixture = self.fixture()
        result, calls = self.run_publish(fixture, "proxy_fail")
        self.assertNotEqual(result.returncode, 0)
        self.assert_original_config(fixture)
        self.assertEqual(calls.count(" up -d "), 2)
        self.assertIn("Previous configuration restored", result.stderr)
        self.assertFalse((fixture.base / "website" / "current").exists())

    def test_tls_or_content_failure_restores_original_config(self):
        for scenario in ("tls_fail", "wrong_content"):
            with self.subTest(scenario=scenario):
                fixture = self.fixture()
                result, calls = self.run_publish(fixture, scenario)
                self.assertNotEqual(result.returncode, 0)
                self.assert_original_config(fixture)
                self.assertEqual(calls.count(" up -d "), 2)
                self.assertIn("Previous configuration restored", result.stderr)
                self.assertFalse((fixture.base / "website" / "current").exists())
                self.assertNotIn("PROMO DEPLOYMENT SUCCESS", result.stdout)

    def test_repeat_publish_does_not_duplicate_config_or_recreate_proxy(self):
        fixture = self.fixture()
        first, _ = self.run_publish(fixture)
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        old_target = (fixture.base / "website" / "current").readlink()
        second, calls = self.run_publish(fixture)
        self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
        self.assertNotEqual((fixture.base / "website" / "current").readlink(), old_target)
        self.assertEqual(calls.count(" up -d "), 1)
        self.assertEqual(calls.count("caddy reload"), 1)
        self.assertEqual((fixture.base / "compose.public.yaml").read_text().count("./website:/srv/paperswipe-website:ro"), 1)
        self.assertEqual((fixture.base / "deploy" / "Caddyfile").read_text().count("# BEGIN PAPERSWIPE PROMO"), 1)

    def test_later_failure_restores_previous_release(self):
        fixture = self.fixture()
        first, _ = self.run_publish(fixture)
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        old_target = (fixture.base / "website" / "current").readlink()
        old_compose = (fixture.base / "compose.public.yaml").read_bytes()
        old_caddy = (fixture.base / "deploy" / "Caddyfile").read_bytes()
        second, calls = self.run_publish(fixture, "tls_fail")
        self.assertNotEqual(second.returncode, 0)
        self.assertEqual((fixture.base / "website" / "current").readlink(), old_target)
        self.assertEqual((fixture.base / "compose.public.yaml").read_bytes(), old_compose)
        self.assertEqual((fixture.base / "deploy" / "Caddyfile").read_bytes(), old_caddy)
        self.assertEqual(calls.count(" up -d "), 1)
        self.assertEqual(calls.count("caddy reload"), 2)

    def test_misc_preflight_guards_do_not_activate_proxy(self):
        for scenario in ("locked", "wrong_proxy_image", "unhealthy_before"):
            with self.subTest(scenario=scenario):
                fixture = self.fixture()
                result, calls = self.run_publish(fixture, scenario)
                self.assertNotEqual(result.returncode, 0)
                self.assert_original_config(fixture)
                self.assertNotIn(" up ", calls)

    def test_unmanaged_website_is_not_overwritten(self):
        fixture = self.fixture()
        website = fixture.base / "website"
        website.mkdir()
        sentinel = website / "user-file.txt"
        sentinel.write_text("unrelated user content", encoding="utf-8")
        result, calls = self.run_publish(fixture)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unmanaged website directory", result.stderr)
        self.assert_original_config(fixture)
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "unrelated user content")
        self.assertFalse((website / ".paperswipe-managed").exists())
        self.assertNotIn(" up ", calls)

    def test_rollback_health_failure_reports_attention_not_success(self):
        fixture = self.fixture()
        result, calls = self.run_publish(fixture, "rollback_health_fail")
        self.assertNotEqual(result.returncode, 0)
        self.assert_original_config(fixture)
        self.assertEqual(calls.count(" up -d "), 2)
        self.assertIn("ROLLBACK NEEDS ATTENTION", result.stderr)
        self.assertNotIn("Previous configuration restored", result.stderr)
        self.assertNotIn("PROMO DEPLOYMENT SUCCESS", result.stdout)

    def test_reload_failure_recovers_previous_site_even_if_proxy_stops(self):
        for scenario in ("reload_fail", "reload_both_fail", "proxy_stopped_on_reload"):
            with self.subTest(scenario=scenario):
                fixture = self.fixture()
                first, _ = self.run_publish(fixture)
                self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
                old_target = (fixture.base / "website" / "current").readlink()
                old_caddy = (fixture.base / "deploy" / "Caddyfile").read_bytes()
                second, calls = self.run_publish(fixture, scenario)
                self.assertNotEqual(second.returncode, 0)
                self.assertEqual((fixture.base / "website" / "current").readlink(), old_target)
                self.assertEqual((fixture.base / "deploy" / "Caddyfile").read_bytes(), old_caddy)
                self.assertIn("Previous configuration restored", second.stderr)
                self.assertNotIn("PROMO DEPLOYMENT SUCCESS", second.stdout)
                expected_up_count = 1 if scenario == "reload_fail" else 2
                self.assertEqual(calls.count(" up -d "), expected_up_count)

    def test_tampered_payload_is_rejected_before_dns_or_docker(self):
        fixture = self.fixture()
        with (fixture.package / "site" / "index.html").open("ab") as payload:
            payload.write(b"tampered")
        result, calls = self.run_publish(fixture)
        self.assertNotEqual(result.returncode, 0)
        self.assert_original_config(fixture)
        self.assertEqual(calls, "")


if __name__ == "__main__":
    unittest.main(verbosity=2)
