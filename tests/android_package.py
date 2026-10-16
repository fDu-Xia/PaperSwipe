"""Check a built APK against current shared UI without reading credentials."""
from pathlib import Path
from zipfile import ZipFile
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
apk = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'mobile/android/app/build/outputs/apk/debug/app-debug.apk'
with ZipFile(apk) as package:
    assert package.testzip() is None, 'Corrupt APK ZIP entry'
    names = package.namelist()
    for source in (ROOT / 'web').rglob('*'):
        if not source.is_file():
            continue
        relative = source.relative_to(ROOT / 'web').as_posix()
        expected = source.read_bytes()
        if relative in ('index.html', 'login.html'):
            expected = expected.replace(b'<script src="/platform.js">', b'<script src="/native.js"></script>\n<script src="/platform.js">')
        assert package.read('assets/public/' + relative) == expected, f'Stale or missing UI: {relative}'
    expected_files = {p.relative_to(ROOT / 'web').as_posix() for p in (ROOT / 'web').rglob('*') if p.is_file()}
    expected_files.update(('native.js', 'cordova.js', 'cordova_plugins.js'))
    actual_files = {name.removeprefix('assets/public/') for name in names if name.startswith('assets/public/') and not name.endswith('/')}
    assert actual_files == expected_files, 'Unexpected or stale bundled public assets'
    assert not any('/.env' in name or name.endswith(('state.json', '.keystore', '.jks')) for name in names), 'Private files in APK'
    config = json.loads(package.read('assets/capacitor.config.json'))
    assert config['appId'] == 'site.paperswipe.app'
    assert 'url' not in config.get('server', {}), 'Remote page wrapper is not allowed'
    assert config['server']['androidScheme'] == 'https'
    assert config['android']['allowMixedContent'] is False
    assert b'SessionVault' in package.read('assets/public/native.js')
print('PASS: APK integrity, exact current UI, local assets, secure configuration and no private file payloads')
