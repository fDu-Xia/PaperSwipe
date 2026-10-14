/* Display-only faithful translations. Never mutates a paper or its saved digest. */
(() => {
  'use strict';
  const ui = window.PaperSwipeI18n;
  const records = new WeakMap(), cache = new Map(), failed = new Set();
  let timer, busy = false, generation = 0, retryCount = 0;
  let storageKey = '', saveTimer;
  let activeController;
  const cacheKey = (text, lang) => JSON.stringify([lang, window.PaperSwipeText.clean(text)]);
  // Only load after the account is known. Never share translations between testers.
  function setAccount(account) {
    storageKey = 'paperswipe-translations-v2:' + account;
    cache.clear(); failed.clear();
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && Date.now() - saved.savedAt < 30 * 86400000 && Array.isArray(saved.entries)) {
        for (const pair of saved.entries.slice(-1000)) {
          if (Array.isArray(pair) && pair.length === 2 && pair.every(x => typeof x === 'string') && pair[0].length < 12000 && pair[1].length < 16000) cache.set(...pair);
        }
      }
    } catch (_) { /* Storage is optional, including in private browsing. */ }
    schedule();
  }
  function saveCache() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!storageKey) return;
      const entries = []; let size = 0;
      for (const pair of [...cache].reverse()) {
        size += pair[0].length + pair[1].length;
        if (entries.length >= 1000 || size > 900000) break;
        entries.unshift(pair);
      }
      try { localStorage.setItem(storageKey,JSON.stringify({savedAt:Date.now(),entries})); } catch (_) {}
    },200);
  }
  const visible = el => !el.closest('[hidden],dialog:not([open])') && !(document.body.classList.contains('is-onboarding') && el.closest('#app-shell')) && el.getClientRects().length > 0;
  function read(el) {
    return [...el.childNodes].map(node => node.nodeType === 3 ? node.nodeValue : /^(STRONG|B)$/.test(node.nodeName) ? `**${read(node)}**` : read(node)).join('');
  }
  function write(el, value) {
    value = window.PaperSwipeText.clean(value);
    const fragment = document.createDocumentFragment();
    value.split(/(\*\*[^*]+\*\*)/g).forEach(part => {
      if (part.startsWith('**') && part.endsWith('**')) { const strong = document.createElement('strong'); strong.textContent = part.slice(2,-2); fragment.append(strong); }
      else fragment.append(document.createTextNode(part));
    });
    el.replaceChildren(fragment);
  }
  function record(el) {
    const raw = read(el), current = window.PaperSwipeText.clean(raw);
    if (raw !== current) write(el,current);
    let item = records.get(el);
    if (!item || current !== item.last) { item = {source:current, last:current}; records.set(el,item); }
    return item;
  }
  function translation(text, lang) {
    if (ui.hasMessage(text)) return ui.t(text,lang);
    const han = (text.match(/[\u3400-\u9fff]/g) || []).length;
    const latinWords = (text.match(/[a-z]{3,}/gi) || []).length;
    if (!text.trim() || (lang === 'en' ? !han : (han > 0 && latinWords < Math.max(4,han/2)) || !/[a-z]{2}/i.test(text))) return text;
    return cache.get(cacheKey(text,lang));
  }
  function remember(text, lang, value) {
    if (typeof text !== 'string' || typeof value !== 'string' || !text.trim() || !value.trim() || text.length > 5000 || value.length > 10000) return;
    const key = cacheKey(text,lang);
    if (cache.get(key) === value) return;
    cache.set(key,value);
    while(cache.size > 1000) cache.delete(cache.keys().next().value);
    saveCache();
  }
  function status(pending, errors) {
    const message = errors ? ui.t('Translation unavailable. Original text is shown; retry in Settings.') : pending ? ui.t('Translating this card; you can keep reading.') : '';
    const label = document.querySelector('#translation-status');
    if (label) { if (label.hidden !== !message) label.hidden = !message; if(label.textContent !== message) label.textContent = message; }
    const retry = document.querySelector('#retry-translations');
    if (retry && retry.hidden !== !errors) retry.hidden = !errors;
    let badge = document.querySelector('#content-language-status');
    if (!badge) {
      badge = document.createElement('div'); badge.id = 'content-language-status'; badge.className = 'content-language-status'; badge.setAttribute('role','status'); badge.dataset.i18nSkip = '';
      document.body.append(badge);
    }
    const host = document.querySelector('dialog[open]') || document.body;
    if (badge.parentElement !== host) host.append(badge);
    if (badge.hidden !== !message) badge.hidden = !message;
    if (badge.textContent !== message) badge.textContent = message;
  }
  function scan() {
    const pending = new Map(), critical = new Map(); let errors = false, visiblePending = false;
    document.querySelectorAll(ui.contentSelector).forEach(el => {
      if (!visible(el) || el.parentElement?.closest(ui.contentSelector)) return;
      const item = record(el), translated = translation(item.source,ui.language);
      const value = translated === undefined ? undefined : window.PaperSwipeText.clean(translated);
      if (value !== undefined) {
        if (item.last !== value) { write(el,value); item.last = value; }
        if (el.hasAttribute('data-translation-state')) el.removeAttribute('data-translation-state');
      } else {
        const key = cacheKey(item.source,ui.language);
        const error = failed.has(key) || item.source.length > 5000;
        // Keep the last readable language until its replacement is ready.
        if (error && item.last !== item.source) { write(el,item.source); item.last = item.source; }
        const face = el.closest('.card-face');
        const onScreen = (!face || getComputedStyle(face).visibility !== 'hidden') && !el.closest('.deck-layer,.upcoming-card');
        errors ||= error && onScreen;
        visiblePending ||= !error && onScreen;
        const state = error ? 'error' : 'pending';
        if (el.dataset.translationState !== state) el.dataset.translationState = state;
        if (!error) {
          pending.set(key,item.source);
          if (onScreen && el.matches('.card-subtitle,.card-title') && el.closest('#card,.library-pop-card')) critical.set(key,item.source);
          if (onScreen && el.matches('.library-card-hook')) {
            const rect = el.getBoundingClientRect();
            if (rect.bottom > 80 && rect.top < innerHeight - 70) critical.set(key,item.source);
          }
        }
      }
    });
    status(visiblePending,errors);
    // Never make the visible two-line front wait for a whole deck's details.
    if (critical.size) return new Map([...critical].slice(0,2));
    // A small look-ahead warms both sides of the next cards without translating
    // the entire library or taking search's model slot.
    for (const text of window.paperTranslationLookahead?.() || []) {
      const key = cacheKey(text,ui.language);
      if (text && text.length <= 5000 && !failed.has(key) && translation(text,ui.language) === undefined) pending.set(key,text);
    }
    return pending;
  }
  function schedule(delay = 80) { clearTimeout(timer); timer = setTimeout(pump,delay); }
  async function pump() {
    const pending = scan();
    if (busy || !pending.size) return;
    // Search/summary generation has priority over optional display translation.
    if (typeof state !== 'undefined' && (state.loading || state.streaming)) { schedule(500); return; }
    const texts = []; let size = 0;
    for (const text of pending.values()) { if (texts.length >= 24 || size + text.length > 15000) break; texts.push(text); size += text.length; }
    if (!texts.length) return;
    busy = true;
    const lang = ui.language, version = generation;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(),50000);
    activeController = controller;
    let delay = 80;
    try {
      const response = await fetch('/api/translate',{method:'POST', headers:{'Content-Type':'application/json','Prefer':'wait=20'},body:JSON.stringify({language:lang,texts}),signal:controller.signal});
      if (response.status === 429 && retryCount < 2) { retryCount++; delay = Math.min(20000,Math.max(3000,Number(response.headers.get('Retry-After') || 5)*1000)); return; }
      if (!response.ok) throw Error('translation unavailable');
      const result = await response.json();
      if (!Array.isArray(result.translations) || result.translations.length !== texts.length || result.translations.some(value => typeof value !== 'string' || !value.trim())) throw Error('invalid translation');
      result.translations.forEach((value,index) => cache.set(cacheKey(texts[index],lang),value));
      while(cache.size > 1000) cache.delete(cache.keys().next().value);
      saveCache();
      retryCount = 0;
    } catch (_) {
      if (version !== generation) return; // superseded language is not a provider failure
      texts.forEach(text => failed.add(cacheKey(text,lang)));
      // A failed batch does not trigger an automatic loop of paid requests.
      if (version === generation) for (const key of pending.keys()) failed.add(key);
    } finally {
      clearTimeout(timeout); busy = false; activeController = null; schedule(delay);
    }
  }
  const observer = new MutationObserver(changes => {
    if (changes.some(change => !change.target.closest?.('#content-language-status,#translation-status') &&
        (change.type !== 'attributes' || change.attributeName === 'hidden' || change.attributeName === 'open' || change.target.matches('.view,.onboarding,#settings-page,#ai-bot-page,.card-inner')))) {
      scan(); // Mutation observers run before paint; do not wait 80 ms to localize.
      schedule();
    }
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','open','class']});
  document.addEventListener('paperswipe:language',() => { generation++; retryCount = 0; activeController?.abort(); scan(); schedule(0); });
  document.querySelector('#retry-translations')?.addEventListener('click',() => { failed.clear(); retryCount = 0; schedule(); });
  window.PaperSwipeContentLanguage = {lookup: text => window.PaperSwipeText.clean(translation(window.PaperSwipeText.clean(text),ui.language) ?? text), remember, setAccount, refresh: () => { scan(); schedule(); }};
  schedule();
})();
