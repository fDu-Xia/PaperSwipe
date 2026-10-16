"""Catch missing front-end scripts and broken repository documentation links."""
from html.parser import HTMLParser
from pathlib import Path
import re
import unittest
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = []

    def handle_starttag(self, tag, attrs):
        if tag == 'script' and dict(attrs).get('src'):
            self.sources.append(dict(attrs)['src'])


class StructureTests(unittest.TestCase):
    def test_application_scripts_exist_and_modules_load_before_bootstrap(self):
        parser = Scripts()
        parser.feed((ROOT / 'web/index.html').read_text(encoding='utf-8'))
        for src in parser.sources:
            self.assertTrue((ROOT / 'web' / src.lstrip('/')).is_file(), src)
        for module in ['/bibliography.js', '/event-stream.js', '/mockdata/trends.js']:
            self.assertEqual(parser.sources.count(module), 1)
            self.assertLess(parser.sources.index(module), parser.sources.index('/bootstrap.js'))

    def test_local_navigation_links_resolve(self):
        files = [ROOT / 'README.md', ROOT / 'archive/README.md',
                 ROOT / 'deploy/README.md', ROOT / 'deploy/TEAM_TESTING.md',
                 *sorted((ROOT / 'docs').glob('*.md'))]
        for document in files:
            text = document.read_text(encoding='utf-8')
            links = re.findall(r'\]\(([^\s)]+)\)', text) + re.findall(r'<img[^>]+src="([^"]+)"', text)
            for link in links:
                url = urlsplit(link)
                if url.scheme or not url.path:
                    continue
                target = document.parent / unquote(url.path)
                self.assertTrue(target.exists(), f'{document.relative_to(ROOT)}: {link}')


if __name__ == '__main__':
    unittest.main()
