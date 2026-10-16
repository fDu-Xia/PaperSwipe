"""Validate the portable marketing page; no public-site or paid API requests."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import threading
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
OUT=Path(os.environ.get('TEMP',str(ROOT)))/'paperswipe-marketing-review'
OUT.mkdir(exist_ok=True)

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_): pass

def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
      with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,channel='msedge')
        summary=[]
        for scheme,url in [('http',f'http://127.0.0.1:{server.server_port}/'),('file',(ROOT/'index.html').as_uri())]:
          for width,height in [(1440,1000),(1024,768),(390,844),(320,700)]:
            page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce')
            errors=[];failures=[]
            page.on('pageerror',lambda error: errors.append(str(error)))
            page.on('response',lambda response: failures.append((response.status,response.url)) if response.status>=400 else None)
            page.goto(url);page.wait_for_load_state('networkidle')
            # Force lazy assets into view before checking natural dimensions.
            for image in page.locator('img').all(): image.scroll_into_view_if_needed()
            page.wait_for_function('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), (width,page.evaluate('document.documentElement.scrollWidth'))
            trend=page.locator('.trend-preview img')
            assert trend.get_attribute('src').endswith('trending-user-20261015.png')
            assert trend.evaluate('(img)=>img.naturalWidth===424 && img.naturalHeight===680')
            assert trend.evaluate('''(img)=>{
              const image=img.getBoundingClientRect(), frame=img.parentElement.getBoundingClientRect();
              const caption=img.parentElement.querySelector('figcaption').getBoundingClientRect();
              return Math.abs(image.height/image.width-680/424)<0.01 && caption.top>=image.bottom-1 && frame.bottom>=caption.bottom;
            }'''), 'Trending screenshot must remain uncropped and clear of its caption'
            page.locator('#tab-back').click();page.wait_for_function("document.querySelector('#preview-image').getAttribute('src').includes('explore-back.png')")
            page.locator('#tab-back').press('ArrowDown')
            page.wait_for_function("document.querySelector('#preview-image').getAttribute('src').includes('settings.png')")
            assert page.locator('#tab-settings').get_attribute('aria-selected')=='true'
            page.locator('#tab-front').click()
            page.locator('.faq-list summary').first.click()
            assert page.locator('.faq-list details').first.get_attribute('open') is not None
            page.locator('.faq-list summary').first.click()
            page.locator('.hero-actions [data-watch]').click()
            assert page.locator('#demo-dialog').is_visible()
            page.evaluate("document.querySelector('#demo-video').load()")
            page.wait_for_function("document.querySelector('#demo-video').readyState>=2")
            assert page.evaluate("document.querySelector('#demo-video').currentSrc.endsWith('product-demo-20261015.mp4')")
            assert page.evaluate("Math.abs(document.querySelector('#demo-video').duration-54.9)<.5")
            assert page.evaluate("document.querySelector('#demo-video').videoWidth===1920 && document.querySelector('#demo-video').videoHeight===1080")
            assert page.evaluate("document.querySelector('#demo-video').paused"), 'Reduced motion must not autoplay'
            page.evaluate("document.querySelector('#demo-video').play()")
            page.wait_for_function("document.querySelector('#demo-video').currentTime>.2")
            page.keyboard.press('Escape')
            assert not page.locator('#demo-dialog').is_visible()
            assert page.evaluate("document.querySelector('#demo-video').paused")
            assert page.evaluate("document.activeElement.matches('[data-watch]')")
            page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=str(OUT/f'{scheme}-{width}-light.png'),full_page=True)
            page.locator('#theme-toggle').click()
            assert page.locator('html').get_attribute('data-theme')=='dark'
            page.screenshot(path=str(OUT/f'{scheme}-{width}-dark.png'),full_page=True)
            assert not errors, errors
            assert not failures, failures
            links=page.locator('a[href^="https:"]').evaluate_all('(nodes)=>nodes.map(n=>n.href)')
            assert all(link in ('https://paperswipe.site/login','https://beian.miit.gov.cn/') for link in links)
            assert page.locator('.compliance-notice a').inner_text()=='粤ICP备2026152562号-1'
            summary.append({'scheme':scheme,'width':width,'images':'ok','video':'playing','overflow':False,'errors':errors})
            page.close()
        # Check animated presentation separately, including automatic playback
        # only after a deliberate click and immediate pause when the dialog closes.
        page=browser.new_page(viewport={'width':1440,'height':900})
        page.goto(f'http://127.0.0.1:{server.server_port}/');page.wait_for_load_state('networkidle');page.wait_for_timeout(1100)
        page.screenshot(path=str(OUT/'desktop-hero.png'))
        page.locator('.hero-actions [data-watch]').click()
        page.wait_for_function("document.querySelector('#demo-video').currentTime>.2")
        page.screenshot(path=str(OUT/'video-dialog.png'))
        page.locator('.dialog-close').click()
        browser.close()
        (OUT/'checks.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
        print('PASS: 8 viewport/protocol cases, light/dark, gallery, keyboard, video, FAQ. Screenshots:',OUT)
    finally:
      server.shutdown();server.server_close()

if __name__=='__main__':main()
