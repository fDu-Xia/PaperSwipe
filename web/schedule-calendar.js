/* Week navigation changes only the displayed week, never saved reading dates. */
(() => {
  const dialog = document.querySelector('#week-calendar-dialog');
  const yearInput = document.querySelector('#week-calendar-year');
  const monthSelect = document.querySelector('#week-calendar-month');
  const grid = document.querySelector('#week-calendar-days');
  let month;
  const locale = () => window.PaperSwipeI18n.language === 'zh' ? 'zh-CN' : 'en-US';
  const dayKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  // Calendar-day arithmetic in UTC avoids DST making a seven-day week 167/169 hours.
  const dayNumber = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  function offsetForDate(date) {
    return Math.floor((dayNumber(date) - dayNumber(weekStartDate(0))) / 7);
  }
  function choose(date) {
    state.weekPlanOffset = offsetForDate(date);
    renderWeekPlan();
    dismissDialog(dialog);
  }
  function render() {
    yearInput.value = month.getFullYear();
    monthSelect.replaceChildren(...Array.from({length:12}, (_,index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = new Intl.DateTimeFormat(locale(),{month:'long'}).format(new Date(2024,index,1));
      return option;
    }));
    monthSelect.value = month.getMonth();
    const first = new Date(month);
    first.setDate(1 - (first.getDay()+6)%7);
    const today = dayKey(new Date());
    grid.replaceChildren();
    const selectedStart = weekStartDate(state.weekPlanOffset);
    for (let i=0;i<7;i++) {
      const date = new Date(2024,0,1+i); // Monday first.
      const label = document.createElement('span');
      label.className = 'week-calendar-weekday';
      label.textContent = new Intl.DateTimeFormat(locale(),{weekday:'short'}).format(date);
      grid.append(label);
    }
    for (let i=0;i<42;i++) {
      const date = new Date(first); date.setDate(first.getDate()+i);
      const button = document.createElement('button');
      const selected = dayNumber(date) >= dayNumber(selectedStart) && dayNumber(date) < dayNumber(selectedStart)+7;
      button.type = 'button'; button.dataset.calendarDate = dayKey(date);
      button.textContent = date.getDate();
      button.className = 'week-calendar-day' + (date.getMonth() !== month.getMonth() ? ' is-outside' : '') + (selected ? ' is-selected-week' : '');
      button.setAttribute('aria-label',new Intl.DateTimeFormat(locale(),{dateStyle:'full'}).format(date));
      button.setAttribute('aria-pressed',String(selected));
      if (dayKey(date) === today) button.setAttribute('aria-current','date');
      button.disabled = date.getFullYear() < 1900 || date.getFullYear() > 2100;
      button.addEventListener('click',() => choose(date));
      grid.append(button);
    }
    dialog.querySelector('[data-calendar-month="-1"]').disabled = month.getFullYear() === 1900 && month.getMonth() === 0;
    dialog.querySelector('[data-calendar-month="1"]').disabled = month.getFullYear() === 2100 && month.getMonth() === 11;
    window.PaperSwipeI18n.apply(dialog);
  }
  document.addEventListener('click',event => {
    if (event.target.closest('[data-open-week-calendar]')) {
      const start = weekStartDate(state.weekPlanOffset);
      month = new Date(start.getFullYear(),start.getMonth(),1);
      render(); presentDialog(dialog);
    }
    if (event.target.closest('[data-close-week-calendar]')) dismissDialog(dialog);
    if (event.target.closest('[data-calendar-today]')) choose(new Date());
    const nav = event.target.closest('[data-calendar-month]');
    if (nav && !nav.disabled) { month.setMonth(month.getMonth()+Number(nav.dataset.calendarMonth)); render(); }
  });
  function changeMonth() {
    const year = Number(yearInput.value);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) { yearInput.value = month.getFullYear(); return; }
    month = new Date(year,Number(monthSelect.value),1); render();
  }
  yearInput.addEventListener('change',changeMonth);
  monthSelect.addEventListener('change',changeMonth);
  dialog.addEventListener('close',() => document.querySelector('[data-open-week-calendar]')?.focus({preventScroll:true}));
  document.addEventListener('paperswipe:language',() => { if (dialog.open) render(); });
})();
