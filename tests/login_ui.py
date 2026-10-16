"""Login layout and state tests on an isolated mock server; no real credentials."""
import json
import os
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('TEMP', str(ROOT))) / 'paperswipe-ui-review'
OUT.mkdir(exist_ok=True)
calls = []
login_status = 401

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
    def do_GET(self):
        if self.path == '/':
            self.send_response(200); self.send_header('Content-Type','text/html'); self.end_headers()
            self.wfile.write(b'<h1>Signed in (mock)</h1>'); return
        super().do_GET()
    def do_POST(self):
        calls.append(json.loads(self.rfile.read(int(self.headers['Content-Length']))))
        time.sleep(.4)
        self.send_response(login_status); self.send_header('Content-Type','application/json'); self.end_headers()
        self.wfile.write(b'{}')

server = ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'web')))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
  with sync_playwright() as p:
    channel = os.environ.get('PAPERSWIPE_TEST_BROWSER','msedge')
    engines = [('edge' if channel != 'chromium' else 'chromium',lambda:p.chromium.launch(headless=True,**({} if channel == 'chromium' else {'channel':channel})))]
    if os.environ.get('PAPERSWIPE_TEST_WEBKIT') == '1': engines.append(('webkit',lambda:p.webkit.launch(headless=True)))
    for engine, launch in engines:
      browser = launch()
      try:
        calls.clear(); login_status = 401
        page = browser.new_page(viewport={'width':390,'height':844},has_touch=True,color_scheme='dark')
        errors=[]; page.on('pageerror',lambda error:errors.append(str(error)))
        base=f'http://127.0.0.1:{server.server_port}'
        page.goto(base+'/login.html');page.wait_for_load_state('networkidle')
        assert page.locator('html').get_attribute('data-theme') == 'light', 'new users default to light'
        assert page.locator('#submit').bounding_box()['y']+page.locator('#submit').bounding_box()['height'] < 844
        assert page.locator('.info-block[open]').count() == 0
        page.screenshot(path=str(OUT/f'{engine}-login-new-mobile-zh.png'),full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), page.evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>[el.tagName,el.className,el.getBoundingClientRect().right])})")
        page.locator('#privacy-help summary').click()
        assert page.locator('#privacy-help').get_attribute('open') is not None
        assert page.locator('#privacy-help .info-content').is_visible()
        page.locator('#privacy-help summary').click()
        page.locator('#invite-help summary').focus();page.keyboard.press('Enter')
        assert page.locator('#invite-help .info-content').is_visible()
        page.locator('#invite-help summary').click()
        page.locator('[data-language="en"]').click()
        assert page.locator('#token-label').inner_text() == 'Invite code'
        assert page.locator('.paper-mark, .panel-heading, #entry-title').count() == 0
        assert page.locator('#invite-help summary').inner_text() == 'Need an invite code?'
        page.set_viewport_size({'width':1440,'height':900})
        page.wait_for_timeout(350)
        page.screenshot(path=str(OUT/f'{engine}-login-new-desktop-en.png'),full_page=True)
        # Small screen, expanded disclosures, dark preference, and reduced motion.
        page.evaluate("localStorage.setItem('paperswipe-appearance-v1','dark')")
        page.reload();page.wait_for_load_state('networkidle')
        page.set_viewport_size({'width':320,'height':568})
        page.emulate_media(reduced_motion='reduce')
        assert page.locator('html').get_attribute('data-theme') == 'dark'
        page.locator('#privacy-help summary').click()
        page.locator('#invite-help summary').click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
        assert page.locator('.login-layout').evaluate('el=>getComputedStyle(el).animationName') == 'none'
        page.screenshot(path=str(OUT/f'{engine}-login-new-small-dark.png'),full_page=True)
        # Invalid local input never sends a login request.
        page.locator('#token').fill('too-short')
        page.locator('#submit').click()
        assert page.locator('#token').get_attribute('aria-invalid') == 'true'
        assert '64-character' in page.locator('#error').inner_text()
        assert not calls
        page.locator('#token').fill('a'*64)
        assert page.locator('#error').inner_text() == ''
        assert page.locator('#token').get_attribute('data-complete') == 'true'
        page.locator('#reveal').click()
        assert page.locator('#token').get_attribute('type') == 'text'
        assert page.locator('#reveal').get_attribute('aria-label') == 'Hide invite code'
        page.locator('#reveal').click()
        page.locator('#submit').click()
        assert page.locator('#submit').is_disabled()
        assert page.locator('#login').get_attribute('aria-busy') == 'true'
        assert page.locator('#token').evaluate('el=>el.readOnly')
        page.evaluate("document.querySelector('#login').dispatchEvent(new Event('submit',{cancelable:true}))")
        page.wait_for_function("!document.querySelector('#submit').disabled")
        assert len(calls) == 1, 'pending submit must not send duplicate requests'
        assert 'Invalid or revoked' in page.locator('#error').inner_text()
        login_status = 429
        page.locator('#submit').click();page.wait_for_function("!document.querySelector('#submit').disabled")
        assert 'Too many attempts' in page.locator('#error').inner_text()
        page.route('**/api/login',lambda route:route.abort())
        page.locator('#submit').click();page.wait_for_function("!document.querySelector('#submit').disabled")
        assert 'Unable to reach' in page.locator('#error').inner_text()
        page.unroute('**/api/login')
        assert not page.evaluate("Object.values(localStorage).some(value=>value.includes('a'.repeat(64)))")
        login_status = 200
        page.locator('#submit').click();page.wait_for_url(base+'/')
        assert page.locator('h1').inner_text() == 'Signed in (mock)'
        assert not errors, errors
        print(f'PASS {engine}: login layout/themes/languages; disclosures; reduced motion; validation; reveal; duplicate guard; 401/429/offline; successful redirect')
      finally: browser.close()
finally: server.shutdown();server.server_close()
print(f'Screenshots: {OUT}')
