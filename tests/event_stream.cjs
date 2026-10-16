const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({TextDecoder, console: {warn() {}}});
vm.runInContext(readFileSync(join(__dirname, '../web/event-stream.js'), 'utf8'), context);
const {consumeSSE} = context.PaperSwipeStream;
function streamOf(parts) {
  return new ReadableStream({start(controller) {
    for (const part of parts) controller.enqueue(part);
    controller.close();
  }});
}
const bytes = text => new TextEncoder().encode(text);

test('handles arbitrary chunk boundaries including split Chinese UTF-8 bytes', async () => {
  const data = bytes('event: papers\ndata: {"title":"论文"}\n\ndata: {"done":true}\n\n');
  const stream = streamOf(Array.from(data, byte => Uint8Array.of(byte)));
  const events = [];
  await consumeSSE(stream, (event, value) => events.push([event, value]));
  assert.deepEqual(JSON.parse(JSON.stringify(events)), [['papers', {title: '论文'}], ['message', {done: true}]]);
  assert.equal(stream.locked, false);
});

test('supports multiline JSON, ignores comments and bad JSON, and discards incomplete events', async () => {
  const stream = streamOf([bytes(': heartbeat\n\ndata: bad-json\n\nevent: complete\ndata: {\ndata: "ok":true}\n\ndata: {"partial":true}')]);
  const events = [];
  await consumeSSE(stream, (event, value) => events.push([event, value]));
  assert.deepEqual(JSON.parse(JSON.stringify(events)), [['complete', {ok: true}]]);
});

test('releases stream lock when dispatch or network reading fails', async () => {
  const stream = streamOf([bytes('data: {}\n\n')]);
  await assert.rejects(consumeSSE(stream, () => {throw Error('handler failed');}), /handler failed/);
  assert.equal(stream.locked, false);
  const failed = new ReadableStream({start(controller) {controller.error(Error('offline'));}});
  await assert.rejects(consumeSSE(failed, () => {}), /offline/);
  assert.equal(failed.locked, false);
});
