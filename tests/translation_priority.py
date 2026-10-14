"""Controlled translation latency lab. No real account/model or user data.
390x844 desktop Edge emulating phone viewport, unthrottled CPU/network,
cold per-run cache, deterministic mock latency 100ms + 90ms per segment.
This measures front-text readiness, NOT real DeepSeek latency or field CWV.
"""
import json, os, statistics, threading, time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
requests = []
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
    def reply(self,data):
        self.send_response(200); self.send_header('Content-Type','application/json'); self.end_headers()
        try: self.wfile.write(json.dumps(data).encode())
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError): pass
    def do_GET(self):
        if self.path.startswith('/api/'): return self.reply({'papers':[],'user':'lab','ai_enabled':False})
        return super().do_GET()
    def do_POST(self):
        data=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        requests.append(data)
        time.sleep(.1+.09*len(data.get('texts',[])))
        self.reply({'translations':['检索证据能够减少错误回答。' for _ in data.get('texts',[])]})

server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'web')))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        channel=os.environ.get('PAPERSWIPE_TEST_BROWSER','msedge')
        browser=p.chromium.launch(headless=True,**({} if channel == 'chromium' else {'channel':channel}))
        durations=[]; batches=[]
        for i in range(3):
            page=browser.new_page(viewport={'width':390,'height':844})
            page.goto(f'http://127.0.0.1:{server.server_port}'); page.wait_for_load_state('networkidle')
            requests.clear()
            started=time.perf_counter()
            page.evaluate("""() => {
              document.body.classList.remove('is-onboarding');elements.onboarding.hidden=true;
              state.started=true;state.papers=Array.from({length:3},(_,i)=>({id:'p'+i,title:'Evidence for retrieval '+i,fields:['Information Retrieval'],digest:{hook:'Checking evidence reduces invented answers '+i,problem:'Incorrect answers are common '+i,method:'Retrieve evidence before answering '+i,result:'Measured error rates decreased '+i,novelty:['Separate retrieval from generation '+i],why_keep:'Evidence can be verified '+i,audience:'Readers who need accurate answers '+i}}));state.index=0;renderCard();
            }""")
            page.wait_for_function("document.querySelector('#card .card-subtitle').textContent === '检索证据能够减少错误回答。'")
            durations.append(round((time.perf_counter()-started)*1000)); batches.append(len(requests[0]['texts']))
            page.close()
        print(json.dumps({'browser':browser.version,'runs_ms':durations,'median_ms':statistics.median(durations),'first_batch_segments':batches}))
        if os.getenv('PAPERSWIPE_ASSERT_PRIORITY'):
            assert max(batches) <= 2, batches
        browser.close()
finally: server.shutdown();server.server_close()
