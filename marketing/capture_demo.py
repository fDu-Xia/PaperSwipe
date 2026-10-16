"""Capture the current UI with explicitly fictional showcase data, no real API calls.

Run from repo: python marketing/capture_demo.py
The isolated server never opens data/state.json or any .env file.
"""
import json
from datetime import date, timedelta
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing' / 'paperswipe-assets'
OUT.mkdir(parents=True, exist_ok=True)
SCENES = [
    ('检索增强生成的证据组织', '先找到证据，再生成回答。', ['cs.AI', 'cs.CL']),
    ('智能体的长期记忆管理', '让智能体记住重要的事，而不是所有的事。', ['cs.AI', 'cs.LG']),
    ('面向阅读目标的论文推荐', '从你的研究问题出发，找到下一篇值得读的论文。', ['cs.AI', 'cs.IR']),
    ('多模态模型的视觉理解', '把图像与文字放在一起，理解它们之间的联系。', ['cs.CV', 'cs.AI']),
    ('语言模型的可靠性评估', '好的回答，不只流畅，还应该经得起核对。', ['cs.CL', 'cs.AI']),
    ('人机协作的知识整理', '让阅读记录，成为下一次探索的起点。', ['cs.HC', 'cs.AI']),
]
PAPERS = [dict(id=f'showcase-{i}', title=title, authors=[{'name':'PaperSwipe 示例团队'}],
               year=2026, venue='演示论文', source='示例', fields=fields,
               read_minutes=15+i*3, citation_count=0,
               abstract='这是用于产品界面演示的虚构论文，不代表真实研究。',
               digest={'hook':hook, 'problem':'如何在大量信息中保留与研究问题有关的证据？',
                       'method':'围绕研究目标组织信息，再逐步核对来源。',
                       'result':'此处展示结构化摘要的呈现方式，具体结论请以原文为准。',
                       'novelty':['研究问题、方法与结论分开阅读。'],
                       'why_field':'帮助快速了解一个方向的关键问题。',
                       'why_you':'适合构建主题阅读清单。', 'audience':'研究者与学习者'})
          for i,(title,hook,fields) in enumerate(SCENES)]
LIBRARY = [{'paper':paper,'action':'save' if i < 4 else 'priority'} for i,paper in enumerate(PAPERS)]
MONDAY = date.today() - timedelta(days=date.today().weekday())
SCHEDULE = {paper['id']:{'date':str(MONDAY+timedelta(days=i)), 'priority':'high' if i<2 else 'medium'}
            for i,paper in enumerate(PAPERS)}


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
    def respond(self, data):
        self.send_response(200)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
    def do_GET(self):
        if self.path.startswith('/api/'):
            if self.path == '/api/library': return self.respond({'papers':LIBRARY,'schedule':SCHEDULE})
            if self.path == '/api/stats': return self.respond({'saved':4,'priority':2,'read':0})
            if self.path == '/api/searches': return self.respond({'searches':[]})
            return self.respond({'user':'showcase-only','ai_enabled':False})
        return super().do_GET()
    def do_POST(self):
        data = json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or '{}')
        if self.path == '/api/translate':
            return self.respond({'translations':[text if any('\u3400' <= c <= '\u9fff' for c in text) else '产品演示内容' for text in data.get('texts',[])]})
        return self.respond({'ok':True, 'schedule':SCHEDULE})


def prepare(page, base):
    page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
    page.goto(base)
    page.wait_for_load_state('networkidle')
    page.wait_for_function("typeof state !== 'undefined' && !!elements.card")
    page.evaluate("""papers => {
      PaperSwipeI18n.setLanguage('zh'); applyAppearance('light');
      document.body.classList.remove('is-onboarding'); elements.onboarding.hidden=true;
      state.started=true; state.papers=papers; state.index=0;
      state.query='检索增强生成与智能体'; renderCard(); refreshLibrary();
    }""", PAPERS)
    page.wait_for_timeout(1100)


def main():
    server = ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'web')))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base=f'http://127.0.0.1:{server.server_port}'
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True,channel='msedge')
            page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1.5,has_touch=True)
            prepare(page,base)
            page.screenshot(path=str(OUT/'explore.png'))
            page.evaluate('flip()');page.wait_for_timeout(700)
            page.screenshot(path=str(OUT/'explore-back.png'))
            page.evaluate("unflip();switchView('library')");page.wait_for_timeout(900)
            page.screenshot(path=str(OUT/'library.png'))
            page.evaluate("switchView('todos')");page.wait_for_timeout(900)
            page.screenshot(path=str(OUT/'schedule.png'))
            page.locator('[data-open-week-calendar]').click();page.wait_for_timeout(450)
            page.screenshot(path=str(OUT/'calendar.png'))
            page.keyboard.press('Escape')
            page.evaluate("switchView('network')");page.wait_for_timeout(750)
            page.screenshot(path=str(OUT/'trending.png'))
            page.evaluate("openSettingsPage()");page.wait_for_timeout(500)
            page.screenshot(path=str(OUT/'settings.png'))
            page.goto(base+'/login.html');page.wait_for_load_state('networkidle')
            page.screenshot(path=str(OUT/'login.png'))
            page.close()

            context=browser.new_context(viewport={'width':390,'height':844},has_touch=True,
                                        record_video_dir=str(OUT/'recordings'),record_video_size={'width':390,'height':844})
            video_page=context.new_page()
            prepare(video_page,base)
            video_page.wait_for_timeout(1300)
            video_page.locator('#card .card-front').click();video_page.wait_for_timeout(2200)
            video_page.evaluate('unflip()');video_page.wait_for_timeout(800)
            box=video_page.locator('#card').bounding_box()
            x,y=box['x']+box['width']*.5,box['y']+box['height']*.55
            video_page.mouse.move(x,y);video_page.mouse.down()
            video_page.mouse.move(x+270,y-20,steps=25);video_page.mouse.up()
            video_page.wait_for_timeout(1800)
            video_page.locator('.bottom-nav [data-view="library"]').click();video_page.wait_for_timeout(2200)
            video_page.locator('.bottom-nav [data-view="todos"]').click();video_page.wait_for_timeout(1900)
            video_page.locator('[data-open-week-calendar]').click();video_page.wait_for_timeout(2200)
            video_page.keyboard.press('Escape');video_page.wait_for_timeout(500)
            video_page.locator('.bottom-nav [data-view="discover"]').click();video_page.wait_for_timeout(1700)
            video=video_page.video
            context.close()
            video.save_as(str(OUT/'product-demo.webm'))
            browser.close()
            print('Saved current-UI screenshots and demonstration video:',OUT)
    finally:
        server.shutdown();server.server_close()


if __name__=='__main__': main()
