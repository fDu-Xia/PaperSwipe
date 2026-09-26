(async () => {
  try {
    const originalFetch = window.fetch.bind(window);
    const response = await originalFetch('/api/me');
    if (response.status === 401) { location.replace('/login'); return; }
    if (!response.ok) throw Error('无法读取账户信息，请刷新重试');
    const account = await response.json();
    window.PAPERSWIPE_USER = account.beta ? `:${account.user}` : '';
    window.PAPERSWIPE_BETA = Boolean(account.beta);
    if (account.beta) {
      document.documentElement.classList.add('private-beta');
      window.fetch = async (...args) => {
        const result = await originalFetch(...args);
        const target = new URL(typeof args[0] === 'string' ? args[0] : args[0].url, location.href);
        if (target.origin === location.origin && result.status === 401) location.replace('/login');
        return result;
      };
      const logout = document.createElement('button');
      logout.className = 'restart-onboarding';
      logout.textContent = '退出内测账户';
      logout.onclick = async () => {
        try {
          const r = await originalFetch('/api/logout', {method:'POST'});
          if (!r.ok) throw Error('退出失败，请重试');
          location.replace('/login');
        } catch (e) { logout.textContent = e.message; }
      };
      document.querySelector('#restart-onboarding').after(logout);
    }
    const script = document.createElement('script');
    script.src = '/app.js';
    document.body.append(script);
  } catch (error) {
    const message = document.createElement('p');
    message.textContent = error.message;
    message.setAttribute('role','alert');
    document.body.replaceChildren(message);
  }
})();
