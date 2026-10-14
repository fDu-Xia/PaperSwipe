// Unit-test the platform bridge with web-standard Request/Response/streams.
// No server, credential files, paid requests or installed native runtime used.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require('node:path').join(__dirname, '../web/platform.js'), 'utf8');

function setup(native = true) {
  const requests = [], stored = [], cleared = [];
  let handler = () => new Response('{}');
  const fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(new URL(input, 'https://localhost'), init);
    requests.push(request);
    return handler(request);
  };
  const window = {fetch};
  if (native) window.PaperSwipeNative = {apiOrigin:'https://api.example',vault:{
    get:async()=>({token:'a'.repeat(64)}),set:async value=>stored.push(value),clear:async()=>cleared.push(true),
  }};
  vm.runInNewContext(source, {window,location:new URL('https://localhost'),URL,Request,Headers,Promise,Error});
  return {window, requests, stored, cleared, handler: fn=>handler=fn, original:fetch};
}

test('web mode does not replace fetch or change cookie authentication',async()=>{
  const f=setup(false);await f.window.PaperSwipePlatform.ready;
  assert.equal(f.window.fetch,f.original);
});
test('native API requests retain body, headers and use only the configured HTTPS server',async()=>{
  const f=setup();await f.window.fetch('/api/actions',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'wait=20'},body:'{"action":"save"}'});
  const r=f.requests[0];assert.equal(r.url,'https://api.example/api/actions');
  assert.equal(r.headers.get('authorization'),'Bearer '+'a'.repeat(64));
  assert.equal(r.headers.get('prefer'),'wait=20');assert.equal(r.credentials,'omit');assert.equal(r.redirect,'error');
  assert.equal(await r.text(),'{"action":"save"}');
  await f.window.fetch(new Request('https://localhost/api/me',{headers:{Prefer:'wait=20'}}),{method:'GET'});
  assert.equal(f.requests[1].headers.get('prefer'),'wait=20');
});
test('native token never accompanies third-party or asset fetches',async()=>{
  const f=setup();await f.window.fetch('https://zotero.example/api/items');await f.window.fetch('/app.js');
  assert.equal(f.requests[0].headers.get('authorization'),null);assert.equal(f.requests[1].headers.get('authorization'),null);
});
test('login securely stores only the session, logout/expiry clears it',async()=>{
  const f=setup();f.handler(()=>new Response(JSON.stringify({access_token:'b'.repeat(64)})));
  await f.window.fetch('/api/login',{method:'POST',body:'{"token":"invite-secret"}'});
  assert.equal(f.requests[0].url,'https://api.example/api/mobile/login');
  assert.equal(f.requests[0].headers.get('authorization'),null);
  assert.equal(f.stored[0].token,'b'.repeat(64));
  f.handler(()=>new Response('{}',{status:401}));await f.window.fetch('/api/me');
  assert.equal(f.cleared.length,1);
  f.handler(()=>new Response('{}'));await f.window.fetch('/api/me');
  assert.equal(f.requests.at(-1).headers.get('authorization'),null);
});
test('network failure does not erase session; streams and abort signals survive',async()=>{
  const f=setup();f.handler(()=>{throw new TypeError('offline')});
  await assert.rejects(f.window.fetch('/api/me'));assert.equal(f.cleared.length,0);
  let finish;
  f.handler(()=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('first batch'));finish=()=>controller.close();}})));
  const abort=new AbortController();const response=await f.window.fetch('/api/search',{signal:abort.signal});
  const reader=response.body.getReader();assert.equal(new TextDecoder().decode((await reader.read()).value),'first batch');
  abort.abort();assert.equal(f.requests.at(-1).signal.aborted,true);finish();
});
test('insecure server configuration and unavailable vault fail closed',async()=>{
  const f=setup();f.window.PaperSwipeNative.apiOrigin='http://api.example';
  vm.runInNewContext(source,{window:f.window,location:new URL('https://localhost'),URL,Request,Headers,Promise,Error});
  await assert.rejects(f.window.PaperSwipePlatform.ready);
  const g=setup();g.window.PaperSwipeNative.vault.get=async()=>{throw Error('locked')};
  vm.runInNewContext(source,{window:g.window,location:new URL('https://localhost'),URL,Request,Headers,Promise,Error});
  await assert.rejects(g.window.fetch('/api/me'));assert.equal(g.requests.length,0);
});
