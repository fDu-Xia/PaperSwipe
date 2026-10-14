"""Isolated browser regression test; no real accounts, model calls or disk data.
Run: python tests/mobile_stability.py (requires playwright and Edge).
"""
import json
import os
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
paper = {"id": "test-paper", "title": "Evidence for better answers", "authors": [],
         "digest": {"hook": "先查资料再回答，能减少编造答案。"}}
schedule = {}
fail_action = False
fail_schedule = False
action_calls = 0

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def respond(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        if self.path.startswith('/api/'):
            if self.path == '/api/library':
                return self.respond(200, {"papers": [{"paper": paper, "action": "save"}], "schedule": schedule})
            return self.respond(200, {"user": "test", "ai_enabled": False})
        return super().do_GET()

    def do_POST(self):
        global action_calls
        data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if self.path == '/api/actions':
            action_calls += 1
            return self.respond(500 if fail_action else 200, {"error": "模拟保存失败"} if fail_action else {"ok": True})
        if self.path == '/api/schedule':
            if fail_schedule:
                return self.respond(500, {"error": "模拟写盘失败"})
            item = schedule.setdefault(data.pop('paper_id'), {})
            item.update(data)
            return self.respond(200, {"schedule": schedule})
        return self.respond(404, {})

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT / 'web')))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        channel = os.environ.get('PAPERSWIPE_TEST_BROWSER', 'msedge')
        browser = p.chromium.launch(headless=True, **({} if channel == 'chromium' else {'channel': channel}))
        try:
            page = browser.new_page(viewport={"width": 390, "height": 844}, has_touch=True)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(f'http://127.0.0.1:{server.server_port}')
            page.wait_for_load_state('networkidle')
            page.wait_for_function("typeof state !== 'undefined' && !!elements.card")
            page.evaluate("document.body.classList.remove('is-onboarding'); elements.onboarding.hidden=true; state.started=true")
            page.evaluate('refreshLibrary()')
            # Save, reload, recover exact manual date and priority.
            page.evaluate("state.actionPaperId='test-paper'; state.scheduleDraftPriority='high'; assignPaperToDate('2026-10-20')")
            assert schedule['test-paper']['date'] == '2026-10-20'
            page.reload()
            page.wait_for_load_state('networkidle')
            page.evaluate('refreshLibrary()')
            assert page.evaluate("state.weekPlanAssign.get('test-paper')") == '2026-10-20'
            assert page.evaluate("state.weekPlanPriority.get('test-paper')") == 'high'
            # A failed write leaves local and server state unchanged.
            fail_schedule = True
            assert not page.evaluate("saveSchedulePatch('test-paper',{date:'2026-11-01'})")
            assert page.evaluate("state.weekPlanAssign.get('test-paper')") == '2026-10-20'
            fail_schedule = False
            page.evaluate("handleWeekPlanAction('test-paper','done')")
            assert schedule['test-paper']['done']
            page.evaluate("handleWeekPlanAction('test-paper','remove')")
            assert schedule['test-paper']['removed']
            assert page.evaluate('state.library.length') == 1
            # Explore shares the same lifecycle: tap flips, cancellation resets,
            # and a deliberate swipe writes once and advances once.
            # This fixture skips startApp (and its search request), so bind the
            # gestures that startApp normally installs once after onboarding.
            page.evaluate("document.body.classList.remove('is-onboarding'); elements.onboarding.hidden=true; state.started=true; bindCardGestures(); state.papers=[state.library[0].paper,{...state.library[0].paper,id:'second'}]; state.index=0; renderCard()")
            main_card = page.locator('#card')
            box = main_card.bounding_box()
            x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
            page.touchscreen.tap(x, y)
            assert page.evaluate('isFlipped')
            page.evaluate('unflip()')
            page.wait_for_timeout(500)
            before = action_calls
            page.mouse.move(x, y)
            page.mouse.down()
            page.mouse.move(x + 120, y, steps=5)
            main_card.dispatch_event('pointercancel', {"pointerId": 1, "isPrimary": True})
            page.mouse.up()
            assert page.evaluate('state.index') == 0
            assert action_calls == before
            page.wait_for_timeout(550)
            page.mouse.move(x, y)
            page.mouse.down()
            page.mouse.move(x + 120, y, steps=5)
            page.mouse.up()
            page.wait_for_function('state.index === 1 && !state.actionBusy')
            assert action_calls == before + 1
            # Failed Trending saves neither advance nor report success.
            page.evaluate("document.body.classList.remove('is-onboarding'); elements.onboarding.hidden=true; state.started=true; openTrendPaperOverlay(Object.keys(TRENDING_TOPIC_PAPERS)[0],0)")
            fail_action = True
            page.evaluate("trendOverlayFly('save')")
            assert page.evaluate('trendOverlayState.index') == 0
            assert '未保存' in page.locator('#toast').inner_text()
            fail_action = False
            # Browser cancellation must never submit a swipe.
            card = page.locator('#trend-overlay-card')
            page.wait_for_timeout(500)
            box = card.bounding_box()
            x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
            before = action_calls
            page.mouse.move(x, y)
            page.mouse.down()
            page.mouse.move(x + 120, y, steps=5)
            card.dispatch_event('pointercancel', {"pointerId": 1, "isPrimary": True})
            page.mouse.up()
            page.wait_for_timeout(400)
            assert action_calls == before
            assert page.evaluate('trendOverlayState.index') == 0
            # Rapid duplicate taps are coalesced by the view's busy guard.
            page.evaluate("Promise.all([trendOverlayFly('save'),trendOverlayFly('save')])")
            page.wait_for_timeout(400)
            assert action_calls == before + 1
            assert page.evaluate('trendOverlayState.index') == 1
            # Native back uses the same animated dismissal, then returns home.
            assert not page.evaluate("document.dispatchEvent(new Event('paperswipe:back',{cancelable:true}))")
            page.wait_for_function("document.querySelector('#trend-overlay').hidden")
            page.evaluate("switchView('library')")
            assert not page.evaluate("document.dispatchEvent(new Event('paperswipe:back',{cancelable:true}))")
            assert page.evaluate('state.activeView') == 'discover'
            before = action_calls
            page.evaluate("document.dispatchEvent(new Event('paperswipe:resume'))")
            page.wait_for_function('!nativeResumeBusy')
            assert action_calls == before
            assert not errors, errors
            print('PASS: schedule recovery/failure/removal; Explore touch tap/swipe; failed save; pointer cancellation; duplicate action guard')
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()
