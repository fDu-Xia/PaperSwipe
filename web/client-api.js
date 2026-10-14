// Shared write path: a rejected request must never look like a successful save.
window.PaperSwipeAPI = {
  async post(path, body) {
    const response = await fetch(path, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `保存失败（HTTP ${response.status}）`);
    return result;
  },
  saveAction(paper, action) { return this.post('/api/actions', {paper, action}); },
};
