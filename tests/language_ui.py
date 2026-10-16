"""Isolated UI/translation/flip regressions; no real model, account or data writes."""
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
paper = {'id':'language-test', 'title':'Retrieval improves factual answers', 'authors':[{'name':'Alex Smith'}], 'year':2025, 'venue':'arXiv',
         'digest':{'hook':'先查资料再回答，可以减少编造。', 'problem':'研究如何减少**错误回答**。', 'method':'回答前检索资料。', 'result':'部分任务的错误更少。', 'novelty':['结合检索与生成。'], 'why_field':'给研究者提供可核对的证据。', 'why_you':'适合了解检索增强的方法。'}, 'read_minutes':25}
calls = []
fail_translation = False
translation_delay = 0
translations = {'Retrieval improves factual answers':'检索让回答更准确', '先查资料再回答，可以减少编造。':'Checking sources first can reduce fabricated answers.'}

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
    def respond(self, status, data):
        self.send_response(status); self.send_header('Content-Type','application/json'); self.end_headers()
        try: self.wfile.write(json.dumps(data).encode())
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError): pass # cancelled old-language request
    def do_GET(self):
        if self.path.startswith('/api/'):
            if self.path == '/api/library': return self.respond(200,{'papers':[{'paper':paper,'action':'save'}],'schedule':{}})
            return self.respond(200,{'user':'test','ai_enabled':False})
        return super().do_GET()
    def do_POST(self):
        data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if self.path == '/api/translate':
            calls.append(data)
            if translation_delay: time.sleep(translation_delay)
            if fail_translation: return self.respond(503,{'error':'test unavailable'})
            result = [translations.get(text, '翻译后的研究内容。' if data['language']=='zh' else 'Translated research content.') for text in data['texts']]
            return self.respond(200,{'translations':result})
        return self.respond(200,{'ok':True})

server = ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'web')))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
  with sync_playwright() as p:
    channel = os.environ.get('PAPERSWIPE_TEST_BROWSER','msedge')
    engines = [('chromium' if channel == 'chromium' else 'edge', lambda: p.chromium.launch(headless=True,**({} if channel == 'chromium' else {'channel':channel})))]
    if os.environ.get('PAPERSWIPE_TEST_WEBKIT') == '1': engines.append(('webkit',lambda:p.webkit.launch(headless=True)))
    for engine, launch in engines:
      browser = launch()
      try:
        page = browser.new_page(viewport={'width':390,'height':844},has_touch=True,color_scheme='dark')
        errors = []; page.on('pageerror',lambda error: errors.append(str(error)))
        base = f'http://127.0.0.1:{server.server_port}'
        page.goto(base); page.wait_for_load_state('networkidle')
        page.wait_for_function("typeof state !== 'undefined' && !!elements.card")
        assert page.locator('html').get_attribute('data-theme') == 'light'
        assert page.locator('html').get_attribute('lang') == 'zh-CN'
        assert page.locator('#onboarding-topic-input').get_attribute('placeholder') == '说说你的目标、兴趣或研究计划。'
        assert page.evaluate("""() => {PaperSwipeI18n.setLanguage('en'); return document.querySelector('.language-compact [data-language="en"]').getAnimations().length > 0;}""")
        page.evaluate("PaperSwipeI18n.setLanguage('zh')")
        assert page.locator('.identity-step .onboarding-primary').bounding_box()['y'] < 800
        page.screenshot(path=str(OUT/f'{engine}-onboarding.png'))
        page.evaluate("document.body.classList.remove('is-onboarding'); elements.onboarding.hidden=true; state.started=true; refreshLibrary()")
        page.evaluate("state.papers=[state.library[0].paper];state.index=0;renderCard()")
        page.wait_for_function("document.querySelector('#card .card-title').textContent === '检索让回答更准确'")
        assert page.evaluate('state.papers[0].title') == paper['title']
        # Warm the next card before it is advanced; both sides reuse the cache.
        page.evaluate("state.papers.push({...state.papers[0],id:'next',title:'A second paper',digest:{...state.papers[0].digest,method:'New retrieval method evidence'}});renderCard()")
        page.wait_for_function("PaperSwipeContentLanguage.lookup('New retrieval method evidence') === '翻译后的研究内容。'")
        upcoming_badge = page.evaluate("elements.stack1.querySelector('.card-badge').textContent")
        assert upcoming_badge == 'arXiv 2025'
        assert page.evaluate("""() => {state.index=1;renderCard();return document.querySelector('#card .card-title').textContent;}""") == '翻译后的研究内容。'
        assert page.locator('#card .card-front .card-badge').text_content() == upcoming_badge
        assert page.evaluate("paperVenueBadge({source:'arXiv',year:2023})") == 'arXiv 2023'
        assert page.evaluate("paperVenueBadge({year:2023})") == '2023'
        assert page.evaluate('paperVenueBadge({})') == 'Publication'
        page.evaluate("state.papers=state.papers.slice(0,1);state.index=0;renderCard()")
        page.evaluate("flip()")
        page.wait_for_timeout(650)
        assert page.locator('#card .card-front').evaluate('(el)=>getComputedStyle(el).visibility') == 'hidden'
        assert page.locator('#card .card-back').evaluate('(el)=>getComputedStyle(el).visibility') == 'visible'
        page.evaluate("unflip(); openSettingsPage()")
        page.wait_for_timeout(400)
        assert page.locator('[data-appearance]').evaluate_all('(els)=>els.map(el=>el.dataset.appearance)') == ['light','dark','system']
        assert page.locator('#settings-title').inner_text() == '设置', (page.locator('#settings-title').inner_text(),errors)
        if os.environ.get('PAPERSWIPE_AUDIT'):
            print('ZH UI:',page.evaluate("""[...document.querySelectorAll('body *')].filter(el=>!el.closest('script,style,svg,textarea,[data-i18n-skip],button[data-language],.card-byline,.back-byline,.library-card-byline,#settings-topic-chips')&&!el.closest(PaperSwipeI18n.contentSelector)).flatMap(el=>[...el.childNodes].filter(n=>n.nodeType===3&&/[a-z]{2}/i.test(n.nodeValue)).map(n=>n.nodeValue.trim())).filter(Boolean)"""))
        page.locator('#settings-complexity').fill('5'); page.locator('#settings-complexity').dispatch_event('input')
        page.wait_for_timeout(250)
        assert page.locator('#settings-complexity-label').inner_text() == '专业阅读'
        page.wait_for_function("parseFloat(getComputedStyle(document.querySelector('#settings-complexity')).getPropertyValue('--range-progress')) >= 99.9")
        page.locator('#settings-complexity').scroll_into_view_if_needed()
        page.screenshot(path=str(OUT/f'{engine}-settings-zh.png'))
        page.locator('#settings-page [data-language="en"]').click()
        page.wait_for_timeout(300)
        assert page.locator('.language-options').evaluate("el => Math.abs(parseFloat(getComputedStyle(el,'::after').width) - 1) < .1")
        assert page.locator('.language-options').evaluate("el => getComputedStyle(el,'::before').transform") != 'none'
        page.screenshot(path=str(OUT/f'{engine}-settings-language.png'))
        assert page.locator('#settings-title').inner_text() == 'Settings'
        assert page.locator('#ai-bot-input').get_attribute('placeholder') == 'Tell me your goal, or ask what to read today…'
        if os.environ.get('PAPERSWIPE_AUDIT'):
            print('EN UI:',page.evaluate("""[...document.querySelectorAll('body *')].filter(el=>!el.closest('script,style,svg,textarea,[data-i18n-skip],button[data-language],.card-byline,.back-byline,.library-card-byline,#settings-topic-chips')&&!el.closest(PaperSwipeI18n.contentSelector)).flatMap(el=>[...el.childNodes].filter(n=>n.nodeType===3&&/[\\u3400-\\u9fff]/.test(n.nodeValue)).map(n=>n.nodeValue.trim())).filter(Boolean)"""))
        page.locator('#settings-close').click()
        page.wait_for_function("document.querySelector('#card .card-subtitle').textContent.includes('Checking sources')")
        assert page.locator('#card .card-title').inner_text() == paper['title']
        assert page.evaluate('state.papers[0].digest.hook') == paper['digest']['hook']
        count = len(calls)
        page.evaluate("PaperSwipeI18n.setLanguage('zh')")
        page.wait_for_timeout(250)
        assert len(calls) == count, 'cached translations should not call AI again'
        page.evaluate("switchView('library');openLibraryCard('language-test')")
        page.wait_for_timeout(550)
        page.locator('.library-pop-card .card-front').click()
        page.wait_for_timeout(650)
        assert page.locator('.library-pop-card .card-front').evaluate('(el)=>getComputedStyle(el).visibility') == 'hidden'
        assert page.locator('.library-pop-card .card-back').evaluate('(el)=>getComputedStyle(el).visibility') == 'visible'
        page.screenshot(path=str(OUT/f'{engine}-library-back.png'))
        page.evaluate("document.querySelector('#library-card-dialog').close(); switchView('discover'); renderErrorCard('开放论文源暂时不可用，请稍后重试。','论文源暂不可用')")
        page.wait_for_timeout(250)
        page.screenshot(path=str(OUT/f'{engine}-retry-light.png'))
        page.evaluate("applyAppearance('dark')")
        assert page.locator('html').get_attribute('data-theme') == 'dark'
        page.wait_for_timeout(250)
        page.screenshot(path=str(OUT/f'{engine}-retry-dark.png'))
        assert page.locator('.recovery-actions button').count() == 2
        page.evaluate("switchView('network')")
        page.wait_for_timeout(350)
        assert page.locator('.trend-scroll > :last-child').get_attribute('class') == 'trend-foot'
        assert page.locator('.trend-title').evaluate("el=>parseFloat(getComputedStyle(el).marginBottom)") >= 18
        assert page.locator('.trend-scroll').evaluate("el=>parseFloat(getComputedStyle(el).paddingTop)") <= 20
        page.screenshot(path=str(OUT/f'{engine}-trending-spacing.png'))
        page.evaluate("switchView('todos')")
        page.wait_for_timeout(350)
        assert 'page-footnote' in page.locator('.todos-scroll > :last-child').get_attribute('class')
        assert page.locator('.todos-scroll > .page-footnote').evaluate("el=>el.getBoundingClientRect().top-el.previousElementSibling.getBoundingClientRect().bottom") <= 12
        page.screenshot(path=str(OUT/f'{engine}-schedule.png'))
        # Jump directly to past/future weeks without modifying reading dates.
        schedule_before = page.evaluate('JSON.stringify([...state.weekPlanAssign])')
        page.locator('[data-open-week-calendar]').click()
        calendar = page.locator('#week-calendar-dialog')
        assert calendar.is_visible()
        assert page.locator('.week-calendar-day').count() == 42
        page.locator('#week-calendar-year').fill('2024')
        page.locator('#week-calendar-year').press('Tab')
        page.locator('#week-calendar-month').select_option('11')
        page.screenshot(path=str(OUT/f'{engine}-week-calendar-dark.png'))
        page.locator('[data-calendar-date="2024-12-31"]').click()
        page.wait_for_timeout(300)
        assert not calendar.is_visible()
        assert page.evaluate("(()=>{const d=weekStartDate(state.weekPlanOffset);return [d.getFullYear(),d.getMonth()+1,d.getDate()]})()") == [2024,12,30]
        assert '2024/12/30 – 2025/1/5' in page.locator('.wp-nav-center small').inner_text()
        assert page.locator('[data-open-week-calendar]').evaluate('el=>el===document.activeElement')
        page.locator('[data-week-nav="1"]').click()
        assert page.evaluate('weekStartDate(state.weekPlanOffset).getDate()') == 6
        page.locator('[data-open-week-calendar]').click()
        page.locator('#week-calendar-year').fill('2024')
        page.locator('#week-calendar-year').press('Tab')
        page.locator('#week-calendar-month').select_option('1')
        page.locator('[data-calendar-date="2024-02-29"]').click()
        page.wait_for_timeout(300)
        assert page.evaluate('weekStartDate(state.weekPlanOffset).getDate()') == 26
        page.locator('[data-open-week-calendar]').click()
        page.locator('#week-calendar-month').select_option('2')
        page.locator('[data-calendar-date="2024-03-10"]').click()
        page.wait_for_timeout(300)
        assert page.evaluate('weekStartDate(state.weekPlanOffset).getDate()') == 4
        page.locator('[data-open-week-calendar]').click()
        page.evaluate("PaperSwipeI18n.setLanguage('en');applyAppearance('light')")
        page.set_viewport_size({'width':320,'height':568})
        page.wait_for_timeout(350)
        assert page.locator('#week-calendar-month option').nth(2).inner_text() == 'March'
        page.screenshot(path=str(OUT/f'{engine}-week-calendar-light.png'))
        assert calendar.evaluate('el=>el.scrollWidth<=el.clientWidth+1') # WebKit rounds fractional grid widths.
        assert calendar.evaluate("el=>[...el.querySelectorAll('button,input,select')].every(n=>n.getBoundingClientRect().right<=el.getBoundingClientRect().right+1)")
        page.locator('[data-calendar-today]').click()
        page.wait_for_timeout(300)
        assert page.evaluate('state.weekPlanOffset') == 0
        assert page.evaluate('JSON.stringify([...state.weekPlanAssign])') == schedule_before
        page.locator('[data-open-week-calendar]').click()
        page.keyboard.press('Escape');page.wait_for_timeout(300)
        assert not calendar.is_visible()
        page.set_viewport_size({'width':390,'height':844})
        page.evaluate("PaperSwipeI18n.setLanguage('zh');applyAppearance('dark')")
        page.evaluate("switchView('todos');document.querySelector('#ai-bot-button').click()")
        page.wait_for_timeout(350)
        assert page.locator('[data-bot-prompt="daily"] strong').inner_text() == '规划今天的阅读'
        page.locator('[data-bot-prompt="daily"]').click()
        assert '我目前的目标' in page.locator('#ai-bot-input').input_value()
        page.screenshot(path=str(OUT/f'{engine}-assistant-zh.png'))
        page.locator('#ai-bot-close').click()
        # All library tabs share canonical subjects, and multiple chips intersect.
        library_fixture = [
            {'action':action,'paper':{**paper,'id':id,'fields':fields}}
            for action,id,fields in [('save','both',['cs.AI','cs.CV']),('save','ai',['Artificial Intelligence']),('priority','cv',['cs.CV']),('read','read',['cs.CL','cs.RO','cs.HC','cs.SE'])]
        ]
        page.route('**/api/library',lambda route: route.fulfill(json={'papers':library_fixture,'schedule':{}}))
        page.evaluate("switchView('library');refreshLibrary()")
        page.wait_for_function("state.library.length === 4")
        subjects = page.locator('[data-library-tag]').evaluate_all('(els)=>els.map(el=>el.dataset.libraryTag)')
        assert 'Open PDF' not in subjects and 'Novel method' not in subjects
        assert page.locator('[data-library-tag="Computer Science"]').inner_text() == '计算机科学'
        page.locator('[data-library-tag="Artificial Intelligence"]').click()
        assert page.locator('[data-library-card]').count() == 2
        page.locator('[data-library-tag="Computer Vision"]').click()
        assert page.locator('[data-library-card]').count() == 1
        assert page.evaluate('visibleLibraryIds()') == ['both']
        for action in ['priority','read','save']:
            page.locator(f'[data-filter="{action}"]').click()
            assert page.locator('[data-library-tag]').evaluate_all('(els)=>els.map(el=>el.dataset.libraryTag)') == subjects
            if action != 'save':
                for language, title in [('en','No matching papers'),('zh','没有符合条件的论文')]:
                    page.evaluate('language => PaperSwipeI18n.setLanguage(language)',language)
                    assert page.locator('.library-empty h2').inner_text() == title
                    assert page.locator('.library-empty p').count() == 0
                    assert page.locator('.library-empty [data-library-clear-filters]').is_visible()
        assert page.evaluate("""() => { renderLibrary(); return document.querySelector('[data-library-tag="Computer Science"]').textContent; }""") == '计算机科学'
        page.locator('[data-library-clear-filters]').first.click()
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT/f'{engine}-library-filters.png'))
        # Subject strip is horizontally scrollable and retains its position on selection.
        tags = page.locator('#library-tags')
        assert tags.evaluate('el=>el.scrollWidth > el.clientWidth')
        assert tags.evaluate('el=>getComputedStyle(el).touchAction') == 'pan-x'
        if engine != 'webkit':
            session = page.context.new_cdp_session(page)
            box = tags.bounding_box(); x = box['x']+box['width']-12; y = box['y']+box['height']/2
            session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
            for step in range(1,9):
                session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-step*25,'y':y}]})
                page.wait_for_timeout(20)
            session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
            page.wait_for_timeout(300)
            assert tags.evaluate('el=>el.scrollLeft') > 0, 'phone swipe should scroll subjects'
            session.detach()
        tags.evaluate('el=>el.scrollLeft=el.scrollWidth')
        before_scroll = tags.evaluate('el=>el.scrollLeft')
        page.locator('[data-library-tag]').last.tap()
        assert tags.evaluate('el=>el.scrollLeft') >= before_scroll-5
        page.locator('[data-library-clear-filters]').first.click()
        # Select all toggles; selections in another tab remain untouched.
        page.locator('#library-export-fab').click()
        all_button = page.locator('[data-library-export-action="all"]')
        all_button.click()
        assert page.evaluate('state.librarySelected.size') == 2
        assert all_button.inner_text() == '取消全选'
        all_button.click()
        assert page.evaluate('state.librarySelected.size') == 0
        page.evaluate("state.librarySelected.add('cv');renderLibrary()")
        all_button.click(); all_button.click()
        assert page.evaluate('[...state.librarySelected]') == ['cv']
        page.evaluate('state.librarySelected.clear();renderLibrary()')
        all_button.click()
        delete_button = page.locator('[data-library-export-action="delete"]')
        assert delete_button.inner_text() == '删除'
        delete_calls = []
        def fail_delete(route):
            delete_calls.append(route.request.post_data_json)
            route.fulfill(status=500,json={'error':'test failure'})
        page.route('**/api/library/delete',fail_delete)
        page.once('dialog',lambda dialog:dialog.dismiss())
        delete_button.click()
        assert not delete_calls and page.evaluate('state.library.length') == 4
        page.once('dialog',lambda dialog:dialog.accept())
        delete_button.click()
        page.wait_for_function('!libraryDeleteBusy')
        assert len(delete_calls) == 1 and page.evaluate('state.librarySelected.size') == 2
        assert page.evaluate('state.library.length') == 4
        page.unroute('**/api/library/delete')
        page.route('**/api/library/delete',lambda route:route.fulfill(json={}))
        page.once('dialog',lambda dialog:dialog.accept())
        delete_button.click()
        page.wait_for_function('!libraryDeleteBusy')
        assert page.evaluate('state.library.length') == 4, 'old/malformed server response must not erase client state'
        page.unroute('**/api/library/delete')
        remaining = library_fixture[2:]
        page.route('**/api/library/delete',lambda route:route.fulfill(json={'papers':remaining,'schedule':{},'stats':{'saved':0,'priority':1,'read':1}}))
        page.once('dialog',lambda dialog:dialog.accept())
        delete_button.click()
        page.wait_for_function('!libraryDeleteBusy && state.library.length === 2')
        assert page.evaluate('state.librarySelected.size') == 0
        assert delete_button.is_disabled()
        page.set_viewport_size({'width':320,'height':568})
        actions = page.locator('.library-export-actions')
        assert actions.evaluate('el=>getComputedStyle(el).overflowX') == 'auto'
        page.locator('[data-library-export-action="zotero"]').scroll_into_view_if_needed()
        assert actions.evaluate('el=>el.scrollLeft') > 0
        page.screenshot(path=str(OUT/f'{engine}-library-actions.png'))
        page.set_viewport_size({'width':390,'height':844})
        page.unroute('**/api/library/delete')
        page.evaluate('toggleLibrarySelectMode(false)')
        page.unroute('**/api/library')
        # Topic removal edits a draft only. Failed planning preserves the old profile.
        page.evaluate("onboardingProfile.topics=['machine learning','vision'];onboardingProfile.researchIntent='machine learning';onboardingProfile.searchQuery='machine learning';openSettingsPage()")
        page.locator('[data-settings-topic-remove="vision"]').click()
        assert page.evaluate('onboardingProfile.topics.length') == 2
        page.locator('#reset-topic-draft').click()
        assert page.locator('[data-settings-topic-remove]').count() == 2
        page.route('**/api/topic-plan', lambda route: route.fulfill(status=503,json={'error':'主题分析失败，请重试'}))
        page.locator('#settings-topic-input').fill('a different research question')
        page.locator('#save-topics-button').click()
        page.wait_for_function("!document.querySelector('#topic-update-error').hidden")
        assert page.evaluate('onboardingProfile.searchQuery') == 'machine learning'
        page.unroute('**/api/topic-plan')
        # Explicit successful search uses the revised query; no live search/model.
        page.route('**/api/topic-plan', lambda route: route.fulfill(json={'search_query':'new-query','keywords':['new keyword'],'ai_enabled':True}))
        page.evaluate("window.savedPerformSearch=performSearch;performSearch=async query=>{window.testSearchQuery=query;}")
        page.locator('#save-topics-button').click()
        page.wait_for_function("window.testSearchQuery === 'new-query'")
        assert page.evaluate('onboardingProfile.topics') == ['new keyword']
        page.evaluate("performSearch=window.savedPerformSearch")
        page.unroute('**/api/topic-plan')
        # Capability test is read-only; a read-only Zotero key is not called writable.
        page.evaluate('openSettingsPage()')
        page.locator('#zotero-settings > summary').click()
        page.locator('#zotero-api-key').fill('mock-key')
        page.locator('#zotero-user-id').fill('123')
        page.route('https://api.zotero.org/keys/current',lambda route: route.fulfill(json={'userID':123,'access':{'user':{'library':True,'write':False}}}))
        page.locator('#zotero-test-button').click()
        page.wait_for_function("document.querySelector('#zotero-status').dataset.tone === 'warn'")
        assert '仅可读取' in page.locator('#zotero-status').inner_text()
        page.unroute('https://api.zotero.org/keys/current')
        page.route('https://api.zotero.org/keys/current',lambda route: route.fulfill(json={'userID':123,'access':{'user':{'library':True,'write':True}}}))
        page.locator('#zotero-test-button').click()
        page.wait_for_function("document.querySelector('#zotero-status').dataset.tone === 'ok'")
        zotero_exports = []
        def mock_zotero_write(route):
            zotero_exports.append(route.request.post_data_json)
            route.fulfill(json={'successful':{'0':{'key':'MOCKITEM'}},'failed':{}})
        page.route('https://api.zotero.org/users/123/items',mock_zotero_write)
        page.evaluate("state.librarySelected=new Set([state.library[0].paper.id]);exportSelectedToZotero()")
        assert len(zotero_exports) == 1 and zotero_exports[0][0]['title'] == paper['title']
        assert zotero_exports[0][0]['itemType'] == 'preprint'
        page.locator('#zotero-clear-button').click()
        page.evaluate("closeSettingsPage();switchView('todos')")
        page.wait_for_timeout(300)
        footer = page.locator('.todos-scroll > .page-footnote')
        assert footer.evaluate('el=>getComputedStyle(el).paddingRight') == '0px'
        fab = page.locator('#ai-bot-button'); box = fab.bounding_box()
        page.mouse.move(box['x']+26,box['y']+26); page.mouse.down()
        page.mouse.move(55,180,steps=12); page.mouse.up()
        assert page.locator('#ai-bot-page').is_hidden(), 'drag must not open assistant'
        assert fab.bounding_box()['y'] < box['y']-50
        fab.focus(); before = fab.bounding_box()['x']; page.keyboard.press('ArrowRight')
        assert fab.bounding_box()['x'] > before
        page.screenshot(path=str(OUT/f'{engine}-schedule-drag.png'))
        # Provider failure must show original and permit explicit retry.
        fail_translation = True
        page.evaluate("switchView('discover');state.papers[0].title='Uncached title';renderCard()")
        page.wait_for_function("document.querySelector('#card .card-title').dataset.translationState === 'error'")
        assert page.locator('#card .card-title').inner_text() == 'Uncached title'
        assert '原文' in page.locator('#content-language-status').inner_text()
        fail_translation = False
        page.evaluate("document.querySelector('#retry-translations').click()")
        page.wait_for_function("!document.querySelector('#card .card-title').dataset.translationState")
        # A late translation in the old language cannot overwrite the new language.
        translation_delay = 0.5
        page.evaluate("state.papers[0].title='Delayed translation title';renderCard()")
        page.wait_for_function("document.querySelector('#card .card-title').dataset.translationState === 'pending'")
        assert page.locator('#card .card-title').evaluate('el=>getComputedStyle(el).color') != 'rgba(0, 0, 0, 0)', 'slow translation must not blank readable content'
        assert page.locator('#card .card-title').evaluate('el=>getComputedStyle(el).textDecorationLine') == 'none'
        page.wait_for_timeout(150)
        page.evaluate("PaperSwipeI18n.setLanguage('en')")
        page.wait_for_timeout(850)
        assert page.locator('#card .card-title').inner_text() == 'Delayed translation title'
        translation_delay = 0
        # Model output is text, not executable HTML, even when it contains markup.
        translations['Unsafe title'] = '<img src=x onerror="window.translationXSS=true">研究'
        page.evaluate("state.papers[0].title='Unsafe title';renderCard();PaperSwipeI18n.setLanguage('zh')")
        page.wait_for_function("document.querySelector('#card .card-title').textContent.includes('<img')")
        assert page.locator('#card .card-title img').count() == 0
        assert not page.evaluate('Boolean(window.translationXSS)')
        # New bilingual fronts switch immediately without a front translation call.
        page.evaluate("""() => {
          state.papers[0].title='Bilingual front title';
          state.papers[0].digest={...state.papers[0].digest,hook:'先核对证据，再回答问题。',hook_en:'Check evidence before answering.',title_zh:'双语卡片标题',title_en:'Bilingual front title'};
          renderCard();
        }""")
        assert page.locator('#card .card-title').inner_text() == '双语卡片标题'
        assert page.evaluate("""() => {PaperSwipeI18n.setLanguage('en');return document.querySelector('#card .card-subtitle').textContent;}""") == 'Check evidence before answering.'
        page.evaluate("PaperSwipeI18n.setLanguage('zh')")
        # Legacy title placeholders are not presented as AI summaries.
        latex = r'We propose \textbf{REALM}, a \emph{\textbf{memory}} framework with $x^{2}$ and 10\% gains.'
        expected = 'We propose REALM, a memory framework with $x^{2}$ and 10% gains.'
        assert page.evaluate('text=>PaperSwipeText.clean(text)',latex) == expected
        assert page.evaluate('text=>pickSubtitle({abstract:text})',latex) == expected
        page.evaluate("text=>{PaperSwipeI18n.setLanguage('en');state.papers[0].digest={hook:text};renderCard()}",latex)
        assert page.locator('#card .card-subtitle').inner_text() == expected
        assert page.evaluate('state.papers[0].digest.hook') == latex
        # Cached model translations also pass through display cleanup.
        page.evaluate("text=>{PaperSwipeContentLanguage.remember(PaperSwipeText.clean(text),'zh',String.raw`提出了\\textbf{记忆}框架。`);PaperSwipeI18n.setLanguage('zh')}",latex)
        assert page.locator('#card .card-subtitle').inner_text() == '提出了记忆框架。'
        page.evaluate("state.papers[0].digest={hook:'先核对证据，再回答问题。'};renderCard()")
        assert page.evaluate("pickSubtitle({title:'A review',abstract:'Background. We review memory and skills in agents.',digest:{hook:'研究主题（原题）：A review'}})") == 'We review memory and skills in agents.'
        page.evaluate("switchView('library');state.library=[{action:'save',paper:state.papers[0]}];state.libraryFilter='save';renderLibrary()")
        assert page.locator('.library-card-hook').first.inner_text() == '先核对证据，再回答问题。'
        page.evaluate("switchView('discover')")
        # Summary provenance remains light on gradient fronts in both themes.
        page.evaluate("state.papers[0]={...state.papers[0],abstract:'We review memory and skills in agents.',digest:{},summary_status:'failed'};renderCard()")
        for theme in ['light','dark']:
            page.evaluate('theme => applyAppearance(theme)',theme)
            assert page.locator('#card .card-hook-note').evaluate('el=>getComputedStyle(el).color') == 'rgb(255, 255, 255)'
        page.wait_for_timeout(550)
        page.screenshot(path=str(OUT/f'{engine}-hook-note.png'))
        # Tiny phones and reduced-motion preferences keep retry controls usable.
        page.set_viewport_size({'width':320,'height':568})
        page.emulate_media(reduced_motion='reduce')
        page.evaluate("renderErrorCard('开放论文源暂时不可用，请稍后重试。','论文源暂不可用')")
        page.locator('#change-search-topic').scroll_into_view_if_needed()
        page.locator('#change-search-topic').click()
        assert not page.locator('#settings-page').is_hidden()
        page.evaluate("selectAppearance('dark')")
        page.reload();page.wait_for_load_state('networkidle')
        assert page.locator('html').get_attribute('data-theme') == 'dark', 'explicit appearance choice must survive reload'
        # Cached card text survives reload. Synchronous rendering never exposes English first.
        page.evaluate("document.body.classList.remove('is-onboarding');elements.onboarding.hidden=true;state.streaming=false;state.loading=false")
        page.wait_for_timeout(300)
        before_calls = len(calls)
        immediate_title = page.evaluate("""paper => {state.papers=[paper];state.index=0;renderCard();return document.querySelector('#card .card-title').textContent;}""",paper)
        assert immediate_title == '检索让回答更准确'
        page.wait_for_timeout(400)
        assert len(calls) == before_calls, 'persisted translations should avoid another model call'
        page.set_viewport_size({'width':390,'height':844})
        page.goto(base+'/login.html');page.wait_for_load_state('networkidle')
        page.locator('[data-language="en"]').click()
        assert page.locator('#welcome').inner_text() == 'Find papers worth reading.'
        assert page.title() == 'PaperSwipe · Beta login'
        page.screenshot(path=str(OUT/f'{engine}-login-en.png'))
        assert not errors, errors
        print(f'PASS {engine}: bilingual UI; translation cache; LaTeX cleanup; AND filters; horizontal strips; toggle selection; confirmed deletion/cancel/failure; topic drafts; Zotero mock; assistant drag; flip; mobile/reduced motion')
      finally: browser.close()
finally:
    server.shutdown(); server.server_close()
print(f'Screenshots: {OUT}')
