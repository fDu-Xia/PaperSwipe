// The browser keeps same-origin, HttpOnly-cookie authentication unchanged.
// Only the bundled native entry provides this bridge and API origin.
(() => {
  const native = window.PaperSwipeNative;
  const platform = window.PaperSwipePlatform = {native: Boolean(native), ready: Promise.resolve()};
  if (!native) return;
  const originalFetch = window.fetch.bind(window);
  let session = '';
  const base = new URL(native.apiOrigin);
  if (base.protocol !== 'https:' || base.pathname !== '/' || base.username || base.password || base.search || base.hash) {
    platform.ready = Promise.reject(new Error('App 服务器配置无效'));
    platform.ready.catch(() => {});
    return;
  }
  platform.ready = native.vault.get().then(value => { session = value.token || ''; });
  platform.ready.catch(() => {}); // bootstrap/login render a recoverable error.
  window.fetch = async (input, init) => {
    const target = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (target.protocol !== location.protocol || target.host !== location.host || !target.pathname.startsWith('/api/')) return originalFetch(input, init);
    await platform.ready;
    const request = new Request(input instanceof Request ? input : target, init);
    const headers = new Headers(request.headers);
    headers.delete('Authorization');
    const login = target.pathname === '/api/login';
    if (!login && session) headers.set('Authorization', `Bearer ${session}`);
    const remote = new URL(login ? '/api/mobile/login' : target.pathname + target.search, base);
    const response = await originalFetch(new Request(remote, new Request(request, {
      headers, credentials: 'omit', redirect: 'error', mode: 'cors',
    })));
    if (login && response.ok) {
      const data = await response.clone().json();
      if (!/^[a-f0-9]{64}$/.test(data.access_token || '')) throw new Error('App 登录接口尚未就绪');
      try { await native.vault.set({token: data.access_token}); }
      catch (_) { throw new Error('无法安全保存登录状态，请重试'); }
      session = data.access_token;
    } else if (response.status === 401 || (target.pathname === '/api/logout' && response.ok)) {
      session = '';
      await native.vault.clear();
    }
    return response; // Keep the ReadableStream: do not buffer AI search batches.
  };
})();
