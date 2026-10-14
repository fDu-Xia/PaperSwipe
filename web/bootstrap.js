(async () => {
  const loginPath = window.PaperSwipePlatform?.native ? '/login.html' : '/login';
  try {
    await window.PaperSwipePlatform?.ready;
    const originalFetch = window.fetch.bind(window);
    const response = await originalFetch('/api/me');
    if (response.status === 401) { location.replace(loginPath); return; }
    if (!response.ok) throw Error(response.status === 403 && window.PaperSwipePlatform?.native
      ? 'App 服务尚未启用，请联系团队更新服务器并开启移动端接口。'
      : '无法读取账户信息，请检查网络后重试');
    const account = await response.json();
    window.PAPERSWIPE_USER = account.beta ? `:${account.user}` : '';
    window.PAPERSWIPE_BETA = Boolean(account.beta);
    window.PaperSwipeContentLanguage?.setAccount(account.beta ? account.user : 'local');
    if (account.beta) {
      document.documentElement.classList.add('private-beta');
      window.fetch = async (...args) => {
        const result = await originalFetch(...args);
        const target = new URL(typeof args[0] === 'string' ? args[0] : args[0].url, location.href);
        if (target.origin === location.origin && result.status === 401) location.replace(loginPath);
        return result;
      };
      const logout = document.createElement('button');
      logout.className = 'restart-onboarding';
      logout.textContent = '退出内测账户';
      logout.onclick = async () => {
        try {
          const r = await originalFetch('/api/logout', {method:'POST'});
          if (!r.ok) throw Error('退出失败，请重试');
          location.replace(loginPath);
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
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = '重新连接';
    retry.onclick = () => location.reload();
    document.body.classList.remove('is-onboarding');
    document.body.replaceChildren(message, retry);
  }
})();
