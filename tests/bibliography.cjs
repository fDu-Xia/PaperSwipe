const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(readFileSync(join(__dirname, '../web/bibliography.js'), 'utf8'), context);
const bibliography = context.PaperSwipeBibliography;
const plain = value => JSON.parse(JSON.stringify(value));

test('BibTeX preserves paper fields and escapes braces, backslashes and whitespace', () => {
  const paper = {title: 'A {Guide} \\ to\nMemory', authors: [{name: 'Ada Lovelace'}],
    year: 2025, venue: 'Memory Conference', url: 'https://example.org/paper',
    external_ids: {DOI: '10.1/example'}, abstract: 'A short abstract.', match_score: 92, read_minutes: 8};
  assert.equal(bibliography.toBibTeX(paper), [
    '@inproceedings{lovelace2025aguidetomemo,',
    '  title = {A \\{Guide\\} \\\\ to Memory},',
    '  author = {Ada Lovelace},',
    '  year = {2025},',
    '  booktitle = {Memory Conference},',
    '  url = {https://example.org/paper},',
    '  doi = {10.1/example},',
    '  abstract = {A short abstract.},',
    '  note = {match=92; read=8min; via PaperSwipe}',
    '}',
  ].join('\n'));
});

test('minimal paper, publication types and digest fallback retain existing output', () => {
  assert.equal(bibliography.toBibTeX({}), '@misc{anonn.d.paper,\n  note = {via PaperSwipe}\n}');
  for (const [venue, type] of [['PhD thesis', 'phdthesis'], ['Journal', 'article'], ['Workshop', 'inproceedings']]) {
    assert.ok(bibliography.toBibTeX({venue}).startsWith(`@${type}{`));
  }
  assert.ok(bibliography.toBibTeX({digest: {hook: 'Read this'}}).includes('abstract = {Read this}'));
});

test('batch export has deterministic date, unique repeated keys, and no input mutation', () => {
  const paper = Object.freeze({title: 'Memory', year: 2025});
  const result = bibliography.toBibTeXDocument([paper, paper], '2026-10-16');
  assert.ok(result.startsWith('% Exported from PaperSwipe · 2026-10-16\n% 2 papers\n\n'));
  assert.ok(result.includes('@misc{anon2025memory,'));
  assert.ok(result.includes('@misc{anon2025memory2,'));
  assert.ok(result.endsWith('\n'));
  assert.ok(bibliography.toBibTeXDocument([paper], '2026-10-16').includes('% 1 paper\n'));
});

test('Zotero serializes authors, DOI precedence, tags and venue-specific fields', () => {
  const item = plain(bibliography.toZoteroItem({title: 'Memory', authors: [{name: 'Ada Lovelace'}, 'Plato'],
    year: 2025, venue: 'arXiv', pdf_url: 'https://example.org/p.pdf',
    digest: {tldr: 'Summary'}, abstract: 'Abstract', doi: 'fallback', external_ids: {DOI: 'preferred'},
    match_score: 0, read_minutes: 8}, ['memory', 'agents']));
  assert.deepEqual(item, {itemType: 'preprint', title: 'Memory', creators: [
    {creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace'},
    {creatorType: 'author', lastName: 'Plato', firstName: ''}], date: '2025',
    url: 'https://example.org/p.pdf', abstractNote: 'Summary', tags: [{tag: 'memory'}, {tag: 'agents'}],
    extra: 'DOI: fallback\nPaperSwipe match: 0\nPaperSwipe read: 8 min\nvia PaperSwipe',
    repository: 'arXiv', DOI: 'preferred'});
  assert.equal(bibliography.toZoteroItem({}, Array.from({length: 20}, (_, i) => String(i))).tags.length, 12);
  for (const [venue, type, field] of [['Journal', 'journalArticle', 'publicationTitle'],
    ['Conference', 'conferencePaper', 'proceedingsTitle'], ['Thesis', 'thesis', 'university']]) {
    const result = bibliography.toZoteroItem({venue});
    assert.equal(result.itemType, type);
    assert.equal(result[field], venue);
  }
  assert.equal(bibliography.toZoteroItem({}).itemType, 'document');
});
