"""Regression checks for the responsive FAQ and action-driven motion."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
OUT = Path(os.environ['TEMP']) / 'paperswipe-marketing-review'
OUT.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='msedge')
    for width in (320, 390, 768, 1000, 1440, 1920, 2560):
        page = browser.new_page(viewport={'width': width, 'height': 1000})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto((ROOT / 'index.html').as_uri())
        page.wait_for_load_state('networkidle')
        assert page.locator('.site-footer,.journey,.hero-copy>.eyebrow,.schedule-section>.media-note').count() == 0
        page.locator('#faq-title').scroll_into_view_if_needed()
        page.wait_for_timeout(700)
        for line in page.locator('#faq-title span').all():
            assert line.evaluate('(el)=>el.getBoundingClientRect().height < parseFloat(getComputedStyle(el).lineHeight)*1.5')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
        faq = page.locator('.faq-list details').first
        summary = faq.locator('summary')
        summary.click()
        assert faq.evaluate('(el)=>el.getAnimations().some(a=>a.playState==="running")')
        page.wait_for_timeout(350)
        assert faq.get_attribute('open') is not None
        summary.click()
        page.wait_for_timeout(350)
        assert faq.get_attribute('open') is None
        # Rapid reversal must finish cleanly, with no leftover clipped height.
        summary.evaluate('(el)=>{el.click();el.click();el.click()}')
        page.wait_for_timeout(350)
        assert faq.get_attribute('open') is not None
        assert faq.evaluate('(el)=>el.style.height==="" && el.style.overflow===""')
        if width in (390, 1000, 1920):
            page.locator('.faq-section').screenshot(path=str(OUT / f'faq-revised-{width}.png'))
        summary.click()
        page.set_viewport_size({'width': width, 'height': 900})
        page.wait_for_timeout(350)
        assert faq.get_attribute('open') is None
        page.locator('.hero-actions [data-watch]').click()
        page.wait_for_timeout(350)
        page.keyboard.press('Escape')
        page.wait_for_timeout(250)
        assert not page.locator('#demo-dialog').is_visible()
        assert page.evaluate("document.activeElement.matches('[data-watch]')")
        assert page.evaluate("document.querySelector('video').paused")
        page.locator('#theme-toggle').click()
        page.wait_for_timeout(350)
        assert page.locator('html').get_attribute('data-theme') == 'dark'
        # Reduced motion retains all interaction without animated delays.
        page.emulate_media(reduced_motion='reduce')
        summary.click()
        assert faq.get_attribute('open') is not None
        assert not faq.evaluate('(el)=>el.getAnimations().some(a=>a.playState==="running")')
        summary.click()
        assert faq.get_attribute('open') is None
        assert not errors, errors
        page.close()
    browser.close()
print('PASS: 7 responsive widths, requested removals, FAQ animation/reversal/resize, dialog, theme, reduced motion')
