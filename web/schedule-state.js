// Schedule persistence, shared by the library picker and weekly planner.
let scheduleRevision = 0;
let scheduleBusy = false;
function applyScheduleSnapshot(schedule) {
  state.weekPlanAssign = new Map();
  state.weekPlanPriority = new Map();
  state.weekPlanDone = new Set();
  state.weekPlanRemoved = new Set();
  for (const [id, entry] of Object.entries(schedule || {})) {
    if (entry.date) state.weekPlanAssign.set(id, entry.date);
    if (entry.priority) state.weekPlanPriority.set(id, entry.priority);
    if (entry.done) state.weekPlanDone.add(id);
    if (entry.removed) state.weekPlanRemoved.add(id);
  }
}
async function saveSchedulePatch(id, patch) {
  if (libraryDeleteBusy) { showToast('Please wait for deletion to finish.'); return false; }
  if (scheduleBusy) { showToast('正在保存日程，请稍候'); return false; }
  scheduleBusy = true;
  scheduleRevision++;
  try {
    const result = await PaperSwipeAPI.post('/api/schedule', {paper_id: id, ...patch});
    applyScheduleSnapshot(result.schedule);
    renderLibrary();
    if (state.activeView === 'todos') renderWeekPlan();
    updateTodosBadge();
    return true;
  } catch (error) {
    showToast(`日程未保存：${error.message}`);
    return false;
  } finally {
    scheduleBusy = false;
    scheduleRevision++;
  }
}
