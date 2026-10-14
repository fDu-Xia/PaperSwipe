/* Local interface translations. No network request is needed to change the UI. */
(() => {
  'use strict';
  const key = 'paperswipe-language-v1';
  let language = 'zh';
  try { if (localStorage.getItem(key) === 'en') language = 'en'; } catch (_) {}
  const normalize = value => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const messages = new Map();
  for (const pair of window.PaperSwipeMessages || []) for (const text of pair) messages.set(normalize(text), pair);
  const contentSelector = [
    '.card-title', '.back-title', '.card-subtitle', '.card-fields', '.hl-item p', '.detail-bullets li', '.why-col p', '.best-chip',
    '.library-card-title', '.library-tag', '.wp-item-title', '.trend-paper-title', '.trend-row-topic', '.trend-keyword', '#trend-overlay-topic',
    '.knowledge-title', '.front-tldr', '.highlight-item p', '.insight-copy', '.contribution-tags span',
    '.ai-bot-msg.bot', '.ai-bot-roadmap-head strong', '.ai-bot-roadmap-head small', '.ai-bot-roadmap-stage-head strong',
    '.ai-bot-roadmap-hint', '.ai-bot-roadmap-paper h4', '.ai-bot-roadmap-tldr', '.ai-bot-weekplan-head strong', '.ai-bot-weekplan-head small',
    '.ai-bot-weekplan-item h5', '.ai-bot-toppick-reason', '.ai-bot-toppick-facts li:first-child span', '#dialog-content h2', '#dialog-content .detail-list p', '#dialog-content > p:not(.paper-byline)',
  ].join(',');
  const skip = 'script,style,svg,[data-i18n-skip],button[data-language],.ai-bot-msg.user,#settings-topic-chips,#recent-searches';
  const metadata = '.back-byline,.card-byline,.knowledge-byline,.library-card-byline,.ai-bot-roadmap-authors,.paper-byline';
  const original = new WeakMap();
  const attrs = ['placeholder', 'aria-label', 'title', 'data-topic-suggestion'];
  const formats = [
    [/^已切换为 (Light|Dark|System) 主题$/, (m,lang) => lang === 'zh' ? `已切换为${t(m[1],'zh')}主题` : `Switched to ${m[1]} theme`],
    [/^最多选择 (\d+) 个感兴趣领域$/, (m,lang) => lang === 'zh' ? m[0] : `Choose up to ${m[1]} interest areas`],
    [/^已导出 (\d+) 篇到 \.bib 文件$/, (m,lang) => lang === 'zh' ? m[0] : `Exported ${m[1]} papers to a .bib file`],
    [/^已导入 (\d+) 篇到你的 Zotero$/, (m,lang) => lang === 'zh' ? m[0] : `Imported ${m[1]} papers to Zotero`],
    [/^Zotero 完成：成功 (\d+) 篇，失败 (\d+) 篇$/, (m,lang) => lang === 'zh' ? m[0] : `Zotero: ${m[1]} imported, ${m[2]} failed`],
    [/^✓ 已连接。你的 library 当前有 (.*?) 条 items。$/, (m,lang) => lang === 'zh' ? `✓ 已连接。你的文献库当前有 ${m[1]} 条记录。` : `✓ Connected. Your library has ${m[1]} items.`],
    [/^本次 (\d+) 篇未获得 AI 摘要，保留原题；如需重新生成，请重新搜索。$/, (m,lang) => lang === 'zh' ? m[0] : `${m[1]} papers did not receive AI summaries; original titles are kept. Search again to regenerate.`],
    [/^已复用(.+?)结果，未重复调用 AI；右上角可主动刷新。$/, (m,lang) => lang === 'zh' ? m[0] : 'Reused cached results without another AI call. Use the top-right refresh button for new results.'],
    [/^(.*?) · 已整理 (\d+)\/(\d+) 篇$/, (m,lang) => lang === 'zh' ? m[0] : `${m[1]} · ${m[2]}/${m[3]} summaries ready`],
    [/^(.*?) · 正在整理论文摘要$/, (m,lang) => lang === 'zh' ? m[0] : `${m[1]} · Preparing paper summaries`],
    [/^(.*?) · 已配置$/, (m,lang) => lang === 'zh' ? m[0] : `${m[1]} · Configured`],
    [/^(\d+) more papers didn't fit — you can revisit them after the deadline\.$/, (m,lang) => lang === 'en' ? m[0] : `还有 ${m[1]} 篇论文未排入计划，可以在截止日期后继续阅读。`],
  ];
  function t(value, target = language) {
    const text = String(value ?? '');
    const pair = messages.get(normalize(text));
    if (pair) return target === 'zh' ? pair[1].replace(/\b(Focus|Broaden|Explore|Library|Update)\b/g, word => ({Focus:'聚焦',Broaden:'拓展',Explore:'探索',Library:'文献库',Update:'更新'}[word])) : pair[0];
    for (const [pattern,format] of formats) { const match = text.trim().match(pattern); if (match) return format(match,target); }
    for (const [prefix,english] of [['未保存：','Not saved: '],['未同步到 Library：','Not synced to Library: '],['加载中断：','Loading interrupted: '],['日程未保存：','Schedule not saved: '],['连接失败：','Connection failed: '],['Zotero 请求失败：','Zotero request failed: '],['Zotero 写入失败：','Zotero write failed: ']]) {
      if (text.startsWith(prefix)) return (target === 'en' ? english : prefix.replace('Library','文献库')) + t(text.slice(prefix.length),target);
    }
    // Counts/dates are format strings, never sent to the model.
    let out = text;
    const units = target === 'zh'
      ? [[/\b([\d.,]+k?)\s*cites\b/gi, '$1 次引用'], [/\b(\d+)\s*papers?\b/gi, '$1 篇论文'], [/\b(\d+)\s*min\b/gi, '$1 分钟']]
      : [[/([\d.,]+k?)\s*次引用/g, '$1 cites'], [/(\d+)\s*篇论文/g, '$1 papers'], [/(\d+)\s*分钟/g, '$1 min']];
    for (const [pattern, replacement] of units) out = out.replace(pattern, replacement);
    if (target === 'zh') {
      out = out.replace(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat|Today)\b/g, word => t(word, target));
      out = out.replace(/\b(\d+) candidates\b/g,'$1 篇候选论文').replace(/\bMatch (\d+)/g,'匹配度 $1');
      out = out.replace(/^(\d+) weeks ago$/,'$1 周前').replace(/^In (\d+) weeks$/,'$1 周后');
      out = out.replace(/Nothing scheduled/g,'暂无安排');
      out = out.replace(/^([\d.,]+[kKmM]?) (papers indexed|countries)$/,(_,n,label)=>`${n} ${t(label,target)}`);
      out = out.replace(/^(Interested|Key|Read) 还是空的$/, (_, group) => `${t(group, target)}中还没有论文`);
      out = out.replace(/\b(Explore|Library|Settings|Update|Focus|Broaden)\b/g, word => t(word === 'Update' ? 'Update themes' : word, target));
    } else {
      out = out.replace(/^(Interested|Key|Read) 还是空的$/, (_, group) => `${group} is empty`);
      out = out.replace(/^检索失败 \(HTTP (\d+)\)$/,'Search failed (HTTP $1)').replace(/^保存失败（HTTP (\d+)）$/,'Save failed (HTTP $1)');
    }
    return out;
  }
  function patch(node, field, value, write) {
    const records = original.get(node) || {};
    let record = records[field];
    if (!record || value !== record.last) record = {source: value};
    const translated = t(record.source);
    // Preserve whitespace around text nodes, including spaces around inline icons.
    const output = field === 'text' ? (record.source.match(/^\s*/)[0] + translated.trim() + record.source.match(/\s*$/)[0]) : translated;
    record.last = output; records[field] = record; original.set(node, records);
    if (value !== output) write(output);
  }
  function apply(root = document.body) {
    if (!root) return;
    const elements = root.nodeType === 1 ? [root, ...root.querySelectorAll('*')] : [];
    for (const el of elements) {
      if (el.closest(skip)) continue;
      if (el.closest(metadata)) {
        for (const node of el.childNodes) if (node.nodeType === 3 && /^(Author info pending|Publication pending(?: verification)?|作者信息待补充|发表信息待核实)$/.test(node.nodeValue.trim())) patch(node,'text',node.nodeValue,value => {node.nodeValue=value;});
        continue;
      }
      for (const name of attrs) if (el.hasAttribute(name)) patch(el, name, el.getAttribute(name), value => el.setAttribute(name, value));
      if (el.matches('textarea') || el.closest(contentSelector)) continue;
      for (const node of el.childNodes) if (node.nodeType === 3 && node.nodeValue.trim()) patch(node, 'text', node.nodeValue, value => { node.nodeValue = value; });
    }
  }
  function controls() {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.language = language;
    apply(document.querySelector('title'));
    document.querySelectorAll('button[data-language]').forEach(button => {
      const selected = button.dataset.language === language;
      button.setAttribute('aria-checked', String(selected));
      button.classList.toggle('is-selected', selected);
      button.tabIndex = selected ? 0 : -1;
      button.parentElement.dataset.selectedLanguage = language;
    });
  }
  function setLanguage(value) {
    if (!['zh','en'].includes(value)) return;
    document.querySelectorAll(`button[data-language="${value}"]`).forEach(button => {
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        button.getAnimations().forEach(animation => animation.cancel());
        button.animate([{transform:'scale(.93)'},{transform:'scale(1.035)'},{transform:'scale(1)'}],{duration:300,easing:'cubic-bezier(.22,1,.36,1)'});
      }
    });
    if (language === value) return;
    language = value;
    try { localStorage.setItem(key, value); } catch (_) {}
    controls(); apply();
    document.dispatchEvent(new CustomEvent('paperswipe:language', {detail: {language}}));
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-language]');
    if (button) setLanguage(button.dataset.language);
  });
  document.addEventListener('keydown', event => {
    const button = event.target.closest('button[data-language]');
    if (!button || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'zh' : event.key === 'End' ? 'en' : language === 'zh' ? 'en' : 'zh';
    setLanguage(next); button.parentElement.querySelector(`[data-language="${next}"]`)?.focus();
  });
  window.PaperSwipeI18n = {t, apply, setLanguage, contentSelector, hasMessage: text => messages.has(normalize(text)), get language() { return language; }};
  controls(); apply();
  const observer = new MutationObserver(changes => {
    const roots = new Set();
    for (const change of changes) {
      if (change.type === 'childList') for (const node of change.addedNodes) roots.add(node.nodeType === 1 ? node : node.parentElement);
      else roots.add(change.target.nodeType === 1 ? change.target : change.target.parentElement);
    }
    for (const root of roots) if (root?.isConnected) apply(root);
  });
  observer.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:attrs});
})();
