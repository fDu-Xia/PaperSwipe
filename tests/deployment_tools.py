"""Exercise release control flow with a fake Docker CLI; never contact a server."""
import hashlib
import io
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "deploy" / "release-server.sh"
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


DOCKER = r'''#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" >> "$MOCK_LOG"
case "$1" in
  inspect)
    if [[ "$*" == *'.Mounts'* ]]; then
      if [[ "$MOCK_SCENARIO" == wrong_volume ]]; then
        echo 'volume other_data /app/data'
      else
        echo 'volume paperswipe-beta_app_data /app/data'
      fi
    elif [[ -f "$MOCK_ROOT/switched" ]]; then
      if [[ "$MOCK_SCENARIO" == wrong_image ]]; then echo sha256:wrong; else echo sha256:new; fi
    else
      echo sha256:old
    fi
    ;;
  image)
    if [[ "$2" == inspect ]]; then echo sha256:new; fi
    ;;
  build)
    if [[ "$MOCK_SCENARIO" == build_fail ]]; then exit 31; fi
    ;;
  compose)
    shift 5
    case "$1" in
      config)
        if [[ "${2:-}" == --images ]]; then
          if [[ "$MOCK_SCENARIO" == wrong_config ]]; then
            echo paperswipe-beta:old
          else
            echo "paperswipe-beta:$RELEASE_TAG"
            echo caddy:2-alpine
          fi
        fi
        ;;
      cp)
        if [[ "$MOCK_SCENARIO" == copy_fail ]]; then exit 32; fi
        mkdir -p "${@: -1}"
        ;;
      up)
        if [[ "${2:-}" == --help ]]; then
          echo '--wait --wait-timeout'
        else
          touch "$MOCK_ROOT/switched"
          if [[ "$MOCK_SCENARIO" == unhealthy ]]; then exit 33; fi
        fi
        ;;
      stop|start|ps) ;;
      *) echo "Unexpected compose call: $*" >&2; exit 98 ;;
    esac
    ;;
  exec) echo '{"status":"ok"}' ;;
  *) echo "Unexpected docker call: $*" >&2; exit 99 ;;
esac
'''


@unittest.skipUnless(BASH, "Bash required (Git Bash on Windows)")
class ReleaseControlFlow(unittest.TestCase):
    def run_release(self, scenario="success", bad_hash=False):
        temporary = tempfile.TemporaryDirectory(prefix="paperswipe-release-test-")
        self.addCleanup(temporary.cleanup)
        base = Path(temporary.name)
        (base / "deploy").mkdir()
        (base / ".env.beta").write_text("TEST_ONLY=1\n")
        (base / "compose.public.yaml").write_text("# fake configuration\n")
        (base / "deploy" / "Caddyfile").write_text("# fake proxy\n")
        archive_name = "paperswipe-update-20261015-120000-a1b2c3.tar.gz"
        archive = base / archive_name
        with tarfile.open(archive, "w:gz") as packed:
            for name in ("Dockerfile", "go.mod", "main.go", "web/login.html", "web/locales.js", "web/i18n.js"):
                content = b"test fixture\n"
                entry = tarfile.TarInfo(name)
                entry.size = len(content)
                packed.addfile(entry, io.BytesIO(content))
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        if bad_hash:
            digest = "0" * 64
        binaries = base / "bin"
        binaries.mkdir()
        docker = binaries / "docker"
        docker.write_text(DOCKER, encoding="utf-8", newline="\n")
        docker.chmod(0o755)
        # Git Bash has no flock. This stub tests rejection, not OS lock semantics.
        flock = binaries / "flock"
        flock.write_text('#!/usr/bin/env bash\n[[ "$MOCK_SCENARIO" != locked ]]\n', newline="\n")
        flock.chmod(0o755)
        source = TEMPLATE.read_text(encoding="utf-8")
        self.assertEqual(source.count("base_dir='/opt/paperswipe-beta'"), 1)
        source = source.replace("base_dir='/opt/paperswipe-beta'", "base_dir='" + shell_path(base) + "'")
        source = "export PATH='" + shell_path(binaries) + "':\"$PATH\"\n" + source
        runner = base / "runner.sh"
        runner.write_text(source, encoding="utf-8", newline="\n")
        env = os.environ.copy()
        env.update(MOCK_ROOT=shell_path(base), MOCK_LOG=shell_path(base / "calls.log"), MOCK_SCENARIO=scenario)
        result = subprocess.run(
            [BASH, "--noprofile", "--norc", shell_path(runner), archive_name, digest],
            capture_output=True, text=True, env=env, timeout=30,
        )
        calls = (base / "calls.log").read_text() if (base / "calls.log").exists() else ""
        return result, calls, base

    def test_success_and_backup_before_switch(self):
        result, calls, base = self.run_release()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("DEPLOYMENT SUCCESS", result.stdout)
        self.assertLess(calls.index("build -t"), calls.index("stop app"))
        self.assertLess(calls.index("cp -a"), calls.index("up -d"))
        self.assertIn("--no-deps --no-build --force-recreate --wait", calls)
        records = list((base / "backups").glob("*/release.txt"))
        self.assertEqual(len(records), 1)
        self.assertIn("DATA_BACKUP_COMPLETE=yes", records[0].read_text())
        self.assertIn("DEPLOYMENT_SUCCESS=yes", records[0].read_text())

    def test_bad_hash_does_not_call_docker(self):
        result, calls, _ = self.run_release(bad_hash=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(calls, "")

    def test_preflight_guards(self):
        for scenario in ("wrong_volume", "wrong_config", "locked"):
            with self.subTest(scenario=scenario):
                result, calls, _ = self.run_release(scenario)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn("build -t", calls)
                self.assertNotIn("stop app", calls)

    def test_build_failure_leaves_old_app_running(self):
        result, calls, _ = self.run_release("build_fail")
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("stop app", calls)
        self.assertNotIn("up -d", calls)

    def test_backup_failure_restarts_old_app_without_switch(self):
        result, calls, _ = self.run_release("copy_fail")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("start app", calls)
        self.assertNotIn("up -d", calls)
        self.assertIn("stage=data-backup", result.stderr)

    def test_unhealthy_reports_explicit_rollback(self):
        result, _, _ = self.run_release("unhealthy")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Program rollback command", result.stderr)
        self.assertNotIn("DEPLOYMENT SUCCESS", result.stdout)

    def test_wrong_running_image_is_not_success(self):
        result, _, _ = self.run_release("wrong_image")
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("DEPLOYMENT SUCCESS", result.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
