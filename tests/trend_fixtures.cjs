const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');

test('demo trends retain separate scopes and the five-paper memory example', () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(join(__dirname, '../web/mockdata/trends.js'), 'utf8'), context);
  const {TRENDING_DATA, TRENDING_TOPIC_PAPERS} = context.PaperSwipeTrendFixtures;
  assert.equal(TRENDING_DATA.global.length, 8);
  assert.equal(TRENDING_DATA.mine.length, 7);
  assert.equal(TRENDING_DATA.mine[0].id, 'llm-agent-memory');
  assert.equal(TRENDING_TOPIC_PAPERS['llm-agent-memory'].length, 5);
  const ids = TRENDING_TOPIC_PAPERS['llm-agent-memory'].map(paper => paper.id);
  assert.equal(new Set(ids).size, 5);
  for (const paper of TRENDING_TOPIC_PAPERS['llm-agent-memory']) {
    assert.ok(paper.title);
    assert.ok(paper.digest.hook);
  }
});
