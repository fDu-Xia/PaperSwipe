const DEFAULT_PROFILE = {
  identity: "graduate",
  researchIntent: "",
  searchQuery: "",
  topics: [],
  topicPlanAI: false,
  discoveryStyle: "focus",
  complexity: 3,
  exploreTopics: [],
};

const state = {
  papers: [],
  index: 0,
  query: "AI agent memory",
  source: "",
  loading: false,
  actionBusy: false,
  started: false,
  activeView: "discover",
  library: [],
  libraryFilter: "save",
  libraryTags: [],
  librarySort: "recent",
  appearance: "light",
  aiModel: "",
  imageEnabled: false,
  imageModel: "",
  paperImages: new Map(),
  generatingImage: "",
  stats: { saved: 0, priority: 0, read: 0, dismissed: 0 },
  session: { dismiss: 0, save: 0, priority: 0, read: 0 },
  todos: [],
  weekPlanDone: new Set(),
  weekPlanRemoved: new Set(),
  weekPlanAssign: new Map(), // paperId -> 'YYYY-MM-DD' (manual scheduling)
  weekPlanPriority: new Map(), // paperId -> 'high' | 'medium' | 'low'
  scheduleDraftDate: null,   // temp selected date before confirm
  scheduleDraftPriority: null, // temp selected priority before confirm
  scheduleWeekOffset: 0, // offset for the schedule-date picker
  actionPaperId: null, // paper id targeted by the long-press action menu
  weekPlanOffset: 0, // # of weeks from the current one (0 = this week, -1 prev, 1 next)
  // ↑ legacy placeholder — Profile now uses buildWeekPlan() driven by state.library
  librarySelectMode: false,
  librarySelected: new Set(),
  librarySearch: "",
  streaming: false,
};


function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickFriendRec() { return null; } // No unverified award labels.

const ONBOARDING_STORAGE_KEY = "paperswipe-onboarding-v1" + (window.PAPERSWIPE_USER || "");
const APPEARANCE_STORAGE_KEY = "paperswipe-appearance-v1" + (window.PAPERSWIPE_USER || "");
const elements = {};
let toastTimer;
let onboardingStep = 0;
let onboardingProfile = { ...DEFAULT_PROFILE, topics: [...DEFAULT_PROFILE.topics] };
let settingsTopicDraft = [];
let topicEditRevision = 0;

/* ── Card swipe state ── */
let isFlipped = false;
let flipGuard = false;
let dragging = false;
let weekPlanSwipe = null;

function initializeApp() {
  cacheElements();
  state.appearance = loadAppearance();
  applyAppearance(state.appearance);
  bindEvents();
  refreshIcons();

  const savedProfile = loadOnboardingProfile();
  const forceOnboarding = new URLSearchParams(window.location.search).get("onboarding") === "1";
  if (savedProfile && !forceOnboarding) {
    onboardingProfile = savedProfile;
    startApp(savedProfile);
  } else {
    showOnboardingStep(0);
    const autoPopper = document.querySelector("[data-confetti-trigger]");
    if (autoPopper) setTimeout(() => fireConfetti(autoPopper), 550);
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeApp);
else queueMicrotask(initializeApp);

function cacheElements() {
  Object.assign(elements, {
    onboarding: document.querySelector("#onboarding"),
    onboardingTopicInput: document.querySelector("#onboarding-topic-input"),
    analyzeTopicButton: document.querySelector("#analyze-topic-button"),
    topicPlanMethod: document.querySelector("#topic-plan-method"),
    topicPlanQuery: document.querySelector("#topic-plan-query"),
    complexitySlider: document.querySelector("#complexity-slider"),
    complexityValue: document.querySelector("#complexity-value"),
    discoverView: document.querySelector("#discover-view"),
    libraryView: document.querySelector("#library-view"),
    networkView: document.querySelector("#network-view"),
    settingsPage: document.querySelector("#settings-page"),
    settingsClose: document.querySelector("#settings-close"),
    todoList: null,
    todoForm: null,
    todoInput: null,
    searchToggle: document.querySelector("#search-toggle"),
    settingsToggle: document.querySelector("#settings-toggle"),
    todosToggleBadge: document.querySelector("#bottom-todos-count"),
    todosView: document.querySelector("#todos-view"),
    weekPlanGrid: document.querySelector("#week-plan-grid"),
    weekPlanSummary: document.querySelector("#week-plan-summary"),
    searchPanel: document.querySelector("#search-panel"),
    searchForm: document.querySelector("#search-form"),
    searchInput: document.querySelector("#search-input"),
    searchNote: document.querySelector("#search-note"),
    resultSource: document.querySelector("#result-source"),
    resultQuery: document.querySelector("#result-query"),
    paperPosition: document.querySelector("#paper-position"),
    paperTotal: document.querySelector("#paper-total"),
    paperCard: document.querySelector("#paper-card"),
    posLabel: document.querySelector("#posLabel"),
    totalLabel: document.querySelector("#totalLabel"),
    progressFill: document.querySelector("#progressFill"),
    card: document.querySelector("#card"),
    cardInner: document.querySelector("#cardInner"),
    cardFront: document.querySelector("#cardFront"),
    cardBack: document.querySelector("#cardBack"),
    cardHero: document.querySelector("#cardHero"),
    stage: document.querySelector("#stage"),
    stack1: document.querySelector(".stack-1"),
    stack2: document.querySelector(".stack-2"),
    hint: document.querySelector("#hint"),
    dismissButton: document.querySelector("#dismiss-button"),
    priorityButton: document.querySelector("#priority-button"),
    readButton: document.querySelector("#read-button"),
    saveButton: document.querySelector("#save-button"),
    aiStatus: document.querySelector("#ai-status"),
    libraryList: document.querySelector("#library-list"),
    libraryTags: document.querySelector("#library-tags"),
    libraryTagsBar: document.querySelector("#library-tags-bar"),
    libraryExportToggle: document.querySelector("#library-export-fab"),
    libraryExportBar: document.querySelector("#library-export-bar"),
    librarySearchInput: document.querySelector("#library-search-input"),
    librarySearchClear: document.querySelector("#library-search-clear"),
    libraryExportCount: document.querySelector("#library-export-n"),
    dialog: document.querySelector("#paper-dialog"),
    dialogContent: document.querySelector("#dialog-content"),
    libraryCardDialog: document.querySelector("#library-card-dialog"),
    libraryCardDialogContent: document.querySelector("#library-card-dialog-content"),
    libraryActionMenu: document.querySelector("#library-action-menu"),
    libraryActionTitle: document.querySelector("#library-action-title"),
    libraryScheduleDialog: document.querySelector("#library-schedule-dialog"),
    scheduleWeekLabel: document.querySelector("#schedule-week-label"),
    scheduleDateGrid: document.querySelector("#schedule-date-grid"),
    aiBotPage: document.querySelector("#ai-bot-page"),
    aiBotMessages: document.querySelector("#ai-bot-messages"),
    aiBotForm: document.querySelector("#ai-bot-form"),
    aiBotInput: document.querySelector("#ai-bot-input"),
    aiBotSend: document.querySelector("#ai-bot-send"),
    aiBotClose: document.querySelector("#ai-bot-close"),
    aiBotReset: document.querySelector("#ai-bot-reset"),
    toast: document.querySelector("#toast"),
    recentSearches: document.querySelector("#recent-searches"),
    peopleList: document.querySelector("#people-list"),
    settingsTopicChips: document.querySelector("#settings-topic-chips"),
    settingsTopicInput: document.querySelector("#settings-topic-input"),
    settingsComplexity: document.querySelector("#settings-complexity"),
    settingsComplexityLabel: document.querySelector("#settings-complexity-label"),
  });
}

function bindEvents() {
  document.querySelectorAll("[data-onboarding-next]").forEach((button) => {
    button.addEventListener("click", () => showOnboardingStep(onboardingStep + 1));
  });
  document.querySelectorAll("[data-onboarding-back]").forEach((button) => {
    button.addEventListener("click", () => showOnboardingStep(onboardingStep - 1));
  });
  const confettiBtn = document.querySelector("[data-confetti-trigger]");
  if (confettiBtn) confettiBtn.addEventListener("click", () => fireConfetti(confettiBtn));
  document.querySelectorAll("[data-identity]").forEach((button) => {
    button.addEventListener("click", () => selectIdentity(button.dataset.identity));
  });
  document.querySelectorAll("[data-topic-suggestion]").forEach((button) => {
    button.addEventListener("click", () => {
      elements.onboardingTopicInput.value = button.dataset.topicSuggestion;
      elements.onboardingTopicInput.focus();
    });
  });
  elements.analyzeTopicButton.addEventListener("click", prepareResearchIntent);
  document.querySelector("#edit-research-intent").addEventListener("click", () => {
    showOnboardingStep(1);
    elements.onboardingTopicInput.focus();
  });
  document.querySelectorAll("[data-style]").forEach((button) => {
    button.addEventListener("click", () => selectDiscoveryStyle(button.dataset.style));
  });
  elements.complexitySlider.addEventListener("input", () => {
    onboardingProfile.complexity = Number(elements.complexitySlider.value);
    updateComplexityLabel(elements.complexityValue, onboardingProfile.complexity);
  });
  document.querySelector("#onboarding-finish").addEventListener("click", finishOnboarding);

  if (elements.searchToggle) {
    elements.searchToggle.addEventListener("click", () => {
      elements.searchPanel.hidden = !elements.searchPanel.hidden;
      if (!elements.searchPanel.hidden) elements.searchInput.focus();
    });
  }
  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    elements.searchPanel.hidden = true;
    performSearch(elements.searchInput.value);
  });

  elements.dismissButton.addEventListener("click", () => decide("dismiss"));
  elements.priorityButton.addEventListener("click", () => decide("priority"));
  elements.readButton.addEventListener("click", () => decide("read"));
  elements.saveButton.addEventListener("click", () => decide("save"));

  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      event.preventDefault();
      switchView(viewButton.dataset.view);
      return;
    }
    const trendTab = event.target.closest("[data-trend-scope]");
    if (trendTab) {
      event.preventDefault();
      setTrendScope(trendTab.dataset.trendScope);
      return;
    }
    const trendPaperRow = event.target.closest("[data-trend-paper]");
    if (trendPaperRow) {
      event.preventDefault();
      event.stopPropagation();
      const topicId = trendPaperRow.dataset.trendPaper;
      const idx = Number(trendPaperRow.dataset.trendPaperIndex);
      openTrendPaperOverlay(topicId, idx);
      return;
    }
    const trendExpand = event.target.closest("[data-trend-expand]");
    if (trendExpand) {
      event.preventDefault();
      toggleTrendExpand(trendExpand.dataset.trendExpand);
      return;
    }
    const weekplanExport = event.target.closest("[data-weekplan-export]");
    if (weekplanExport) {
      exportWeekPlanIcs(weekplanExport.dataset.weekplanExport);
      return;
    }
    const toppickFlipBtn = event.target.closest("[data-bot-flip-btn]");
    if (toppickFlipBtn) {
      event.stopPropagation();
      const card = toppickFlipBtn.closest("[data-bot-flip]");
      if (card) card.classList.toggle("is-flipped");
      return;
    }
    const toppickFlip = event.target.closest("[data-bot-flip]");
    if (toppickFlip) {
      toppickFlip.classList.toggle("is-flipped");
      return;
    }
    const exploreBubble = event.target.closest("[data-explore-topic]");
    if (exploreBubble) {
      toggleExploreTopic(exploreBubble.dataset.exploreTopic);
      return;
    }
    const exploreAdd = event.target.closest("[data-explore-add]");
    if (exploreAdd) {
      promptExploreCustomTopic();
      return;
    }
    const imageButton = event.target.closest("[data-generate-image-id]");
    if (imageButton) {
      generatePaperVisual(imageButton.dataset.generateImageId);
      return;
    }
    const cardAction = event.target.closest("[data-card-action]");
    if (cardAction) {
      decide(cardAction.dataset.cardAction);
      return;
    }
    const queryButton = event.target.closest("[data-query]");
    if (queryButton) {
      elements.searchInput.value = queryButton.dataset.query;
      elements.searchPanel.hidden = true;
      switchView("discover");
      performSearch(queryButton.dataset.query);
      return;
    }
    const weekPlanAction = event.target.closest("[data-week-plan-action]");
    if (weekPlanAction) {
      event.preventDefault();
      event.stopPropagation();
      handleWeekPlanAction(weekPlanAction.dataset.id, weekPlanAction.dataset.weekPlanAction);
      return;
    }
    const weekNavButton = event.target.closest("[data-week-nav]");
    if (weekNavButton) {
      event.preventDefault();
      const delta = Number(weekNavButton.dataset.weekNav) || 0;
      state.weekPlanOffset = (state.weekPlanOffset || 0) + delta;
      renderWeekPlan();
      return;
    }
    const weekPlanCard = event.target.closest("[data-week-plan-card]");
    if (weekPlanCard) {
      const shell = weekPlanCard.closest(".wp-item-shell");
      if (shell && shell.classList.contains("is-revealed")) {
        // First click on a revealed shell just closes the action drawer.
        shell.classList.remove("is-revealed");
        shell.style.setProperty("--wp-swipe", "0px");
        return;
      }
      openWeekPlanCard(weekPlanCard.dataset.id);
      return;
    }
    const detailButton = event.target.closest("[data-detail-id]");
    if (detailButton) {
      dismissDialog(elements.libraryCardDialog);
      openDetails(detailButton.dataset.detailId);
      return;
    }
    const libraryTag = event.target.closest("[data-library-tag]");
    if (event.target.closest('[data-library-clear-filters]')) {
      state.libraryTags = []; state.librarySearch = '';
      elements.librarySearchInput.value = ''; elements.librarySearchClear.hidden = true;
      renderLibrary(); animateLibraryChange(); return;
    }
    if (libraryTag) {
      const tag = libraryTag.dataset.libraryTag;
      const index = state.libraryTags.indexOf(tag);
      if (index === -1) state.libraryTags.push(tag);
      else state.libraryTags.splice(index, 1);
      renderLibrary();
      animateLibraryChange();
      return;
    }
    const libraryCard = event.target.closest("[data-library-card]");
    if (libraryCard && !event.target.closest("button")) {
      // If a long-press overlay is open, don't open the detail dialog —
      // the overlay's own click handler will dismiss it if the tap is outside the buttons.
      if (libraryPressCard) return;
      if (state.librarySelectMode) {
        toggleLibrarySelection(libraryCard.dataset.id);
      } else {
        openLibraryCard(libraryCard.dataset.id);
      }
      return;
    }
    const libraryAction = event.target.closest("[data-library-action]");
    if (libraryAction) {
      event.preventDefault();
      handleLibraryAction(libraryAction.dataset.libraryAction);
      return;
    }
    const scheduleWeekBtn = event.target.closest("[data-schedule-week]");
    if (scheduleWeekBtn) {
      state.scheduleWeekOffset = (state.scheduleWeekOffset || 0) + Number(scheduleWeekBtn.dataset.scheduleWeek);
      renderScheduleGrid();
      return;
    }
    const scheduleDate = event.target.closest("[data-schedule-date]");
    if (scheduleDate) {
      event.preventDefault();
      state.scheduleDraftDate = scheduleDate.dataset.scheduleDate;
      renderScheduleGrid();
      return;
    }
    const schedulePriority = event.target.closest("[data-schedule-priority]");
    if (schedulePriority) {
      event.preventDefault();
      setPaperPriority(schedulePriority.dataset.schedulePriority);
      return;
    }
    const scheduleConfirm = event.target.closest("[data-schedule-confirm]");
    if (scheduleConfirm) {
      event.preventDefault();
      assignPaperToDate(state.scheduleDraftDate);
      return;
    }
    const removeButton = event.target.closest("[data-remove-id]");
    if (removeButton) {
      dismissDialog(elements.libraryCardDialog);
      removeFromLibrary(removeButton.dataset.removeId);
      return;
    }
    const closeButton = event.target.closest("[data-close-dialog]");
    if (closeButton) {
      dismissDialog(document.querySelector(`#${closeButton.dataset.closeDialog}`));
      return;
    }
    const topicRemove = event.target.closest("[data-settings-topic-remove]");
    if (topicRemove) {
      removeSettingsTopic(topicRemove.dataset.settingsTopicRemove);
      return;
    }
  });

  document.querySelector("#dialog-close").addEventListener("click", () => dismissDialog(elements.dialog));

  const aiBotButton = document.querySelector("#ai-bot-button");
  if (aiBotButton) {
    aiBotButton.addEventListener("click", () => {
      openAiBotPage();
    });
  }

  if (elements.libraryExportToggle) {
    elements.libraryExportToggle.addEventListener("click", () => toggleLibrarySelectMode());
  }
  if (elements.librarySearchInput) {
    elements.librarySearchInput.addEventListener("input", () => {
      state.librarySearch = elements.librarySearchInput.value.trim().toLowerCase();
      elements.librarySearchClear.hidden = !state.librarySearch;
      renderLibrary();
    });
  }
  if (elements.librarySearchClear) {
    elements.librarySearchClear.addEventListener("click", () => {
      elements.librarySearchInput.value = "";
      state.librarySearch = "";
      elements.librarySearchClear.hidden = true;
      renderLibrary();
      elements.librarySearchInput.focus();
    });
  }
  if (elements.libraryExportBar) {
    elements.libraryExportBar.addEventListener("click", (event) => {
      const action = event.target.closest("[data-library-export-action]")?.dataset.libraryExportAction;
      if (!action) return;
      if (action === "all") selectAllLibraryVisible();
      else if (action === "delete") deleteLibraryPapers([...state.librarySelected]);
      else if (action === "cancel") toggleLibrarySelectMode(false);
      else if (action === "bibtex") exportSelectedBibTeX();
      else if (action === "zotero") exportSelectedToZotero();
    });
  }
  if (elements.aiBotClose) {
    elements.aiBotClose.addEventListener("click", closeAiBotPage);
  }
  if (elements.aiBotReset) {
    elements.aiBotReset.addEventListener("click", () => {
      renderBotGreeting();
      elements.aiBotInput.value = "";
      elements.aiBotInput.style.height = "auto";
      elements.aiBotInput.focus();
    });
  }
  if (elements.aiBotMessages) {
    elements.aiBotMessages.addEventListener("click", (event) => {
      const suggestion = event.target.closest("[data-bot-prompt]");
      if (!suggestion) return;
      const prompt = AI_BOT_PROMPTS.find((item) => item.id === suggestion.dataset.botPrompt);
      if (!prompt) return;
      if (prompt.autoSend) {
        elements.aiBotInput.value = window.PaperSwipeI18n?.t(prompt.prefill) || prompt.prefill;
        sendBotMessage();
        return;
      }
      elements.aiBotInput.value = window.PaperSwipeI18n?.t(prompt.prefill) || prompt.prefill;
      elements.aiBotInput.focus();
      elements.aiBotInput.dispatchEvent(new Event("input"));
      const cursor = elements.aiBotInput.value.indexOf("……");
      if (cursor >= 0) elements.aiBotInput.setSelectionRange(cursor, cursor + 2);
    });
  }
  if (elements.aiBotSend) {
    elements.aiBotSend.addEventListener("click", (event) => {
      event.preventDefault();
      sendBotMessage();
    });
  }
  if (elements.aiBotForm) {
    elements.aiBotForm.addEventListener("submit", (event) => {
      event.preventDefault();
      sendBotMessage();
    });
  }
  if (elements.aiBotInput) {
    elements.aiBotInput.addEventListener("input", () => {
      elements.aiBotInput.style.height = "auto";
      elements.aiBotInput.style.height = Math.min(elements.aiBotInput.scrollHeight, 120) + "px";
    });
    elements.aiBotInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendBotMessage();
      }
    });
  }
  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dismissDialog(dialog);
    });
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); dismissDialog(dialog); });
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.libraryFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", String(active));
      });
      renderLibrary();
      animateLibraryChange();
    });
  });

  document.querySelector("#save-topics-button").addEventListener("click", saveSettingsTopics);
  elements.settingsTopicInput.addEventListener('input', () => { topicEditRevision++; document.querySelector('#topic-update-error').hidden = true; });
  elements.settingsTopicInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing && (event.ctrlKey || event.metaKey)) { event.preventDefault(); saveSettingsTopics(); }
  });
  document.querySelector('#reset-topic-draft').addEventListener('click', () => {
    topicEditRevision++; settingsTopicDraft = [...onboardingProfile.topics];
    elements.settingsTopicInput.value = onboardingProfile.researchIntent || onboardingProfile.searchQuery || settingsTopicDraft.join(' ');
    document.querySelector('#topic-update-error').hidden = true; renderSettings();
  });
  // Keep research preferences together, then display preferences and optional integration.
  const readerSection = document.querySelector('[aria-labelledby="feed-settings-title"]');
  document.querySelector('[aria-labelledby="research-theme-title"]').after(readerSection);
  document.querySelectorAll("[data-appearance]").forEach((button) => {
    button.addEventListener("click", () => selectAppearance(button.dataset.appearance));
  });
  document.querySelectorAll("[data-settings-style]").forEach((button) => {
    button.addEventListener("click", () => {
      onboardingProfile.discoveryStyle = button.dataset.settingsStyle;
      persistProfile();
      renderSettings();
    });
  });
  bindReaderPicker();
  document.querySelector('#refresh-search').addEventListener('click',()=>{
    if(state.loading){showToast('正在完成本次搜索，请稍候');return;}
    void performSearch(state.query,{refresh:true});
  });
  document.querySelector('#apply-reader-settings').addEventListener('click',()=>{
    if(state.streaming){showToast('请等待当前搜索完成后应用设置');return;}
    closeSettingsPage();switchView('discover');void performSearch(state.query);
  });
  elements.settingsComplexity.addEventListener("input", () => {
    onboardingProfile.complexity = Number(elements.settingsComplexity.value);
    updateComplexityLabel(elements.settingsComplexityLabel, onboardingProfile.complexity);
    persistProfile();
  });
  document.querySelector("#restart-onboarding").addEventListener("click", () => {
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    window.location.assign("/?onboarding=1");
  });

  const zoteroApiKeyInput = document.querySelector("#zotero-api-key");
  const zoteroUserIdInput = document.querySelector("#zotero-user-id");

  bindLibraryLongPress();
  const zoteroTestBtn = document.querySelector("#zotero-test-button");
  const zoteroClearBtn = document.querySelector("#zotero-clear-button");
  const saved = loadZoteroCredentials();
  if (zoteroApiKeyInput && saved.apiKey) zoteroApiKeyInput.value = saved.apiKey;
  if (zoteroUserIdInput && saved.userId) zoteroUserIdInput.value = saved.userId;
  if (zoteroApiKeyInput) zoteroApiKeyInput.addEventListener("change", persistZoteroCredentials);
  if (zoteroUserIdInput) zoteroUserIdInput.addEventListener("change", persistZoteroCredentials);
  if (zoteroTestBtn) zoteroTestBtn.addEventListener("click", testZoteroConnection);
  if (zoteroClearBtn) zoteroClearBtn.addEventListener("click", clearZoteroCredentials);

  if (elements.settingsToggle) elements.settingsToggle.addEventListener("click", openSettingsPage);
  if (elements.settingsClose) elements.settingsClose.addEventListener("click", closeSettingsPage);

  bindWeekPlanSwipe();

  document.addEventListener("keydown", (event) => {
    if (!state.started || state.activeView !== "discover" || state.actionBusy || dragging || anyDialogOpen() || event.target.matches("input, textarea")) return;
    if (!currentPaper()) return;
    if (event.key === "ArrowLeft") decide("dismiss");
    if (event.key === "ArrowUp") decide("priority");
    if (event.key === "ArrowDown") decide("read");
    if (event.key === "ArrowRight") decide("save");
    if (event.key === " " || event.key === "Spacebar") { event.preventDefault(); isFlipped ? unflip() : flip(); }
  });
}

function loadOnboardingProfile() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(ONBOARDING_STORAGE_KEY));
    if (!saved) return null;
    const topics = Array.isArray(saved.topics)
      ? saved.topics.map((topic) => String(topic).trim()).filter(Boolean).slice(0, 8)
      : [];
    const searchQuery = String(saved.searchQuery || topics[0] || "").trim();
    if (!searchQuery) return null;
    return {
      ...DEFAULT_PROFILE,
      ...saved,
      researchIntent: String(saved.researchIntent || searchQuery).trim(),
      searchQuery,
      topics: topics.length ? topics : [searchQuery],
    };
  } catch (_) {
    return null;
  }
}

function loadAppearance() {
  const saved = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
  return ["light", "system", "dark"].includes(saved) ? saved : "light";
}

function fireConfetti(popperBtn) {
  const step = popperBtn.closest(".onboarding-step");
  const canvas = step && step.querySelector("[data-confetti-canvas]");
  if (!canvas) return;
  if (popperBtn.classList.contains("is-firing")) return;
  popperBtn.classList.add("is-firing");
  setTimeout(() => popperBtn.classList.remove("is-firing"), 520);

  const rect = step.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const btnRect = popperBtn.getBoundingClientRect();
  const originX = btnRect.left - rect.left + btnRect.width / 2;
  const originY = btnRect.top - rect.top + btnRect.height / 2;
  const colors = ["#7655e8", "#a688ff", "#ff8f6b", "#26c5b5", "#ffb37a", "#f0b734", "#e85bba"];
  const particles = [];
  const count = 90;
  for (let i = 0; i < count; i++) {
    const angle = (-Math.PI / 2) + (Math.random() - 0.5) * (Math.PI * 0.72);
    const speed = 6 + Math.random() * 9;
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed + 2.5,
      vy: Math.sin(angle) * speed,
      w: 5 + Math.random() * 6,
      h: 8 + Math.random() * 10,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
      color: colors[i % colors.length],
      shape: Math.random() < 0.35 ? "circle" : "rect",
      life: 0,
      maxLife: 90 + Math.random() * 40,
    });
  }

  let raf = 0;
  function tick() {
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    let alive = 0;
    for (const p of particles) {
      p.life++;
      if (p.life > p.maxLife) continue;
      alive++;
      p.vy += 0.28;
      p.vx *= 0.995;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      const fade = Math.max(0, 1 - (p.life - p.maxLife * 0.65) / (p.maxLife * 0.35));
      ctx.save();
      ctx.globalAlpha = Math.min(1, fade);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === "circle") {
        ctx.beginPath();
        ctx.arc(0, 0, p.w * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }
    if (alive > 0) raf = requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  }
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(tick);
}

function showOnboardingStep(step) {
  onboardingStep = Math.max(0, Math.min(2, step));
  document.querySelectorAll("[data-onboarding-step]").forEach((panel) => {
    const active = Number(panel.dataset.onboardingStep) === onboardingStep;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
  document.querySelectorAll(".onboarding-progress span").forEach((dot, index) => {
    dot.classList.toggle("is-active", index === onboardingStep);
    dot.classList.toggle("is-complete", index < onboardingStep);
  });
  if (onboardingStep === 2) selectDiscoveryStyle(onboardingProfile.discoveryStyle || "focus");
  elements.onboarding.scrollTop = 0;
}

function selectIdentity(identity) {
  onboardingProfile.identity = identity;
  document.querySelectorAll("[data-identity]").forEach((button) => {
    const selected = button.dataset.identity === identity;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
}

function selectDiscoveryStyle(style) {
  onboardingProfile.discoveryStyle = style;
  document.querySelectorAll("[data-style]").forEach((button) => {
    const selected = button.dataset.style === style;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  document.querySelectorAll(".style-pager span").forEach((dot, index) => {
    dot.classList.toggle("is-active", index === (style === "focus" ? 0 : 1));
  });
  document.querySelectorAll("[data-style-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.stylePanel !== style;
  });
  if (style === "broaden") renderExploreTopics();
}

const EXPLORE_TOPIC_POOL = [
  "Biology", "Medicine", "Space", "Neuroscience",
  "Philosophy", "Climate", "Economics", "Psychology",
  "Music", "History", "Robotics", "Genetics",
];
const EXPLORE_MAX = 10;

function renderExploreTopics() {
  const cloud = document.querySelector("#explore-topics-cloud");
  if (!cloud) return;
  if (!Array.isArray(onboardingProfile.exploreTopics)) onboardingProfile.exploreTopics = [];
  const chosen = onboardingProfile.exploreTopics;
  const chosenSet = new Set(chosen);
  const customs = chosen.filter((t) => !EXPLORE_TOPIC_POOL.includes(t));
  const merged = EXPLORE_TOPIC_POOL.concat(customs);
  const reachedCap = chosen.length >= EXPLORE_MAX;
  const bubbles = merged.map((topic, i) => {
    const active = chosenSet.has(topic);
    const size = ["md", "lg", "sm", "md", "lg", "sm"][i % 6];
    const drift = (i * 137) % 12 - 6;
    const disabled = !active && reachedCap;
    return `<button type="button" class="explore-bubble is-${size}${active ? " is-active" : ""}${disabled ? " is-disabled" : ""}" data-explore-topic="${escapeAttribute(topic)}"${disabled ? " disabled" : ""} style="--bubble-index: ${i}; --bubble-drift: ${drift}px;">${escapeHTML(topic)}</button>`;
  });
  const addIndex = merged.length;
  const addDrift = (addIndex * 137) % 12 - 6;
  bubbles.push(`<button type="button" class="explore-bubble explore-bubble-add is-md${reachedCap ? " is-disabled" : ""}" data-explore-add${reachedCap ? " disabled" : ""} style="--bubble-index: ${addIndex}; --bubble-drift: ${addDrift}px;">＋ Add your own</button>`);
  cloud.innerHTML = bubbles.join("");
  const counter = document.querySelector("#explore-count");
  if (counter) counter.textContent = String(chosen.length);
}

function toggleExploreTopic(topic) {
  if (!Array.isArray(onboardingProfile.exploreTopics)) onboardingProfile.exploreTopics = [];
  const idx = onboardingProfile.exploreTopics.indexOf(topic);
  if (idx === -1) {
    if (onboardingProfile.exploreTopics.length >= EXPLORE_MAX) {
      showToast(`最多选择 ${EXPLORE_MAX} 个感兴趣领域`);
      return;
    }
    onboardingProfile.exploreTopics.push(topic);
  } else {
    onboardingProfile.exploreTopics.splice(idx, 1);
  }
  renderExploreTopics();
}

function promptExploreCustomTopic() {
  if (!Array.isArray(onboardingProfile.exploreTopics)) onboardingProfile.exploreTopics = [];
  if (onboardingProfile.exploreTopics.length >= EXPLORE_MAX) {
    showToast(`最多选择 ${EXPLORE_MAX} 个感兴趣领域`);
    return;
  }
  const cloud = document.querySelector("#explore-topics-cloud");
  if (!cloud || cloud.querySelector(".explore-bubble-input")) return;
  const addBtn = cloud.querySelector("[data-explore-add]");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "explore-bubble explore-bubble-input is-md";
  input.placeholder = "e.g. Design";
  input.maxLength = 30;
  const commit = (ok) => {
    const val = input.value.trim();
    input.remove();
    if (ok && val && !onboardingProfile.exploreTopics.includes(val)) {
      onboardingProfile.exploreTopics.push(val);
    }
    renderExploreTopics();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); commit(true); }
    else if (e.key === "Escape") commit(false);
  });
  input.addEventListener("blur", () => commit(true));
  if (addBtn) cloud.insertBefore(input, addBtn);
  else cloud.appendChild(input);
  input.focus();
}

async function prepareResearchIntent() {
  const description = elements.onboardingTopicInput.value.trim();
  if (Array.from(description).length < 6) {
    showToast("请再具体一点，至少写 6 个字符");
    elements.onboardingTopicInput.focus();
    return;
  }

  const label = elements.analyzeTopicButton.querySelector("span");
  const previousLabel = label.textContent;
  elements.analyzeTopicButton.disabled = true;
  label.textContent = "等待服务并分析主题…";

  try {
    const response = await fetch("/api/topic-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: 'wait=20' },
      body: JSON.stringify({ description }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "主题拆解失败");

    const keywords = Array.isArray(payload.keywords)
      ? payload.keywords.map((keyword) => String(keyword).trim()).filter(Boolean).slice(0, 8)
      : [];
    const searchQuery = String(payload.search_query || keywords.join(" ") || description).trim();
    onboardingProfile.researchIntent = description;
    onboardingProfile.searchQuery = searchQuery;
    onboardingProfile.topics = keywords.length ? keywords : [searchQuery];
    onboardingProfile.topicPlanAI = Boolean(payload.ai_enabled);
    elements.topicPlanMethod.textContent = payload.ai_enabled ? "AI SEARCH PLAN" : "SMART SEARCH PLAN";
    elements.topicPlanQuery.textContent = keywords.length ? keywords.join(" · ") : searchQuery;
    elements.topicPlanQuery.title = searchQuery;
    showOnboardingStep(2);
  } catch (error) {
    showToast(error.message);
  } finally {
    elements.analyzeTopicButton.disabled = false;
    label.textContent = previousLabel;
  }
}

function finishOnboarding() {
  if (!onboardingProfile.searchQuery) {
    showOnboardingStep(1);
    showToast("请先描述你的研究兴趣");
    return;
  }
  persistProfile();
  elements.onboarding.classList.add("is-finishing");
  window.setTimeout(() => startApp(onboardingProfile), 240);
}

function persistProfile() {
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(onboardingProfile));
}

function startApp(profile) {
  if (state.started) return;
  state.started = true;
  onboardingProfile = profile;
  state.query = profile.searchQuery || profile.topics[0] || state.query;
  elements.searchInput.value = state.query;
  document.body.classList.remove("is-onboarding");
  elements.onboarding.hidden = true;
  renderTrendBoard();
  renderSettings();
  refreshHealth();
  refreshLibrary();
  refreshStats();
  refreshSearches();
  bindCardGestures();
  performSearch(state.query);
}

let activeSearchController;
let searchRevision = 0;
async function performSearch(rawQuery, {refresh=false} = {}) {
  const query = String(rawQuery || "").trim();
  if (query.length < 2) {
    showToast("请输入至少 2 个字符");
    elements.searchInput.focus();
    return;
  }
  if (state.actionBusy) { showToast('请等待当前收藏操作完成'); return; }
  if (state.streaming && state.query === query) { showToast('这个主题仍在搜索，无需重复提交'); return; }
  activeSearchController?.abort();
  const revision = ++searchRevision;
  const controller = new AbortController();
  activeSearchController = controller;
  const searchTimeout = setTimeout(() => controller.abort(), 150000);
  state.loading = true;
  document.querySelector('#refresh-search').disabled=true;
  state.query = query;
  state.index = 0;
  state.papers = [];
  state.streaming = true;
  elements.searchInput.value = query;
  elements.searchNote.textContent = "";
  elements.resultSource.textContent = "正在检索开放论文源";
  elements.resultQuery.textContent = query;
  setActionEnabled(false);
  renderLoadingCard();
  const waitingLabel = elements.card.querySelector('#cardHero');
  if (waitingLabel) waitingLabel.textContent = '正在连接检索服务，繁忙时最多等待 20 秒…';

  let receivedAny = false;
  let completed = false;
  let cachedResult=false;
  let generatedAt='';
  let expectedPapers=0;
  const finalPapers = new Map();
  try {
    console.log(`[search] START q="${query}" @${new Date().toISOString()}`);
    const t0 = performance.now();
    const params = new URLSearchParams({q:query, limit:'20', ...readerPreferences()});
    if(refresh)params.set('refresh','1');
    const response = await fetch(`/api/search?${params}`, {
      headers: { Accept: "text/event-stream", Prefer: 'wait=20' },
      signal: controller.signal,
    });
    console.log(`[search] response received status=${response.status} elapsed=${(performance.now()-t0).toFixed(0)}ms`);
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `检索失败 (HTTP ${response.status})`);
    }
    if (!response.body) throw new Error("此浏览器不支持流式响应");

    await consumeSSE(response.body, (event, data) => {
      if (revision !== searchRevision) return;
      if (event === "meta") {
        cachedResult=Boolean(data.cached);generatedAt=data.generated_at || '';
        expectedPapers=Number(data.total) || 0;
        state.source = data.source || "Open papers";
        state.aiModel = data.ai_model || state.aiModel;
        state.imageEnabled = Boolean(data.image_enabled);
        elements.searchNote.textContent = data.warning || "";
        elements.resultSource.textContent = `${state.source} · 正在整理论文摘要`;
        elements.resultQuery.textContent = data.query || query;
        setEngineStatus(Boolean(data.ai_enabled));
        const hero = elements.card.querySelector('#cardHero');
        if (hero && data.total > 0) hero.textContent = data.ai_enabled ? '已找到论文，正在生成 AI 摘要…' : '已找到论文，正在整理卡片…';
      } else if (event === "batch") {
        if (completed) return;
        const wasWaiting = !currentPaper();
        for (const paper of (Array.isArray(data.papers) ? data.papers : [])) {
          if (paper.summary_status === 'pending' || finalPapers.has(paper.id)) continue;
          finalPapers.set(paper.id, paper);
          state.papers.push(paper);
        }
        receivedAny = state.papers.length > 0;
        elements.resultSource.textContent = `${state.source} · 已整理 ${finalPapers.size}/${expectedPapers || finalPapers.size} 篇`;
        if (wasWaiting && currentPaper() && !state.actionBusy) renderCard();
        // Never replace the active DOM: preserve flips, dragging and reading position.
        if (!state.actionBusy && !dragging) { renderUpcomingCards(); updateProgress(); }
      } else if (event === "done") {
        if (completed) return;
        completed = true;
        state.streaming = false;
        receivedAny = state.papers.length > 0;
        if (receivedAny && !currentPaper() && !state.actionBusy) renderCard();
        elements.resultSource.textContent = `${state.source} · ${state.papers.length} candidates`;
        console.log(`[search] done total=${state.papers.length} elapsed=${(performance.now()-t0).toFixed(0)}ms`);
        refreshSearches();
        const succeeded = state.papers.filter(p => p.summary_status === 'success').length;
        if (state.papers.length) elements.searchNote.textContent = succeeded === state.papers.length ? '已按本次搜索提交时的阅读设置生成，请以论文原文为准。' : `本次 ${state.papers.length - succeeded} 篇未获得 AI 摘要，保留原题；如需重新生成，请重新搜索。`;
        if(cachedResult && state.papers.length){
          const stamp=new Date(generatedAt);
          const time=Number.isNaN(stamp.getTime())?'':stamp.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
          const note=`已复用${time ? ' '+time+' 生成的' : '已有'}结果，未重复调用 AI；右上角可主动刷新。`;
          elements.searchNote.textContent=note;showToast(note);
        }
        if (state.papers.length === 0) {
          renderErrorCard(elements.searchNote.textContent || "没有找到论文，请换关键词或稍后重试。", elements.searchNote.textContent ? '论文源暂不可用' : '本次检索没有匹配结果');
        }
      }
    });
    if (!completed) throw new Error("搜索连接中断；已生成的卡片会保留，可重新搜索获取更多论文。");
  } catch (error) {
    if (revision !== searchRevision) return;
    if (error.name === 'AbortError') error = new Error('搜索等待超时；已生成的卡片会保留。');
    console.error("[search] failed", error);
    if (!receivedAny) {
      renderErrorCard(error.message);
      showToast(error.message);
    } else {
      showToast(`加载中断：${error.message}`);
    }
  } finally {
    clearTimeout(searchTimeout);
    if (revision !== searchRevision) return;
    state.loading = false;
    document.querySelector('#refresh-search').disabled=false;
    state.streaming = false;
    if (!currentPaper() && state.papers.length && !state.actionBusy) renderCard();
    if (state.papers.length && elements.resultSource) {
      elements.resultSource.textContent = `${state.source || "arXiv"} · ${state.papers.length} candidates`;
    }
  }
}

const {consumeSSE} = window.PaperSwipeStream;

function renderLoadingCard() {
  renderUpcomingCards();
  elements.card.className = "card theme-violet is-loading";
  elements.card.style.transform = "";
  elements.card.style.opacity = "";
  elements.card.style.boxShadow = "";
  elements.card.style.transition = "";
  isFlipped = false;
  elements.cardInner.classList.remove("is-flipped");
  elements.card.innerHTML = `
    <div class="stamp dismiss">NOPE</div>
    <div class="stamp save">YES</div>
    <div class="stamp priority">TOP</div>
    <div class="stamp read">DONE</div>
    <div class="card-inner" id="cardInner">
      <div class="card-face card-front" id="cardFront">
        <div class="card-hero" id="cardHero" style="display:grid;place-items:center;color:#fff;font-size:16px;font-weight:800;">
          Searching papers…
        </div>
      </div>
      <div class="card-face card-back" id="cardBack">
        <div class="card-back-face"><div class="back-hero theme-violet"><h2 class="back-title">Loading…</h2></div></div>
      </div>
    </div>`;
  elements.cardInner = document.querySelector("#cardInner");
  elements.cardFront = document.querySelector("#cardFront");
  elements.cardBack = document.querySelector("#cardBack");
  elements.cardHero = document.querySelector("#cardHero");
  setActionEnabled(false);
  updateProgress();
}

function renderSkeletonCard() {
  elements.card.className = "card theme-violet is-loading is-skeleton";
  elements.card.style.transform = "";
  elements.card.style.opacity = "";
  elements.card.style.boxShadow = "";
  elements.card.style.transition = "";
  isFlipped = false;
  elements.cardInner.classList.remove("is-flipped");
  elements.card.innerHTML = `
    <div class="card-inner" id="cardInner">
      <div class="card-face card-front" id="cardFront">
        <div class="card-hero skeleton-hero">
          <div class="skeleton-top">
            <span class="skeleton-chip"></span>
            <span class="skeleton-chip skeleton-chip-sm"></span>
          </div>
          <div class="skeleton-body">
            <span class="skeleton-line skeleton-line-lg"></span>
            <span class="skeleton-line skeleton-line-md"></span>
            <span class="skeleton-line skeleton-line-sm"></span>
          </div>
          <div class="skeleton-foot">
            <span class="skeleton-avatar"></span>
            <span class="skeleton-line skeleton-line-xs"></span>
          </div>
          <p class="skeleton-status">Loading next paper…</p>
        </div>
      </div>
      <div class="card-face card-back" id="cardBack">
        <div class="card-back-face"><div class="back-hero theme-violet"><h2 class="back-title">Loading…</h2></div></div>
      </div>
    </div>`;
  elements.cardInner = document.querySelector("#cardInner");
  elements.cardFront = document.querySelector("#cardFront");
  elements.cardBack = document.querySelector("#cardBack");
  elements.cardHero = document.querySelector(".skeleton-hero");
  setActionEnabled(false);
  updateProgress();
}

function renderErrorCard(message, title = '搜索暂未完成') {
  elements.card.className = "card theme-violet is-loading";
  elements.card.style.transform = "";
  elements.card.style.opacity = "";
  elements.card.style.boxShadow = "";
  elements.card.style.transition = "";
  isFlipped = false;
  elements.cardInner.classList.remove("is-flipped");
  elements.card.innerHTML = `
    <div class="card-inner" id="cardInner">
      <div class="card-face card-front" id="cardFront">
        <div class="search-recovery" id="cardHero">
          <span class="recovery-icon" aria-hidden="true"><i data-lucide="book-open-check"></i></span>
          <h2>${escapeHTML(title)}</h2>
          <p>${escapeHTML(message)}</p>
          <div class="recovery-query"><span>当前主题</span><strong data-i18n-skip>${escapeHTML(state.query)}</strong></div>
          <div class="recovery-actions"><button id="retry-search" type="button"><i data-lucide="rotate-cw"></i><span>重新检索</span></button><button id="change-search-topic" type="button">修改研究主题</button></div>
        </div>
      </div>
      <div class="card-face card-back" id="cardBack">
        <div class="card-back-face"><div class="back-hero theme-violet"><h2 class="back-title">No results</h2></div></div>
      </div>
    </div>`;
  elements.cardInner = document.querySelector("#cardInner");
  elements.cardFront = document.querySelector("#cardFront");
  elements.cardBack = document.querySelector("#cardBack");
  elements.cardHero = document.querySelector("#cardHero");
  document.querySelector("#retry-search")?.addEventListener("click", (event) => { event.stopPropagation(); performSearch(state.query); });
  document.querySelector('#change-search-topic')?.addEventListener('click', openSettingsPage);
  refreshIcons();
  setActionEnabled(false);
  updateProgress();
}

function renderCard() {
  seedFrontTranslations();
  const paper = currentPaper();
  renderUpcomingCards();
  /* Reset card state */
  elements.card.style.transition = "";
  elements.card.style.opacity = "";
  elements.card.style.boxShadow = "";
  elements.card.style.transform = "";
  isFlipped = false;
  elements.cardInner.classList.remove("is-flipped");

  if (!paper) {
    if (state.streaming) {
      renderSkeletonCard();
      return;
    }
    elements.card.className = "card theme-violet is-loading";
    elements.card.innerHTML = `
      <div class="card-inner" id="cardInner">
        <div class="card-face card-front" id="cardFront">
          <div class="card-hero theme-violet" style="display:grid;place-items:center;color:#fff;font-size:16px;font-weight:800;">
            All done ✨<br><small style="font-weight:400;opacity:.7">Check Library or search again</small>
          </div>
        </div>
        <div class="card-face card-back" id="cardBack">
          <div class="card-back-face"><div class="back-hero theme-violet"><h2 class="back-title">Done</h2></div></div>
        </div>
      </div>`;
    refreshElementRefs();
    setActionEnabled(false);
    updateProgress();
    return;
  }

  /* Map PaperSwipe paper → card-swipe-demo card format */
  const theme = paperTheme(paper);
  const venueName = paper.venue || paper.source || "";
  const venueYear = paper.year || "";
  const venueFull = [venueName, venueYear].filter(Boolean).join(" · ") || "Publication pending";
  /* Clean badge: "Conference Year" like card-swipe-demo's "NeurIPS 2022" */
  const venueBadge = paperVenueBadge(paper);

  const c = {
    theme: theme,
    title: paper.title,
    hook: pickSubtitle(paper),
    initials: getInitials(paper.authors?.[0]?.name || "PS"),
    author: formatAuthors(paper.authors),
    venueFull: venueFull,
    venueBadge: venueBadge,
    problem: paper.digest?.problem || "Check the introduction for the research question.",
    method: paper.digest?.method || firstNoveltyBullet(paper) || "Core method details need verification from the full text.",
    result: paper.digest?.result || "Key results not available in the abstract — check the experiments section.",
    noveltyBullets: noveltyBullets(paper),
    whyImportant: paper.digest?.why_keep || "Matches the search direction — skim before committing to a deep read.",
    whyRead: paper.digest?.audience || paper.digest?.reading_focus || "Relevant for researchers in this area.",
    fields: deriveTags(paper),
    bestFor: deriveBestFor(paper),
    url: paper.url || "",
    pdf_url: paper.pdf_url || "",
    read_minutes: mockReadMinutes(paper.read_minutes, paper.id),
    citation_count: mockCitationCount(paper.citation_count),
  };

  elements.card.className = "card " + c.theme;
  elements.card.style.transform = "";
  const rec = pickFriendRec(paper.id);
  let friendBannerHTML = "";
  if (rec) {
    const badge = rec.badge;
    friendBannerHTML = `
      <div class="friend-rec-banner" data-stop-click style="--badge-color:${badge.color}">
        <span class="frb-badge-emoji" aria-hidden="true">${badge.emoji}</span>
        <span class="frb-badge-text">${escapeHTML(badge.text)}</span>
      </div>`;
  }
  console.log("[card-front] id=%s hook=%s title=%s", paper.id, c.hook, c.title);
  elements.card.innerHTML = `
    ${friendBannerHTML}
    <div class="stamp dismiss">NOPE</div>
    <div class="stamp save">YES</div>
    <div class="stamp priority">TOP</div>
    <div class="stamp read">DONE</div>
    <div class="card-inner" id="cardInner">
      <!-- FRONT -->
      <div class="card-face card-front" id="cardFront">
        <div class="card-hero">
          <div class="card-top-wrap">
            <div class="card-topline">
              <span class="card-badge">${escapeHTML(c.venueBadge)}</span>
            </div>
            <div class="card-fields">${c.fields.map(escapeHTML).join(" · ")}</div>
          </div>
          <div class="flip-hint-front" id="flipHintFront">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"/></svg>
            Tap to flip
          </div>
          <div class="card-body">
            ${hookNotice(paper)}<p class="card-subtitle" data-field="hook">${escapeHTML(c.hook)}</p>
            <h2 class="card-title" data-field="title">${escapeHTML(c.title)}</h2>
          </div>
          <div class="card-byline">
            <span class="avatar">${escapeHTML(c.initials)}</span>
            <div class="byline-text"><strong>${escapeHTML(c.author)}</strong>${escapeHTML(c.venueFull)}</div>
          </div>
        </div>
      </div>
      <!-- BACK -->
      <div class="card-face card-back" id="cardBack">
        <div class="card-back-face">
          <div class="back-hero">
            <div class="back-topline">
              <span class="card-badge">${escapeHTML(c.venueBadge)}</span>
            </div>
            <h2 class="back-title">${escapeHTML(c.title)}</h2>
            <div class="back-byline">${escapeHTML(c.author)}</div>
          </div>
          <div class="back-details">
            <!-- Highlights -->
            <div class="detail-section">
              <div class="detail-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                Highlights
              </div>
              <div class="highlight-list">
                <div class="hl-item">
                  <span class="hl-badge problem">Problem</span>
                  <p>${boldMarkup(escapeHTML(truncateText(c.problem)))}</p>
                </div>
                <div class="hl-item">
                  <span class="hl-badge method">Method</span>
                  <p>${boldMarkup(escapeHTML(truncateText(c.method)))}</p>
                </div>
                <div class="hl-item">
                  <span class="hl-badge result">Results</span>
                  <p>${boldMarkup(escapeHTML(truncateText(c.result)))}</p>
                </div>
              </div>
            </div>

            <div class="back-divider"></div>

            <!-- What's New -->
            <div class="detail-section">
              <div class="detail-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                What's New
              </div>
              <ul class="detail-bullets">${(c.noveltyBullets || []).map((b) => `<li>${boldMarkup(escapeHTML(b))}</li>`).join("")}</ul>
            </div>

            <div class="back-divider"></div>

            <!-- Why It Matters -->
            <div class="detail-section">
              <div class="detail-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                Why It Matters
              </div>
              <div class="why-grid">
                <div class="why-col">
                  <span class="why-tag">For the field</span>
                  <p>${escapeHTML(c.whyImportant)}</p>
                </div>
                <div class="why-col">
                  <span class="why-tag">For you</span>
                  <p>${escapeHTML(c.whyRead)}</p>
                </div>
              </div>
            </div>

            <div class="back-divider"></div>

            <!-- Best for -->
            <div class="detail-section">
              <div class="detail-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                Best for
              </div>
              <div class="best-for-row">
                ${c.bestFor.map(t => `<span class="best-chip">${escapeHTML(t)}</span>`).join("")}
              </div>
            </div>

            <div class="source-links">
              <div class="source-stats-row">
                <span class="source-stat"><span class="source-stat-emoji">📖</span>${c.read_minutes} min</span>
                <span class="source-stat"><span class="source-stat-emoji">🌟</span>${escapeHTML(citationLabel(paper))}</span>
              </div>
              <div class="source-links-row">
                ${c.url ? `<a class="source-link" href="${escapeAttribute(c.url)}" target="_blank" rel="noopener" data-stop-click>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Original
                </a>` : ""}
                ${c.pdf_url ? `<a class="source-link" href="${escapeAttribute(c.pdf_url)}" target="_blank" rel="noopener" data-stop-click>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                  PDF
                </a>` : ""}
              </div>
            </div>

            <div class="flip-hint-back">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"/></svg>
              Tap to flip back
            </div>
          </div>
        </div>
      </div>
    </div>`;

  refreshElementRefs();
  updateStamps(0, 0, 0);
  updateProgress();
  setActionEnabled(true);

  // The next paper has already risen into place under the departing card.
  updateDeckProgress(0, false);
  window.PaperSwipeI18n?.apply(elements.card);
  window.PaperSwipeContentLanguage?.refresh();

}

/* Refresh cached element refs after innerHTML replacement */
function refreshElementRefs() {
  elements.cardInner = document.querySelector("#cardInner");
  elements.cardFront = document.querySelector("#cardFront");
  elements.cardBack = document.querySelector("#cardBack");
  elements.cardHero = document.querySelector("#cardHero");
}

/* ── Polish a hook for the card front subtitle ── */
function readerPreferences() {
  return {identity:onboardingProfile.identity || 'graduate', discoveryStyle:onboardingProfile.discoveryStyle || 'focus', complexity:Number(onboardingProfile.complexity) || 3};
}

let readerCloseTimer;
function renderReaderPicker() {
  const identities={graduate:['研究生','研究问题与方法学习'],researcher:['研究人员','创新、证据与局限'],enthusiast:['爱好者','背景与实际意义']};
  const value=identities[onboardingProfile.identity] ? onboardingProfile.identity : 'graduate';
  document.querySelector('#reader-current').textContent=identities[value][0];
  document.querySelector('#reader-current-description').textContent=identities[value][1];
  document.querySelectorAll('[data-reader-identity]').forEach(button=>{
    const selected=button.dataset.readerIdentity===value;
    button.setAttribute('aria-checked',String(selected));button.tabIndex=selected?0:-1;
  });
  const icon=document.querySelector(`[data-reader-identity="${value}"] svg`);
  if(icon)document.querySelector('.reader-symbol').innerHTML=icon.outerHTML;
}
function setReaderPickerOpen(open, restoreFocus=false) {
  const picker=document.querySelector('#reader-picker'),panel=document.querySelector('#reader-options'),trigger=document.querySelector('#settings-identity');
  clearTimeout(readerCloseTimer);
  trigger.setAttribute('aria-expanded',String(open));
  picker.classList.toggle('is-open',open);
  if(open){
    panel.hidden=false;panel.inert=false;panel.classList.remove('is-closing');
    panel.scrollIntoView({block:'nearest',behavior:'auto'});
  }else{
    panel.inert=true;panel.classList.add('is-closing');
    if(restoreFocus)trigger.focus({preventScroll:true});
    if(reducedMotion())panel.hidden=true;
    else readerCloseTimer=setTimeout(()=>{panel.hidden=true;panel.classList.remove('is-closing');},160);
  }
}
function bindReaderPicker() {
  const picker=document.querySelector('#reader-picker'),trigger=document.querySelector('#settings-identity'),panel=document.querySelector('#reader-options');
  const buttons=[...panel.querySelectorAll('[data-reader-identity]')];
  const choose=button=>{onboardingProfile.identity=button.dataset.readerIdentity;persistProfile();renderReaderPicker();};
  trigger.addEventListener('click',()=>setReaderPickerOpen(trigger.getAttribute('aria-expanded')!=='true'));
  trigger.addEventListener('keydown',event=>{
    if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();setReaderPickerOpen(true);panel.querySelector('[aria-checked="true"]').focus({preventScroll:true});}
  });
  buttons.forEach(button=>{
    button.addEventListener('click',()=>{choose(button);setReaderPickerOpen(false,true);showToast('身份已保存，下次搜索时生效');});
    button.addEventListener('keydown',event=>{
      const index=buttons.indexOf(button);let next;
      if(['ArrowDown','ArrowRight'].includes(event.key))next=(index+1)%buttons.length;
      if(['ArrowUp','ArrowLeft'].includes(event.key))next=(index+buttons.length-1)%buttons.length;
      if(event.key==='Home')next=0;if(event.key==='End')next=buttons.length-1;
      if(next!==undefined){event.preventDefault();choose(buttons[next]);buttons[next].focus({preventScroll:true});}
    });
  });
  picker.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setReaderPickerOpen(false,true);}});
  picker.addEventListener('focusout',event=>{if(!picker.contains(event.relatedTarget))setReaderPickerOpen(false);});
  document.addEventListener('pointerdown',event=>{if(!picker.contains(event.target)&&trigger.getAttribute('aria-expanded')==='true')setReaderPickerOpen(false);});
}


function polishHook(raw) {
  const text = window.PaperSwipeText.clean(raw).replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  if (text.length < 6) return null;
  if (/研究主题[（(]原题[）)]|暂无足够的论文信息/.test(text)) return null;
  // Old saved cards can contain promotional placeholders, not paper summaries.
  if (/matches current research interests|research paper worth checking out|noteworthy paper|advances the state of the art|值得关注的新思路|^一文读懂：|^给 AI 装上更好的记忆机制：|^让检索更准一步：|^让智能体更会办事：/i.test(text)) return null;
  if (/^(摘要|确认|建议|未提供|未明确|未报告|值得一看)[。.!！?？]*$/.test(text)) return null;
  // Preserve complete claims and their qualifiers; never cut a finding mid-sentence.
  return text;
}

/* The quote explains this paper, not why the user should like it. */
function pickSubtitle(paper) {
  const hook = polishHook(paper.digest?.hook);
  if (hook && hook.toLowerCase() !== String(paper.title || '').trim().toLowerCase()) return hook;
  // Legacy cards keep original records; one intact source sentence is safer
  // than manufacturing a finding from a title when the model was unavailable.
  const sentences = window.PaperSwipeText.clean(paper.abstract).trim().match(/[^.!?。！？]+[.!?。！？]?/g) || [];
  if (sentences.length) return (sentences.find(s => /we review|this review|we survey|we find|results show|we propose|we introduce|we investigate|本文|研究发现/i.test(s)) || sentences[0]).trim();
  const title = window.PaperSwipeText.clean(paper.title).trim();
  if (title) return title;
  return "暂无足够的论文信息，暂不能生成可靠概括。";
}

function hookNotice(paper) {
  const hook = polishHook(paper.digest?.hook);
  if (hook && hook !== paper.title && !['failed','disabled'].includes(paper.summary_status)) return '';
  return `<span class="card-hook-note">${paper.abstract ? 'Abstract excerpt · summary unavailable' : 'Title only · abstract unavailable'}</span>`;
}

function seedFrontTranslations() {
  const language = window.PaperSwipeContentLanguage;
  if (!language?.remember) return;
  for (const paper of [...state.papers,...state.library.map(entry => entry.paper)]) {
    const digest = paper.digest || {};
    language.remember(paper.title,'zh',digest.title_zh);
    language.remember(paper.title,'en',digest.title_en);
    const hook = polishHook(digest.hook);
    if (hook) language.remember(hook,'en',digest.hook_en);
  }
}

/* Derive "Best for" audience tags from paper data */
function deriveBestFor(paper) {
  const tags = [];
  if (paper.digest?.audience) {
    const audience = paper.digest.audience.toLowerCase();
    if (audience.includes("researcher")) tags.push("Researchers");
    if (audience.includes("engineer") || audience.includes("practitioner")) tags.push("Engineers");
    if (audience.includes("student") || audience.includes("beginner")) tags.push("Students");
  }
  if (tags.length < 3) {
    const fields = (paper.fields || []).filter(Boolean);
    if (fields.some(f => /LLM|agent|language|NLP/i.test(f)) && !tags.includes("NLP Practitioners")) tags.push("NLP Practitioners");
    if (fields.some(f => /vision|image|CV/i.test(f)) && !tags.includes("CV Researchers")) tags.push("CV Researchers");
    if (fields.some(f => /ML|deep|learning/i.test(f)) && !tags.includes("ML Engineers")) tags.push("ML Engineers");
  }
  if (tags.length < 3) tags.push("Researchers", "Engineers", "Students");
  return tags.slice(0, 3);
}

async function generatePaperVisual(id) {
  if (!state.imageEnabled || state.generatingImage) return;
  const papers = [...state.papers, ...state.library.map((entry) => entry.paper)];
  const paper = papers.find((item) => item.id === id);
  if (!paper) return;

  state.generatingImage = id;
  if (currentPaper()?.id === id) renderCard();
  showToast("正在生成论文视觉图，通常需要 20–90 秒");
  try {
    const response = await fetch("/api/paper-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paper_id: paper.id, title: paper.title, abstract: paper.abstract || "" }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "生成论文视觉图失败");
    const imageURL = normalizeURL(payload.url);
    if (!imageURL) throw new Error("图片模型没有返回有效地址");
    state.paperImages.set(id, imageURL);
    showToast(payload.cached ? "已恢复本次生成的视觉图" : "论文视觉图已生成");
  } catch (error) {
    showToast(error.message);
  } finally {
    state.generatingImage = "";
    if (currentPaper()?.id === id) renderCard();
  }
}

function paperTheme(paper) {
  const themes = ["theme-teal", "theme-violet", "theme-coral"];
  const hash = String(paper.title || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return themes[hash % themes.length];
}

function deriveTags(paper) {
  const fields = (paper.fields || []).filter(Boolean).slice(0, 3);
  if (fields.length >= 3) return fields;
  return [...fields, firstNoveltyBullet(paper) ? "Novel method" : "Research", paper.pdf_url ? "Open PDF" : "Metadata"].slice(0, 3);
}

// Stable subject identities across providers and library tabs. Utility badges
// (PDF availability, novelty) are not research disciplines.
const SUBJECT_ALIASES = {
  'cs.ai':'Artificial Intelligence', 'cs.cl':'Natural Language Processing',
  'cs.cv':'Computer Vision', 'cs.lg':'Machine Learning', 'stat.ml':'Machine Learning',
  'cs.ro':'Robotics', 'cs.hc':'Human-Computer Interaction', 'cs.se':'Software Engineering',
  '计算机科学':'Computer Science', '人工智能':'Artificial Intelligence',
  '自然语言处理':'Natural Language Processing', '计算机视觉':'Computer Vision', '机器学习':'Machine Learning',
};
function librarySubjects(paper) {
  const subjects = new Set();
  for (const raw of paper.fields || []) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const field = raw.trim(), canonical = SUBJECT_ALIASES[field.toLowerCase()] || SUBJECT_ALIASES[field] || window.PaperSwipeI18n?.t(field,'en') || field;
    subjects.add(canonical);
    if (/^cs\./i.test(field) || ['Artificial Intelligence','Natural Language Processing','Computer Vision','Machine Learning','Robotics','Human-Computer Interaction','Software Engineering'].includes(canonical)) subjects.add('Computer Science');
  }
  return [...subjects];
}

window.paperTranslationLookahead = () => {
  if (typeof state === 'undefined' || state.activeView !== 'discover' || document.body.classList.contains('is-onboarding')) return [];
  return state.papers.slice(state.index + 1,state.index + 3).flatMap(paper => [
    paper.title, pickSubtitle(paper), deriveTags(paper).join(' · '),
    truncateText(paper.digest?.problem), truncateText(paper.digest?.method || firstNoveltyBullet(paper)), truncateText(paper.digest?.result),
    ...noveltyBullets(paper), paper.digest?.why_keep, paper.digest?.audience || paper.digest?.reading_focus,
    ...deriveBestFor(paper),
  ]).filter(text => typeof text === 'string' && text.trim());
};

/* ── Stamp visibility (4-direction) ── */
function updateStamps(dx, dy, strength) {
  const card = elements.card;
  const stamps = {
    dismiss: card.querySelector(".stamp.dismiss"),
    save: card.querySelector(".stamp.save"),
    priority: card.querySelector(".stamp.priority"),
    read: card.querySelector(".stamp.read"),
  };
  if (!stamps.dismiss) return;
  const nls = Math.pow(strength, .65);
  stamps.dismiss.style.opacity = dx < -10 && Math.abs(dx) > Math.abs(dy) * .5 ? nls : 0;
  stamps.save.style.opacity = dx > 10 && Math.abs(dx) > Math.abs(dy) * .5 ? nls : 0;
  stamps.priority.style.opacity = dy < -10 && Math.abs(dy) > Math.abs(dx) * .6 ? nls : 0;
  stamps.read.style.opacity = dy > 10 && Math.abs(dy) > Math.abs(dx) * .6 ? nls : 0;
}

/* ── Gesture system (drag = swipe, tap = flip) ── */
function bindCardGestures() {
  const card = elements.card;
  const resetDrag = () => {
    dragging = false;
    document.body.style.userSelect = document.body.style.webkitUserSelect = '';
  };
  bindSwipeSurface(card, {
    canStart: event => Boolean(currentPaper()) && !state.actionBusy && !(isFlipped && event.target.closest('.back-details')),
    start() {
      dragging = true;
      document.body.style.userSelect = document.body.style.webkitUserSelect = 'none';
      window.getSelection()?.removeAllRanges();
    },
    move(dx, dy) {
      card.style.transform = `translate(${dx}px, ${dy}px) rotateX(${-dy / 300 * 16}deg) rotateY(${dx / 200 * 12}deg)`;
      const lift = Math.min(Math.hypot(dx, dy) / 30, 1), alpha = .10 + lift * .12;
      card.style.boxShadow = `0 1px 2px rgba(0,0,0,.04), 0 ${4+lift*8}px ${8+lift*10}px rgba(0,0,0,.06), 0 ${14+lift*16}px ${28+lift*20}px rgba(0,0,0,${alpha}), 0 ${28+lift*24}px ${56+lift*32}px rgba(0,0,0,${alpha*.8})`;
      const strength = Math.min(1, Math.max(Math.abs(dx), Math.abs(dy)) / 110);
      updateDeckProgress(strength, false);
      updateStamps(dx, dy, strength);
    },
    end: resetDrag,
    cancel() { resetDrag(); springBack(); },
    tap() {
      springBack();
      flipGuard = true;
      setTimeout(() => { flipGuard = false; }, 100);
      isFlipped ? unflip() : flip();
    },
    swipe(action) { if (isFlipped) unflip(); void decide(action); },
  });
  card.addEventListener('click', event => {
    if (flipGuard || !isFlipped || !currentPaper() || dragging) return;
    if (event.target.closest('button, a, [data-stop-click]')) return;
    unflip();
  });
}

function springBack() {
  elements.card.style.transition = "transform 520ms cubic-bezier(.17,.67,.38,1.4), box-shadow 420ms ease";
  elements.card.style.transform = "";
  elements.card.style.boxShadow = "";
  elements.card.addEventListener("transitionend", function h() {
    elements.card.style.transition = "";
    elements.card.removeEventListener("transitionend", h);
  });
  resetStacks();
  updateStamps(0, 0, 0);
}

function paperVenueBadge(paper) {
  return [paper.venue || paper.source, paper.year].filter(Boolean).join(' ') || 'Publication';
}

function renderUpcomingCards() {
  [elements.stack1, elements.stack2].forEach((layer, index) => {
    const paper = state.papers[state.index + index + 1];
    layer.hidden = !paper;
    layer.setAttribute('aria-hidden', 'true');
    layer.className = 'stack-layer stack-' + (index + 1) + ' upcoming-card ' + (paper ? paperTheme(paper) : '');
    if (!paper) { layer.replaceChildren(); return; }
    const venue = [paper.venue || paper.source, paper.year].filter(Boolean).join(' · ');
    layer.innerHTML = `<div class="card-hero"><div class="card-top-wrap"><div class="card-topline"><span class="card-badge">${escapeHTML(paperVenueBadge(paper))}</span></div><div class="card-fields">${deriveTags(paper).map(escapeHTML).join(' · ')}</div></div><div class="card-body"><p class="card-subtitle">${escapeHTML(pickSubtitle(paper))}</p><h2 class="card-title">${escapeHTML(paper.title)}</h2></div><div class="card-byline"><span class="avatar">${escapeHTML(getInitials(paper.authors?.[0]?.name || 'PS'))}</span><div class="byline-text"><strong>${escapeHTML(formatAuthors(paper.authors))}</strong>${escapeHTML(venue)}</div></div></div>`;
  });
}
function updateDeckProgress(progress, animate) {
  [elements.stack1, elements.stack2].forEach((layer, index) => {
    const depth = index + 1;
    layer.style.transition = animate && !reducedMotion() ? 'transform 320ms cubic-bezier(.22,1,.36,1)' : 'none';
    layer.style.transform = `translateY(${(depth - progress) * 24}px) scale(${1 - (depth - progress) * .035})`;
    layer.style.opacity = '1';
    layer.querySelectorAll('.card-hero > *').forEach(content => {
      content.style.transition = animate && !reducedMotion() ? 'opacity 280ms ease' : 'none';
      content.style.opacity = index === 0 ? String(progress) : '0';
    });
  });
}
function resetStacks() {
  updateDeckProgress(0, true);
}

/* ── Flip ── */
function flip() {
  if (!currentPaper()) return;
  isFlipped = true;
  if (elements.cardInner) elements.cardInner.classList.add("is-flipped");
  const fh = document.getElementById("flipHintFront");
  if (fh) fh.style.opacity = "0";
  if (elements.cardFront) elements.cardFront.style.pointerEvents = "none";
  if (elements.cardBack) elements.cardBack.style.pointerEvents = "auto";
}

function unflip() {
  if (!isFlipped) return;
  isFlipped = false;
  if (elements.cardInner) elements.cardInner.classList.remove("is-flipped");
  if (elements.cardFront) elements.cardFront.style.pointerEvents = "auto";
  if (elements.cardBack) elements.cardBack.style.pointerEvents = "none";
}

function fly(action, velocity) {
  unflip();
  updateDeckProgress(1, true);
  elements.card.style.transition = "transform 340ms cubic-bezier(.4,0,1,1), opacity 300ms ease";
  const boost = Math.min(1.6, 1 + (velocity || 0) * 0.7);
  let tx = 0, ty = 0, rx = 0, ry = 0;
  if (action === "dismiss") { tx = -130 * boost; ty = 20; rx = -3; ry = -18; }
  if (action === "save") { tx = 130 * boost; ty = 20; rx = -3; ry = 18; }
  if (action === "priority") { tx = 10; ty = -140 * boost; rx = -18; ry = 2; }
  if (action === "read") { tx = -5; ty = 140 * boost; rx = 18; ry = -2; }
  elements.card.style.transform = `translate(${tx}vw, ${ty}px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  elements.card.style.opacity = ".15";
  updateStamps(0, 0, 0);

  const labels = { dismiss: "Skipped", save: "Saved!", priority: "Marked Key!", read: "Marked Read" };
  showToast(labels[action] || action);

  setTimeout(() => {
    state.index += 1;
    renderCard();
    if (elements.hint && !elements.hint.classList.contains("is-gone")) {
      elements.hint.style.transition = "opacity 300ms ease";
      elements.hint.style.opacity = "0";
      elements.hint.classList.add("is-gone");
    }
  }, 320);
}

async function decide(action) {
  const paper = currentPaper();
  if (!paper || state.actionBusy) return;
  state.actionBusy = true;

  try {
    await PaperSwipeAPI.saveAction(paper, action);
    state.session[action] += 1;
    unflip();
    fly(action, 0);
    await Promise.all([refreshLibrary(), refreshStats(), new Promise(resolve => setTimeout(resolve, 340))]);
  } catch (err) {
    console.error("[decide] persist failed", { action, paperId: paper.id, err });
    springBack();
    showToast(`未同步到 Library：${err.message || err}`);
  } finally {
    state.actionBusy = false;
  }
}


async function refreshHealth() {
  try {
    const response = await fetch("/api/ai-status");
    const payload = await response.json();
    const imageStateChanged = state.imageEnabled !== Boolean(payload.image_enabled);
    state.aiModel = String(payload.ai_model || "");
    state.imageEnabled = Boolean(payload.image_enabled);
    state.imageModel = String(payload.image_model || "");
    setEngineStatus(Boolean(payload.ai_enabled));
    if (imageStateChanged && currentPaper()) renderCard();
  } catch (_) {
    setEngineStatus(false);
  }
}

function setEngineStatus(aiEnabled) {
  elements.aiStatus.textContent = aiEnabled ? `${state.aiModel || 'AI'} · 已配置` : "AI 未配置";
  elements.aiStatus.parentElement.classList.toggle("is-ai", aiEnabled);
}

const AI_BOT_PROMPTS = [
  {
    id: "daily",
    icon: "calendar-check-2",
    theme: "violet",
    title: "Plan today's reading",
    subtitle: "Turn your deadline and free time into a Library reading list",
    prefill: "My current goal is …  (Deadline: ___;  ___ minutes/day). Please plan today's reading from my Library, sorted by importance and time.",
  },
  {
    id: "today",
    icon: "sparkles",
    theme: "coral",
    title: "Which one should I read today?",
    subtitle: "Tell me your current focus, I'll pick the most relevant one",
    prefill: "I'm currently working on …  Please recommend the single paper in my Library I should read today, and explain why.",
  },
  {
    id: "roadmap",
    icon: "route",
    theme: "teal",
    title: "Too many papers — give me a roadmap",
    subtitle: "Cluster by topic and produce a staged reading path",
    prefill: "My Library has too many papers. Please give me a learning roadmap going from surveys to classics to the latest work.",
    autoSend: true,
  },
];

function renderBotGreeting() {
  elements.aiBotMessages.innerHTML = "";
  const count = state.library.length;
  const intent = onboardingProfile.researchIntent || onboardingProfile.searchQuery || "";
  const hero = document.createElement("div");
  hero.className = "ai-bot-hero";
  hero.innerHTML = `
    <img class="product-logo ai-bot-hero-avatar" src="/assets/paperswipe-logo.png" alt="PaperSwipe">
    <p class="ai-bot-hero-title">Hi, I'm your paper assistant</p>
    <p class="ai-bot-hero-sub">${count
      ? `<span>You have</span> <b>${count}</b> <span>papers in your Library.</span>${intent ? ` <span>Your focus:</span> <span data-i18n-skip>“${escapeHTML(shorten(intent,24))}”</span>` : ''} <span>Tell me your goal and I'll help you plan.</span>`
      : "Swipe a few papers into your Library from Explore, then I can help you plan your reading."}</p>
  `;
  elements.aiBotMessages.appendChild(hero);

  const suggestions = document.createElement("div");
  suggestions.className = "ai-bot-suggestions";
  suggestions.setAttribute("aria-label", "Suggested prompts");
  suggestions.innerHTML = AI_BOT_PROMPTS.map((prompt) => `
    <button type="button" class="ai-bot-suggestion theme-${prompt.theme}" data-bot-prompt="${prompt.id}">
      <span class="ai-bot-suggestion-icon"><i data-lucide="${prompt.icon}"></i></span>
      <div class="ai-bot-suggestion-copy">
        <strong>${escapeHTML(prompt.title)}</strong>
        <small>${escapeHTML(prompt.subtitle)}</small>
      </div>
      <i data-lucide="arrow-up-right" class="ai-bot-suggestion-arrow"></i>
    </button>
  `).join("");
  elements.aiBotMessages.appendChild(suggestions);
  refreshIcons();
}

function shorten(text, maxRunes) {
  const runes = Array.from(String(text || "").trim());
  if (runes.length <= maxRunes) return runes.join("");
  return runes.slice(0, maxRunes - 1).join("") + "…";
}

function truncateText(str) {
  if (!str) return "";
  const hasCJK = /[一-鿿㐀-䶿]/.test(str);
  if (hasCJK) {
    if (str.length <= 50) return str;
    return str.slice(0, 50) + '…';
  }
  const words = str.split(/\s+/);
  if (words.length <= 40) return str;
  return words.slice(0, 40).join(' ') + '…';
}

function boldMarkup(escapedText) {
  // Convert **phrase** → <strong>phrase</strong>. Runs AFTER escapeHTML so no XSS.
  return String(escapedText || "").replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
}

function appendBotMessage(text, role = "bot") {
  const el = document.createElement("div");
  el.className = `ai-bot-msg ${role}`;
  el.textContent = text;
  elements.aiBotMessages.appendChild(el);
  elements.aiBotMessages.scrollTop = elements.aiBotMessages.scrollHeight;
  return el;
}

function showBotTyping() {
  const el = document.createElement("div");
  el.className = "ai-bot-typing";
  el.innerHTML = "<span></span><span></span><span></span>";
  elements.aiBotMessages.appendChild(el);
  elements.aiBotMessages.scrollTop = elements.aiBotMessages.scrollHeight;
  return el;
}

function libraryPapersForBot() {
  return state.library.map((entry) => entry.paper).filter(Boolean);
}

function buildBotReply(query) {
  const q = query.toLowerCase();
  const papers = libraryPapersForBot();
  if (!papers.length) {
    return "Your Library is empty. Head back to Explore, swipe a few papers you're interested in, and I'll help you plan from there.";
  }
  if (/(每周|一周|按周|week|周计划|排一周|一周内|weekly|weekplan|per week)/i.test(query) ||
      (/(ddl|deadline|截止)/i.test(query) && /(每天.*分钟|每日.*分钟|min\/day|分钟\/?天|minutes?\s*\/?\s*day)/i.test(query))) {
    return buildWeekPlanReply(papers, query);
  }
  if (/(每日|每天|今日安排|任务|schedule|daily|ddl|deadline|空闲|计划|plan today)/i.test(query)) {
    return buildDailyPlanReply(papers, query);
  }
  if (/(今天.*读|该读|最应该读|优先读|priority|top pick|哪一篇|which.*read|read today)/i.test(query)) {
    return buildTopPickReply(papers, query);
  }
  if (/(roadmap|路线|路径|学习顺序|入门到进阶|阶段|分阶段|太多|从综述|综述.*经典|经典.*最新|learning path|too many)/i.test(query)) {
    return { type: "roadmap", data: window.__PAPERSWIPE_ROADMAP__ };
  }
  if (/(主题|方向|topic|领域|themes?)/i.test(query)) {
    const tags = {};
    papers.forEach((p) => deriveTags(p).forEach((t) => { if (t) tags[t] = (tags[t] || 0) + 1; }));
    const top = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (!top.length) return "I couldn't pull out clear themes from your papers yet — save a few more first.";
    return "The main themes in your Library:\n" + top.map(([t, n]) => `• ${t} (${n} papers)`).join("\n");
  }
  if (/(排序|顺序|order|sort)/i.test(query)) {
    const sorted = [...papers].sort((a, b) => (a.read_minutes || 99) - (b.read_minutes || 99));
    return "Sorted from shortest to longest read time:\n" + sorted.slice(0, 8).map((p, i) => `${i + 1}. ${p.title} (~${p.read_minutes || "?"} min)`).join("\n");
  }
  const cleaned = q.replace(/[?？。.,、\s]/g, "");
  if (cleaned.length >= 2) {
    const matched = papers.filter((p) =>
      (p.title || "").toLowerCase().includes(cleaned) ||
      (p.abstract || "").toLowerCase().includes(cleaned)
    );
    if (matched.length) {
      const p = matched[0];
      const tldr = p.digest?.tldr || p.abstract || "(no abstract available)";
      const authors = (p.authors || []).slice(0, 3).map((a) => a.name || a).join(", ") || "Unknown";
      return `Found "${p.title}":\n${tldr}\n\nAuthors: ${authors}`;
    }
  }
  return "I can help you:\n• Plan daily tasks around your deadline and free time\n• Pick the single paper you should read today\n• Generate a learning roadmap\n\nJust tell me your goal.";
}

function pickBestForToday(papers) {
  return [...papers].sort((a, b) => {
    const score = (p) => (p.match_score || 0) * 4 + Math.log1p(p.citation_count || 0) * 6 - (p.read_minutes || 30);
    return score(b) - score(a);
  })[0];
}

function buildDailyPlanReply(papers, query) {
  const minutesMatch = query.match(/(\d{1,3})\s*(?:min|分钟|min\/day)/i);
  const budget = minutesMatch ? Math.max(15, Math.min(240, Number(minutesMatch[1]))) : 60;
  const ordered = [...papers].sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
  const plan = [];
  let used = 0;
  for (const p of ordered) {
    const need = p.read_minutes || 20;
    if (used + need > budget && plan.length) break;
    plan.push(p);
    used += need;
    if (plan.length >= 4) break;
  }
  if (!plan.length) plan.push(ordered[0]);
  const header = `Based on your ~${budget}-minute budget, here's today's plan:`;
  const body = plan.map((p, i) => `${i + 1}. ${p.title} (~${p.read_minutes || 20} min · relevance ${p.match_score || "?"})`).join("\n");
  return `${header}\n${body}\n\nStart with the method framework and main experiments; treat each paper as a 30-minute pomodoro block. If you tell me your deadline, I can spread these across multiple days.`;
}

function parseDailyMinutes(query) {
  const m = query.match(/(?:每天|每日|daily|一天)[^0-9]{0,10}(\d{2,3})\s*(?:min|分钟)?/i)
    || query.match(/(\d{2,3})\s*(?:min|分钟)\s*\/?\s*(?:天|day)/i)
    || query.match(/(\d{2,3})\s*(?:min|分钟)/i);
  if (!m) return 45;
  return Math.max(15, Math.min(240, Number(m[1])));
}

function parseDDL(query) {
  const iso = query.match(/(20\d{2})[-\/年](\d{1,2})[-\/月](\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const md = query.match(/(\d{1,2})[-\/月](\d{1,2})\s*日?/);
  if (md) {
    const now = new Date();
    const d = new Date(now.getFullYear(), Number(md[1]) - 1, Number(md[2]));
    if (d < now) d.setFullYear(now.getFullYear() + 1);
    return d;
  }
  return null;
}

function stagePriorityFor(paper) {
  const roadmap = window.__PAPERSWIPE_ROADMAP__;
  if (roadmap && Array.isArray(roadmap.stages)) {
    for (let i = 0; i < roadmap.stages.length; i++) {
      const stage = roadmap.stages[i];
      const hit = (stage.papers || []).some((rp) => (rp.title || "").toLowerCase() === (paper.title || "").toLowerCase());
      if (hit) return { order: i, tag: stage.tag || "", accent: stage.accent || "violet" };
    }
  }
  const abstract = (paper.abstract || "").toLowerCase();
  const title = (paper.title || "").toLowerCase();
  if (/survey|综述|review/.test(title) || /survey|comprehensive review/.test(abstract)) {
    return { order: 0, tag: "Survey", accent: "violet" };
  }
  const year = Number(paper.year || paper.published_year || 0);
  if (year && year >= new Date().getFullYear() - 1) return { order: 2, tag: "Latest", accent: "teal" };
  return { order: 1, tag: "Classic", accent: "coral" };
}

function buildWeekPlanReply(papers, query) {
  const dailyBudget = parseDailyMinutes(query);
  const ddl = parseDDL(query);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let totalDays = 7;
  if (ddl) {
    const diff = Math.ceil((ddl.getTime() - today.getTime()) / 86400000);
    totalDays = Math.max(3, Math.min(14, diff));
  }
  const enriched = papers.map((p) => ({ paper: p, prio: stagePriorityFor(p) }));
  enriched.sort((a, b) => {
    if (a.prio.order !== b.prio.order) return a.prio.order - b.prio.order;
    return (b.paper.match_score || 0) - (a.paper.match_score || 0);
  });

  const days = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(today.getTime() + i * 86400000);
    return { date: d, minutes: 0, items: [] };
  });
  const overflow = [];
  let cursor = 0;
  for (const { paper, prio } of enriched) {
    const need = Number(paper.read_minutes) || 25;
    let placed = false;
    for (let step = 0; step < totalDays; step++) {
      const idx = (cursor + step) % totalDays;
      if (days[idx].minutes + need <= dailyBudget + 10) {
        days[idx].items.push({ paper, prio, minutes: need });
        days[idx].minutes += need;
        cursor = (idx + 1) % totalDays;
        placed = true;
        break;
      }
    }
    if (!placed) overflow.push({ paper, prio, minutes: need });
  }

  return {
    type: "weekplan",
    data: {
      title: `Your ${totalDays}-day reading plan at ${dailyBudget} min/day`,
      subtitle: ddl
        ? `Deadline: ${ddl.getFullYear()}/${ddl.getMonth() + 1}/${ddl.getDate()} · ${enriched.length - overflow.length} papers scheduled`
        : `${enriched.length - overflow.length} papers scheduled — Survey → Classic → Latest order`,
      dailyBudget,
      ddl: ddl ? ddl.toISOString() : null,
      days,
      overflow,
    },
  };
}

function buildTopPickReply(papers, query) {
  const pick = pickBestForToday(papers);
  if (!pick) return "I couldn't find a candidate right now. Try saving a few papers to your Library first.";
  const digest = pick.digest || {};
  const reason = digest.why_keep || digest.tldr || digest.verdict || "Highest relevance to your Library's main direction";
  const focus = digest.reading_focus || "Start with the method framework, main experiments, and limitations";
  return {
    type: "toppick",
    data: {
      paper: pick,
      reason,
      focus,
      intent: query.trim() ? shorten(query, 60) : "",
    },
  };
}

function appendBotRoadmap(data) {
  if (!data || !Array.isArray(data.stages) || !data.stages.length) {
    appendBotMessage("I couldn't generate a roadmap right now — please try again later.");
    return;
  }
  const container = document.createElement("div");
  container.className = "ai-bot-roadmap";
  container.innerHTML = `
    <header class="ai-bot-roadmap-head">
      <span class="ai-bot-roadmap-badge"><i data-lucide="route"></i></span>
      <div>
        <strong>${escapeHTML(data.title || "Your learning roadmap")}</strong>
        ${data.subtitle ? `<small>${escapeHTML(data.subtitle)}</small>` : ""}
      </div>
    </header>
    <ol class="ai-bot-roadmap-timeline">
      ${data.stages.map((stage, index) => `
        <li class="ai-bot-roadmap-stage accent-${stage.accent || "violet"}" style="--stage-index: ${index};">
          <span class="ai-bot-roadmap-node"><i data-lucide="${stage.icon || "dot"}"></i></span>
          <div class="ai-bot-roadmap-stage-body">
            <div class="ai-bot-roadmap-stage-head">
              <strong>${escapeHTML(stage.title || "")}</strong>
            </div>
            ${stage.hint ? `<p class="ai-bot-roadmap-hint">${escapeHTML(stage.hint)}</p>` : ""}
            <div class="ai-bot-roadmap-papers">
              ${(stage.papers || []).map((paper, paperIndex) => `
                <article class="ai-bot-roadmap-paper" style="--paper-index: ${paperIndex};">
                    <div class="ai-bot-roadmap-paper-meta">
                      <span class="ai-bot-roadmap-chip">${escapeHTML(stage.tag || "")}</span>
                      ${paper.year ? `<small>${escapeHTML(String(paper.year))}</small>` : ""}
                      ${paper.venue ? `<small>· ${escapeHTML(paper.venue)}</small>` : ""}
                      ${paper.minutes ? `<small class="ai-bot-roadmap-time"><i data-lucide="clock-3"></i>${escapeHTML(String(paper.minutes))} min</small>` : ""}
                    </div>
                    <h4>${escapeHTML(paper.title || "")}</h4>
                    ${paper.authors ? `<small class="ai-bot-roadmap-authors">${escapeHTML(paper.authors)}</small>` : ""}
                    ${paper.tldr ? `<p class="ai-bot-roadmap-tldr">${escapeHTML(paper.tldr)}</p>` : ""}
                  </article>
              `).join("")}
            </div>
          </div>
        </li>
      `).join("")}
    </ol>
  `;
  elements.aiBotMessages.appendChild(container);
  elements.aiBotMessages.scrollTop = elements.aiBotMessages.scrollHeight;
  refreshIcons();
  requestAnimationFrame(() => container.classList.add("is-visible"));
}

const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
let __weekPlanCounter = 0;

function appendBotWeekPlan(data) {
  if (!data || !Array.isArray(data.days) || !data.days.length) {
    appendBotMessage("I couldn't generate a week plan right now — please try again later.");
    return;
  }
  const planId = `wp${++__weekPlanCounter}${Date.now().toString(36)}`;
  window.__PAPERSWIPE_WEEKPLANS__ = window.__PAPERSWIPE_WEEKPLANS__ || {};
  window.__PAPERSWIPE_WEEKPLANS__[planId] = data;

  const container = document.createElement("div");
  container.className = "ai-bot-weekplan";
  const filledDays = data.days.filter((d) => d.items.length);
  container.innerHTML = `
    <header class="ai-bot-weekplan-head">
      <span class="ai-bot-weekplan-badge"><i data-lucide="calendar-check-2"></i></span>
      <div>
        <strong>${escapeHTML(data.title || "This week's reading plan")}</strong>
        ${data.subtitle ? `<small>${escapeHTML(data.subtitle)}</small>` : ""}
      </div>
    </header>
    <ol class="ai-bot-weekplan-days">
      ${filledDays.map((day, index) => {
        const d = new Date(day.date);
        const dateLabel = `${d.getMonth() + 1}/${d.getDate()} · ${WEEKDAY_LABEL[d.getDay()]}`;
        return `
          <li class="ai-bot-weekplan-day" style="--day-index: ${index};">
            <div class="ai-bot-weekplan-day-head">
              <span class="ai-bot-weekplan-date">${escapeHTML(dateLabel)}</span>
              <span class="ai-bot-weekplan-day-sum"><i data-lucide="clock-3"></i>${day.minutes} min</span>
            </div>
            <ul class="ai-bot-weekplan-items">
              ${day.items.map((it) => `
                <li class="ai-bot-weekplan-item accent-${escapeAttribute(it.prio.accent || "violet")}">
                  <span class="ai-bot-weekplan-chip">${escapeHTML(it.prio.tag || "")}</span>
                  <div class="ai-bot-weekplan-item-body">
                    <h5>${escapeHTML(it.paper.title || "")}</h5>
                    <small>~${it.minutes} min</small>
                  </div>
                </li>
              `).join("")}
            </ul>
          </li>
        `;
      }).join("")}
    </ol>
    ${data.overflow && data.overflow.length ? `
      <p class="ai-bot-weekplan-overflow">${data.overflow.length} more papers didn't fit — you can revisit them after the deadline.</p>
    ` : ""}
    <footer class="ai-bot-weekplan-foot">
      <button type="button" class="ai-bot-weekplan-cta" data-weekplan-export="${planId}">
        <i data-lucide="calendar-plus"></i>
        <span>Add to my calendar</span>
      </button>
      <small>Downloads a .ics file — double-click to import into Apple / Google / Outlook Calendar</small>
    </footer>
  `;
  elements.aiBotMessages.appendChild(container);
  elements.aiBotMessages.scrollTop = elements.aiBotMessages.scrollHeight;
  refreshIcons();
  requestAnimationFrame(() => container.classList.add("is-visible"));
}

function pad2(n) { return String(n).padStart(2, "0"); }

function icsDateTime(d) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
}

function icsEscape(text) {
  return String(text || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function exportWeekPlanIcs(planId) {
  const data = window.__PAPERSWIPE_WEEKPLANS__ && window.__PAPERSWIPE_WEEKPLANS__[planId];
  if (!data) { showToast("Plan not found — it may have expired"); return; }
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PaperSwipe//AI Bot//EN", "CALSCALE:GREGORIAN"];
  const stamp = icsDateTime(new Date());
  data.days.filter((day) => day.items.length).forEach((day, i) => {
    const start = new Date(day.date); start.setHours(20, 0, 0, 0);
    const end = new Date(start.getTime() + day.minutes * 60000);
    const summary = `PaperSwipe · ${day.items.length} papers · ${day.minutes}min`;
    const desc = day.items.map((it, idx) => `${idx + 1}. [${it.prio.tag}] ${it.paper.title} (~${it.minutes} min)`).join("\n");
    lines.push("BEGIN:VEVENT",
      `UID:${planId}-${i}@paperswipe`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDateTime(start)}`,
      `DTEND:${icsDateTime(end)}`,
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape(desc)}`,
      "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `paperswipe-plan-${new Date().toISOString().slice(0, 10)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  showToast(".ics file generated — double-click to import into your calendar");
}

function appendBotTopPick(data) {
  if (!data || !data.paper) {
    appendBotMessage("I couldn't find a candidate right now. Try saving a few papers to your Library first.");
    return;
  }
  const paper = data.paper;
  const digest = paper.digest || {};
  const theme = paperTheme(paper);
  const authors = formatAuthors(paper.authors);
  const authorInitials = getInitials(paper.authors?.[0]?.name || "PS");
  const venue = [paper.venue, paper.year].filter(Boolean).join(" · ") || "Publication pending verification";
  const tags = deriveTags(paper);
  const paperLink = safeURL(paper.url) ? `<a href="${escapeAttribute(paper.url)}" target="_blank" rel="noopener"><i data-lucide="external-link"></i>Original</a>` : "";
  const pdfLink = safeURL(paper.pdf_url) ? `<a href="${escapeAttribute(paper.pdf_url)}" target="_blank" rel="noopener"><i data-lucide="file-down"></i>PDF</a>` : "";
  const highlights = [
    { label: "Research question", icon: "search", text: digest.problem || "The abstract doesn't state the research question clearly." },
    { label: "Core method", icon: "book-open", text: digest.method || (Array.isArray(digest.novelty) ? digest.novelty.join(" ") : digest.novelty) || "The abstract doesn't spell out the method in detail." },
    { label: "Main results", icon: "sparkles", text: digest.result || "The abstract doesn't report verifiable results." },
  ];
  const minutes = Number(paper.read_minutes) || 0;
  const needsReproduction = /复现|repro|reproduc/i.test(digest.reading_focus || "") || /代码|code|开源/i.test(digest.audience || "");
  const focusText = digest.reading_focus || "Start with the method framework, main experiments, and limitations";

  const container = document.createElement("div");
  container.className = "ai-bot-toppick";
  container.innerHTML = `
    <article class="paper-card ai-bot-toppick-card ${theme}" data-bot-flip>
      <div class="card-flip">
        <div class="card-face card-front">
          <header class="knowledge-hero card-front-hero">
            <div class="knowledge-topline">
              <span>Knowledge Card · ${escapeHTML(paper.source || state.source || "PaperSwipe")}</span>
            </div>
            <div class="front-main">
              <h2 class="knowledge-title">${escapeHTML(paper.title)}</h2>
              <p class="front-tldr">${escapeHTML(digest.tldr || digest.verdict || "Tap the card for the full analysis")}</p>
            </div>
            <div class="knowledge-byline">
              <span class="author-avatar">${escapeHTML(authorInitials)}</span>
              <div><strong>${escapeHTML(authors)}</strong><span>${escapeHTML(venue)}</span></div>
            </div>
            <span class="match-pill">${numberOrZero(paper.match_score)}</span>
            <button class="flip-hint" type="button" data-bot-flip-btn aria-label="Flip to details"><i data-lucide="repeat"></i><span>Tap the card for highlights</span></button>
          </header>
        </div>
        <div class="card-face card-back">
          <div class="card-scroll">
            <div class="back-topbar">
              <button class="flip-back-button" type="button" data-bot-flip-btn aria-label="Back to summary"><i data-lucide="arrow-left"></i><span>Back</span></button>
              <strong>${escapeHTML(paper.title)}</strong>
            </div>
            <div class="knowledge-body">
              <section class="knowledge-section">
                <h3>Highlights</h3>
                <div class="core-idea">
                  ${highlights.map((item) => `
                    <div class="highlight-item">
                      <span class="core-node"><i data-lucide="${item.icon}"></i></span>
                      <div><strong>${item.label}</strong><p>${escapeHTML(item.text)}</p></div>
                    </div>`).join("")}
                </div>
              </section>
              <section class="knowledge-section">
                <h3>Key Contributions</h3>
                <div class="contribution-tags">${tags.map((tag) => `<span>${escapeHTML(tag)}</span>`).join("")}</div>
              </section>
              <section class="knowledge-section">
                <h3>Why it matters?</h3>
                <p class="insight-copy">${escapeHTML(digest.why_keep || digest.result || "Highly relevant to your current research direction and worth a deeper read next.")}</p>
              </section>
              <div class="paper-meta">
                <span><i data-lucide="gauge"></i>Match ${numberOrZero(paper.match_score)}</span>
                <span><i data-lucide="clock-3"></i>${mockReadMinutes(paper.read_minutes, paper.id)} min</span>
                <span><i data-lucide="quote"></i>${escapeHTML(citationLabel({ citation_count: mockCitationCount(paper.citation_count) }))}</span>
                ${paperLink}${pdfLink}
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
    <div class="ai-bot-toppick-brief">
      <p class="ai-bot-toppick-reason">${escapeHTML(data.reason)}</p>
      <ul class="ai-bot-toppick-facts">
        <li><i data-lucide="target"></i><span><strong>Reading focus:</strong> ${escapeHTML(focusText)}${needsReproduction ? " (worth reproducing hands-on)" : ""}</span></li>
        ${minutes ? `<li><i data-lucide="clock-3"></i><span><strong>Time needed:</strong> ~${minutes} min</span></li>` : ""}
      </ul>
    </div>
  `;
  elements.aiBotMessages.appendChild(container);
  elements.aiBotMessages.scrollTop = elements.aiBotMessages.scrollHeight;
  refreshIcons();
  requestAnimationFrame(() => container.classList.add("is-visible"));
}

function sendBotMessage() {
  const input = elements.aiBotInput;
  const text = input.value.trim();
  if (!text) return;
  clearBotWelcome();
  appendBotMessage(text, "user");
  input.value = "";
  input.style.height = "auto";
  const typing = showBotTyping();
  const delay = 500 + Math.min(text.length * 8, 900);
  setTimeout(() => {
    typing.remove();
    const reply = buildBotReply(text);
    if (reply && typeof reply === "object" && reply.type === "roadmap") {
      appendBotRoadmap(reply.data);
    } else if (reply && typeof reply === "object" && reply.type === "weekplan") {
      appendBotWeekPlan(reply.data);
    } else if (reply && typeof reply === "object" && reply.type === "toppick") {
      appendBotTopPick(reply.data);
    } else {
      appendBotMessage(reply);
    }
  }, delay);
}

function clearBotWelcome() {
  elements.aiBotMessages.querySelectorAll(".ai-bot-hero, .ai-bot-suggestions").forEach((el) => el.remove());
}

let libraryMutationRevision = 0;
let libraryDeleteBusy = false;

async function refreshLibrary() {
  const libraryRevision = libraryMutationRevision;
  const revision = scheduleRevision;
  try {
    const response = await fetch("/api/library");
    if (!response.ok) throw new Error('无法读取文献库');
    const payload = await response.json();
    if (libraryDeleteBusy || libraryRevision !== libraryMutationRevision) return;
    state.library = payload.papers || [];
    if (!scheduleBusy && revision === scheduleRevision) applyScheduleSnapshot(payload.schedule);
    const ids = new Set(state.library.map((entry) => entry.paper?.id).filter(Boolean));
    state.librarySelected = new Set([...state.librarySelected].filter(id => ids.has(id)));
    state.weekPlanDone = new Set([...state.weekPlanDone].filter((id) => ids.has(id)));
    state.weekPlanRemoved = new Set([...state.weekPlanRemoved].filter((id) => ids.has(id)));
    updateLibraryCounts();
    updateTodosBadge();
    if (state.activeView === "library") renderLibrary();
  } catch (_) {
    // Preserve the current list when the local API is temporarily unavailable.
  }
}

function filteredLibraryEntries() {
  let entries = state.library.filter((entry) => entry.action === state.libraryFilter);
  if (state.libraryTags.length) {
    entries = entries.filter((entry) => state.libraryTags.every(tag => librarySubjects(entry.paper).includes(tag)));
  }
  if (state.librarySearch) {
    const q = state.librarySearch;
    entries = entries.filter((entry) => {
      const p = entry.paper;
      return (p.title || "").toLowerCase().includes(q) ||
        (window.PaperSwipeContentLanguage?.lookup(p.title || '') || '').toLowerCase().includes(q) ||
        (p.authors || []).some((a) => (a.name || "").toLowerCase().includes(q)) ||
        (p.abstract || "").toLowerCase().includes(q) ||
        (p.venue || "").toLowerCase().includes(q);
    });
  }
  if (state.librarySort === "citations") {
    entries = [...entries].sort((a, b) => numberOrZero(b.paper.citation_count) - numberOrZero(a.paper.citation_count));
  } else if (state.librarySort === "easy") {
    entries = [...entries].sort((a, b) => numberOrZero(a.paper.read_minutes) - numberOrZero(b.paper.read_minutes));
  }
  return entries;
}

function renderLibrary() {
  const entries = filteredLibraryEntries();
  renderLibraryTags();
  if (!entries.length) {
    const labels = { save: "Interested", priority: "Key", read: "Read" };
    elements.libraryList.innerHTML = state.libraryTags.length || state.librarySearch
      ? `<div class="library-empty"><i data-lucide="list-filter"></i><h2>No matching papers</h2><button type="button" class="settings-secondary" data-library-clear-filters>Clear filters</button></div>`
      : `<div class="library-empty"><i data-lucide="library"></i><h2>${labels[state.libraryFilter]} 还是空的</h2><p>回到 Explore，保留第一篇真正值得读的论文。</p></div>`;
    refreshIcons();
    updateLibraryExportBar();
    return;
  }

  const selectMode = state.librarySelectMode;
  elements.libraryList.innerHTML = `<div class="library-grid${selectMode ? " is-selecting" : ""}">${entries.map((entry) => {
    const paper = entry.paper;
    const theme = paperTheme(paper);
    const authors = formatAuthors(paper.authors);
    const authorInitials = getInitials(paper.authors?.[0]?.name || "PS");
    const venue = [paper.venue, paper.year].filter(Boolean).join(" · ") || "Publication pending verification";
    const isSelected = state.librarySelected.has(paper.id);
    return `<article class="library-card ${theme}${isSelected ? " is-selected" : ""}" data-library-card data-id="${escapeAttribute(paper.id)}">
      ${selectMode ? `<span class="library-card-check" aria-hidden="true"><i data-lucide="${isSelected ? "check-square" : "square"}"></i></span>` : ""}
      <header class="library-card-hero">
        ${hookNotice(paper)}<div class="library-card-title library-card-hook">${escapeHTML(pickSubtitle(paper))}</div>
        <div class="library-card-byline">
          <span class="author-avatar">${escapeHTML(authorInitials)}</span>
          <div><strong>${escapeHTML(authors)}</strong><span>${escapeAttribute(venue)}</span></div>
        </div>
      </header>
    </article>`;
  }).join("")}</div>`;
  refreshIcons();
  updateLibraryExportBar();
}

function collectLibraryTags() {
  const tags = [];
  state.library
    .forEach((entry) => librarySubjects(entry.paper).forEach((tag) => {
      if (tag && !tags.includes(tag)) tags.push(tag);
    }));
  return tags.sort((a,b) => a.localeCompare(b,'en'));
}

function toggleLibrarySelectMode(forceValue) {
  if (libraryDeleteBusy) return;
  const next = typeof forceValue === "boolean" ? forceValue : !state.librarySelectMode;
  state.librarySelectMode = next;
  if (!next) state.librarySelected.clear();
  if (elements.libraryExportToggle) {
    elements.libraryExportToggle.classList.toggle("is-active", next);
    elements.libraryExportToggle.setAttribute("aria-pressed", next ? "true" : "false");
  }
  renderLibrary();
}

function toggleLibrarySelection(id) {
  if (libraryDeleteBusy) return;
  if (state.librarySelected.has(id)) state.librarySelected.delete(id);
  else state.librarySelected.add(id);
  renderLibrary();
}

function visibleLibraryIds() {
  return filteredLibraryEntries().map((entry) => entry.paper.id);
}

function selectAllLibraryVisible() {
  if (libraryDeleteBusy) return;
  const ids = visibleLibraryIds();
  const allSelected = ids.length > 0 && ids.every(id => state.librarySelected.has(id));
  ids.forEach(id => allSelected ? state.librarySelected.delete(id) : state.librarySelected.add(id));
  renderLibrary();
}

async function deleteLibraryPapers(ids) {
  if (libraryDeleteBusy || !ids.length) return;
  if (scheduleBusy) { showToast('Please wait for the schedule to finish saving.'); return; }
  const t = value => window.PaperSwipeI18n.t(value);
  if (!window.confirm(t('Delete selected papers?') + ` (${ids.length})\n` + t('This removes them from your Library and Schedule. You can save them again from search.'))) return;
  libraryDeleteBusy = true;
  libraryMutationRevision++;
  updateLibraryExportBar();
  try {
    const payload = await window.PaperSwipeAPI.post('/api/library/delete', {ids});
    if (!Array.isArray(payload.papers) || !payload.schedule || !payload.stats) throw new Error('Invalid deletion response');
    state.library = payload.papers;
    state.stats = payload.stats;
    scheduleRevision++;
    applyScheduleSnapshot(payload.schedule);
    const remaining = new Set(state.library.map(entry => entry.paper.id));
    state.librarySelected = new Set([...state.librarySelected].filter(id => remaining.has(id)));
    updateLibraryCounts(); updateTodosBadge();
    renderLibrary();
    if (state.activeView === 'todos') renderWeekPlan();
    showToast('Selected papers deleted.');
  } catch (_) {
    showToast('Could not delete papers. Your selection is unchanged.');
  } finally {
    libraryDeleteBusy = false;
    libraryMutationRevision++;
    updateLibraryExportBar();
  }
}

function updateLibraryExportBar() {
  if (!elements.libraryExportBar) return;
  elements.libraryExportBar.hidden = !state.librarySelectMode;
  if (elements.libraryTagsBar) {
    elements.libraryTagsBar.hidden = state.librarySelectMode;
  }
  if (elements.libraryExportCount) {
    elements.libraryExportCount.textContent = String(state.librarySelected.size);
  }
  const empty = state.librarySelected.size === 0;
  const ids = visibleLibraryIds();
  const allSelected = ids.length > 0 && ids.every(id => state.librarySelected.has(id));
  const allButton = elements.libraryExportBar.querySelector('[data-library-export-action="all"]');
  allButton.textContent = allSelected ? 'Deselect all' : 'Select all';
  allButton.setAttribute('aria-pressed',String(allSelected));
  allButton.disabled = !ids.length || libraryDeleteBusy;
  elements.libraryExportBar.querySelectorAll('[data-library-export-action="bibtex"], [data-library-export-action="zotero"], [data-library-export-action="delete"]').forEach((btn) => {
    btn.disabled = empty || libraryDeleteBusy || btn.dataset.busy === '1';
  });
  window.PaperSwipeI18n.apply(elements.libraryExportBar);
}

const {toBibTeXDocument, toZoteroItem: paperToZoteroItem} = window.PaperSwipeBibliography;

function exportSelectedBibTeX() {
  const ids = [...state.librarySelected];
  if (!ids.length) { showToast("请先选中至少一篇论文"); return; }
  const papers = state.library
    .filter((entry) => ids.includes(entry.paper.id))
    .map((entry) => entry.paper);
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([toBibTeXDocument(papers, date)], { type: "application/x-bibtex;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `paperswipe-${new Date().toISOString().slice(0, 10)}.bib`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  showToast(`已导出 ${papers.length} 篇到 .bib 文件`);
}

const ZOTERO_STORAGE_KEY = "paperswipe_zotero_v1" + (window.PAPERSWIPE_USER || "");
const ZOTERO_API_BASE = "https://api.zotero.org";

function loadZoteroCredentials() {
  try {
    const raw = window.localStorage.getItem(ZOTERO_STORAGE_KEY);
    if (!raw) return { apiKey: "", userId: "" };
    const parsed = JSON.parse(raw);
    return { apiKey: parsed.apiKey || "", userId: parsed.userId || "" };
  } catch (_) {
    return { apiKey: "", userId: "" };
  }
}

function persistZoteroCredentials() {
  const apiKey = (document.querySelector("#zotero-api-key")?.value || "").trim();
  const userId = (document.querySelector("#zotero-user-id")?.value || "").trim();
  window.localStorage.setItem(ZOTERO_STORAGE_KEY, JSON.stringify({ apiKey, userId }));
}

function clearZoteroCredentials() {
  window.localStorage.removeItem(ZOTERO_STORAGE_KEY);
  const apiKey = document.querySelector("#zotero-api-key");
  const userId = document.querySelector("#zotero-user-id");
  if (apiKey) apiKey.value = "";
  if (userId) userId.value = "";
  setZoteroStatus("已清空 Zotero 凭据。", "muted");
}

function setZoteroStatus(text, tone = "muted") {
  const el = document.querySelector("#zotero-status");
  if (!el) return;
  if (!text) { el.hidden = true; el.textContent = ""; return; }
  el.hidden = false;
  el.textContent = text;
  el.dataset.tone = tone;
}

async function testZoteroConnection() {
  persistZoteroCredentials();
  const { apiKey, userId } = loadZoteroCredentials();
  if (!apiKey || !userId) { setZoteroStatus("请先填写 API Key 和 userID。", "warn"); return; }
  setZoteroStatus("正在验证连接…", "muted");
  const button = document.querySelector('#zotero-test-button');
  if (button.disabled) return;
  button.disabled = true;
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(),15000);
  try {
    const res = await fetch(`${ZOTERO_API_BASE}/keys/current`, {
      headers: { "Zotero-API-Key": apiKey, "Zotero-API-Version": "3" },
      signal:controller.signal,
    });
    if (res.status === 403 || res.status === 401) { setZoteroStatus("Authentication failed. Check your API key and library access.", "warn"); return; }
    if (!res.ok) { setZoteroStatus(`连接失败：HTTP ${res.status}`, "warn"); return; }
    const info = await res.json();
    if (String(info.userID) !== userId) { setZoteroStatus('The user ID does not match this API key.','warn'); return; }
    if (!info.access?.user?.library) { setZoteroStatus('Authentication failed. Check your API key and library access.','warn'); return; }
    setZoteroStatus(info.access.user.write ? 'Connection verified with write access to your personal library.' : 'This key is read-only. Enable personal-library write access to export papers.', info.access.user.write ? 'ok' : 'warn');
  } catch (err) {
    setZoteroStatus(`连接失败：${err.message || err}`, "warn");
  } finally { clearTimeout(timeout); button.disabled = false; }
}



async function exportSelectedToZotero() {
  const ids = [...state.librarySelected];
  if (!ids.length) { showToast("请先选中至少一篇论文"); return; }
  const { apiKey, userId } = loadZoteroCredentials();
  if (!apiKey || !userId) {
    showToast("请先在 Settings → Zotero 里填 API Key 和 userID");
    openSettingsPage();
    document.querySelector('#zotero-settings').open = true;
    document.querySelector('#zotero-settings').scrollIntoView({block:'center'});
    return;
  }
  const papers = state.library
    .filter((entry) => ids.includes(entry.paper.id))
    .map((entry) => entry.paper);

  const btn = document.querySelector('[data-library-export-action="zotero"]');
  if (btn) { btn.disabled = true; btn.dataset.busy = "1"; }

  let ok = 0, fail = 0;
  try {
    for (let i = 0; i < papers.length; i += 50) {
      const batch = papers.slice(i, i + 50).map(paper => paperToZoteroItem(paper, deriveTags(paper)));
      const res = await fetch(`${ZOTERO_API_BASE}/users/${encodeURIComponent(userId)}/items`, {
        method: "POST",
        headers: {
          "Zotero-API-Key": apiKey,
          "Zotero-API-Version": "3",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });
      if (res.status === 403 || res.status === 401) {
        showToast("Zotero 鉴权失败，请检查 API Key 权限");
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        showToast(`Zotero 写入失败：HTTP ${res.status} ${text.slice(0, 80)}`);
        return;
      }
      const data = await res.json();
      ok += Object.keys(data.successful || {}).length;
      fail += Object.keys(data.failed || {}).length;
    }
    if (fail === 0) {
      showToast(`已导入 ${ok} 篇到你的 Zotero`);
    } else {
      showToast(`Zotero 完成：成功 ${ok} 篇，失败 ${fail} 篇`);
    }
    toggleLibrarySelectMode(false);
  } catch (err) {
    showToast(`Zotero 请求失败：${err.message || err}`);
  } finally {
    if (btn) { btn.disabled = false; delete btn.dataset.busy; }
  }
}

function renderLibraryTags() {
  const scrollLeft = elements.libraryTags.scrollLeft;
  const tags = collectLibraryTags();
  if (!tags.length) {
    elements.libraryTags.innerHTML = "";
    return;
  }
  elements.libraryTags.innerHTML = tags.map((tag) => {
    const active = state.libraryTags.includes(tag);
    return `<button type="button" class="library-tag${active ? " is-active" : ""}" data-library-tag="${escapeAttribute(tag)}" aria-pressed="${active}">${escapeHTML(tag)}</button>`;
  }).join("");
  if (state.libraryTags.length) elements.libraryTags.insertAdjacentHTML('beforeend','<button type="button" class="library-filter-clear" data-library-clear-filters>Clear filters</button>');
  window.PaperSwipeI18n.apply(elements.libraryTags);
  window.PaperSwipeContentLanguage.refresh();
  elements.libraryTags.scrollLeft = scrollLeft;
}

async function removeFromLibrary(id) {
  if (state.library.some(item => item.paper.id === id)) await deleteLibraryPapers([id]);
}

async function refreshStats() {
  try {
    const response = await fetch("/api/stats");
    state.stats = await response.json();
    updateLibraryCounts();
  } catch (_) {
    // Library counts still provide a local fallback.
  }
}

async function refreshSearches() {
  try {
    const response = await fetch("/api/searches");
    const payload = await response.json();
    const searches = payload.searches || [];
    const items = searches.length ? searches : onboardingProfile.topics.map((query) => ({ query }));
    elements.recentSearches.innerHTML = items.slice(0, 5).map((item) => `<button type="button" data-query="${escapeAttribute(item.query)}">${escapeHTML(item.query)}</button>`).join("");
  } catch (_) {
    elements.recentSearches.innerHTML = "";
  }
}

function switchView(view) {
  const validViews = ["discover", "library", "network", "todos"];
  const prev = state.activeView;
  state.activeView = validViews.includes(view) ? view : "discover";
  if (prev === state.activeView) return;
  closeAiBotPage();
  closeSettingsPage();
  const views = {
    discover: elements.discoverView,
    library: elements.libraryView,
    network: elements.networkView,
    todos: elements.todosView,
  };
  const activePanel = views[state.activeView];
  // Animate: hide all then show active
  Object.entries(views).forEach(([name, panel]) => {
    if (!panel || name === state.activeView) return;
    panel.hidden = true;
    panel.classList.remove("is-active");
  });
  if (activePanel) {
    activePanel.hidden = false;
    // Force reflow for transition
    void activePanel.offsetHeight;
    activePanel.classList.add("is-active");
  }
  // Pulse animation on nav buttons
  document.querySelectorAll(".bottom-nav [data-view]").forEach((button) => {
    const isNowActive = button.dataset.view === state.activeView;
    const wasActive = button.dataset.view === prev;
    button.classList.toggle("is-active", isNowActive);
    if (isNowActive && !wasActive) {
      button.classList.add("nav-pulse");
      setTimeout(() => button.classList.remove("nav-pulse"), 300);
    }
  });
  elements.searchPanel.hidden = true;
  if (state.activeView === "library") refreshLibrary();
  if (state.activeView === "network") renderTrendBoard();
  if (state.activeView === "todos") {
    state.weekPlanOffset = 0;
    refreshLibrary().finally(() => {
      renderWeekPlan();
      updateTodosBadge();
    });
    renderWeekPlan();
  }
}

function openAiBotPage() {
  if (!elements.aiBotPage) return;
  if (elements.aiBotMessages.childElementCount === 0) renderBotGreeting();
  elements.aiBotPage.hidden = false;
  document.body.classList.add("is-ai-bot-open");
  refreshIcons();
  setTimeout(() => elements.aiBotInput && elements.aiBotInput.focus(), 60);
}

function closeAiBotPage() {
  if (!elements.aiBotPage) return;
  elements.aiBotPage.hidden = true;
  document.body.classList.remove("is-ai-bot-open");
}

/* ── Global Trending (Network tab) ── */

const {MOCK_TRENDING_GLOBAL, TRENDING_DATA, TRENDING_TOPIC_PAPERS} = window.PaperSwipeTrendFixtures;
let trendScope = "mine";
let expandedTrendId = null;

function fmtCount(n) {
  if (n >= 1000) {
    const v = n / 1000;
    return `${v.toFixed(v >= 10 ? 0 : 1)}k`;
  }
  return String(n);
}

function renderTrendBoard() {
  const board = document.querySelector("#trend-board");
  if (!board) return;
  document.querySelectorAll(".trend-tab").forEach((btn) => {
    const active = btn.dataset.trendScope === trendScope;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  const rows = TRENDING_DATA[trendScope] || MOCK_TRENDING_GLOBAL;
  board.innerHTML = rows.map((t, i) => {
    const rank = i + 1;
    const deltaClass = t.delta > 0 ? "up" : (t.delta < 0 ? "down" : "flat");
    const deltaArrow = t.delta > 0 ? "▲" : (t.delta < 0 ? "▼" : "—");
    const deltaText = `${deltaArrow} ${Math.abs(t.delta)}%`;
    const keywordChips = (t.keywords || []).map((k) => `<span class="trend-keyword">${escapeHTML(k)}</span>`).join("");
    const expandable = Boolean(t.id && TRENDING_TOPIC_PAPERS[t.id]);
    const isExpanded = expandable && expandedTrendId === t.id;
    const papers = expandable ? TRENDING_TOPIC_PAPERS[t.id] : [];
    const paperList = expandable ? `
      <ol class="trend-papers" ${isExpanded ? "" : "hidden"}>
        ${papers.map((p, pi) => `
          <li class="trend-paper-row" data-trend-paper="${escapeAttribute(t.id)}" data-trend-paper-index="${pi}" style="--pi:${pi}">
            <span class="trend-paper-rank">${pi + 1}</span>
            <div class="trend-paper-body">
              <div class="trend-paper-title">${escapeHTML(p.title)}</div>
              <div class="trend-paper-meta">
                <span>${escapeHTML((p.authors && p.authors[0] && p.authors[0].name) || "Unknown")}${p.authors && p.authors.length > 1 ? " et al." : ""}</span>
                <span>·</span>
                <span>${escapeHTML(String(p.year || ""))}</span>
                <span>·</span>
                <span>${fmtCount(p.citation_count || 0)} cites</span>
              </div>
            </div>
            <i data-lucide="chevron-right" class="trend-paper-arrow"></i>
          </li>
        `).join("")}
      </ol>
    ` : "";
    return `
      <li class="trend-row${expandable ? " is-expandable" : ""}${isExpanded ? " is-expanded" : ""}"
          style="--i:${i};--pct:${t.pct};--tint:${t.tint}"
          ${expandable ? `data-trend-expand="${escapeAttribute(t.id)}"` : ""}>
        <div class="trend-row-main">
          <span class="trend-rank-badge">${rank}</span>
          <div class="trend-body">
            <div class="trend-row-topic">${escapeHTML(t.topic)}</div>
            <div class="trend-row-keywords">${keywordChips}</div>
            <div class="trend-bar"><span></span></div>
          </div>
          <span class="trend-delta ${deltaClass}">${deltaText}</span>
        </div>
        ${paperList}
      </li>`;
  }).join("");
  refreshIcons();
}

function toggleTrendExpand(id) {
  if (!TRENDING_TOPIC_PAPERS[id]) return;
  expandedTrendId = (expandedTrendId === id) ? null : id;
  renderTrendBoard();
}

/* ── Trend paper overlay — reuses the home-card CSS but with its own,
   non-persisting state. Swiping cycles through the topic's papers instead
   of firing /api/actions. ── */
const trendOverlayState = { topicId: null, index: 0, flipped: false, busy: false, revision: 0 };
let trendOverlayBound = false;

function openTrendPaperOverlay(topicId, startIndex) {
  const papers = TRENDING_TOPIC_PAPERS[topicId];
  if (!papers || !papers.length) return;
  trendOverlayState.revision++;
  trendOverlayState.topicId = topicId;
  trendOverlayState.index = Math.max(0, Math.min(papers.length - 1, startIndex || 0));
  trendOverlayState.flipped = false;
  const overlay = document.querySelector("#trend-overlay");
  overlay.hidden = false;
  clearTimeout(trendDismissTimer);
  overlay.classList.remove('is-dismissing');
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-trend-overlay-open");
  bindTrendOverlayOnce();
  renderTrendOverlayCard();
}

let trendDismissTimer;
function closeTrendOverlay() {
  trendOverlayState.revision++;
  const overlay = document.querySelector("#trend-overlay");
  if (overlay.hidden || overlay.classList.contains('is-dismissing')) return;
  const finish = () => {
    overlay.hidden = true;
    overlay.classList.remove('is-dismissing');
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-trend-overlay-open");
    trendOverlayState.topicId = null;
  };
  if (reducedMotion()) { finish(); return; }
  overlay.classList.add('is-dismissing');
  trendDismissTimer = setTimeout(finish, 200);
}

function currentTrendPaper() {
  const papers = TRENDING_TOPIC_PAPERS[trendOverlayState.topicId] || [];
  return papers[trendOverlayState.index] || null;
}

function renderTrendOverlayCard() {
  const paper = currentTrendPaper();
  const papers = TRENDING_TOPIC_PAPERS[trendOverlayState.topicId] || [];
  const topic = (TRENDING_DATA.mine.concat(TRENDING_DATA.global)).find((t) => t.id === trendOverlayState.topicId);
  const topicLabel = document.querySelector("#trend-overlay-topic");
  const progress = document.querySelector("#trend-overlay-progress");
  if (topicLabel) topicLabel.textContent = topic ? topic.topic : "";
  if (progress) progress.textContent = `${trendOverlayState.index + 1} / ${papers.length}`;
  if (!paper) return;

  const card = document.querySelector("#trend-overlay-card");
  card.className = "card " + paperTheme(paper);
  card.style.transform = "";
  card.style.opacity = "";
  trendOverlayState.flipped = false;

  const venueName = paper.venue || paper.source || "";
  const venueYear = paper.year || "";
  const venueFull = [venueName, venueYear].filter(Boolean).join(" · ") || "Publication pending";
  const venueBadge = paperVenueBadge(paper);
  const c = {
    title: paper.title,
    subtitle: pickSubtitle(paper),
    initials: getInitials(paper.authors?.[0]?.name || "PS"),
    author: formatAuthors(paper.authors),
    venueFull, venueBadge,
    problem: paper.digest?.problem || "Check the introduction for the research question.",
    method: paper.digest?.method || firstNoveltyBullet(paper) || "Core method details need verification from the full text.",
    result: paper.digest?.result || "Key results not available in the abstract.",
    noveltyBullets: noveltyBullets(paper),
    whyImportant: paper.digest?.why_keep || "Highly relevant to this trending topic.",
    whyRead: paper.digest?.audience || paper.digest?.reading_focus || "Relevant for researchers in this area.",
    fields: deriveTags(paper),
    bestFor: deriveBestFor(paper),
    url: paper.url || "",
    pdf_url: paper.pdf_url || "",
    read_minutes: mockReadMinutes(paper.read_minutes, paper.id),
    citation_count: mockCitationCount(paper.citation_count),
  };

  card.innerHTML = `
    <div class="stamp dismiss">NOPE</div>
    <div class="stamp save">YES</div>
    <div class="stamp priority">TOP</div>
    <div class="stamp read">DONE</div>
    <div class="card-inner" id="trendOverlayInner">
      <div class="card-face card-front">
        <div class="card-hero">
          <div class="card-top-wrap">
            <div class="card-topline">
              <span class="card-badge">${escapeHTML(c.venueBadge)}</span>
            </div>
            <div class="card-fields">${c.fields.map(escapeHTML).join(" · ")}</div>
          </div>
          <div class="flip-hint-front"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"/></svg>Tap to flip</div>
          <div class="card-body">
            <p class="card-subtitle">${escapeHTML(c.subtitle)}</p>
            <h2 class="card-title">${escapeHTML(c.title)}</h2>
          </div>
          <div class="card-byline">
            <span class="avatar">${escapeHTML(c.initials)}</span>
            <div class="byline-text"><strong>${escapeHTML(c.author)}</strong>${escapeHTML(c.venueFull)}</div>
          </div>
        </div>
      </div>
      <div class="card-face card-back">
        <div class="card-back-face">
          <div class="back-hero">
            <div class="back-topline"><span class="card-badge">${escapeHTML(c.venueBadge)}</span></div>
            <h2 class="back-title">${escapeHTML(c.title)}</h2>
            <div class="back-byline">${escapeHTML(c.author)}</div>
          </div>
          <div class="back-details">
            <div class="detail-section">
              <div class="detail-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Highlights</div>
              <div class="highlight-list">
                <div class="hl-item"><span class="hl-badge problem">Problem</span><p>${boldMarkup(escapeHTML(truncateText(c.problem)))}</p></div>
                <div class="hl-item"><span class="hl-badge method">Method</span><p>${boldMarkup(escapeHTML(truncateText(c.method)))}</p></div>
                <div class="hl-item"><span class="hl-badge result">Results</span><p>${boldMarkup(escapeHTML(truncateText(c.result)))}</p></div>
              </div>
            </div>
            <div class="back-divider"></div>
            <div class="detail-section">
              <div class="detail-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>What's New</div>
              <ul class="detail-bullets">${(c.noveltyBullets || []).map((b) => `<li>${boldMarkup(escapeHTML(b))}</li>`).join("")}</ul>
            </div>
            <div class="back-divider"></div>
            <div class="detail-section">
              <div class="detail-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>Why It Matters</div>
              <div class="why-grid">
                <div class="why-col"><span class="why-tag">For the field</span><p>${escapeHTML(c.whyImportant)}</p></div>
                <div class="why-col"><span class="why-tag">For you</span><p>${escapeHTML(c.whyRead)}</p></div>
              </div>
            </div>
            <div class="source-links">
              <div class="source-stats-row">
                <span class="source-stat"><span class="source-stat-emoji">📖</span>${c.read_minutes} min</span>
                <span class="source-stat"><span class="source-stat-emoji">🌟</span>${escapeHTML(citationLabel(paper))}</span>
              </div>
              <div class="source-links-row">
                ${c.url ? `<a class="source-link" href="${escapeAttribute(c.url)}" target="_blank" rel="noopener" data-stop-click><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Original</a>` : ""}
                ${c.pdf_url ? `<a class="source-link" href="${escapeAttribute(c.pdf_url)}" target="_blank" rel="noopener" data-stop-click><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>PDF</a>` : ""}
              </div>
            </div>
            <div class="flip-hint-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"/></svg>Tap to flip back</div>
          </div>
        </div>
      </div>
    </div>`;
  refreshIcons();

  /* Entrance animation */
  card.style.transition = "none";
  card.style.transform = "translateY(38px) scale(.93)";
  card.style.opacity = "0";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    card.style.transition = "transform 440ms cubic-bezier(.25,.8,.25,1.2), opacity 360ms ease";
    card.style.transform = "";
    card.style.opacity = "";
  }));
}

async function trendOverlayFly(action, velocity) {
  const card = document.querySelector("#trend-overlay-card");
  const papers = TRENDING_TOPIC_PAPERS[trendOverlayState.topicId] || [];
  const paper = papers[trendOverlayState.index];
  if (!paper || trendOverlayState.busy) return;
  trendOverlayState.busy = true;
  const revision = trendOverlayState.revision;
  try {
    if (action !== 'dismiss') {
      await PaperSwipeAPI.saveAction(paper, action);
      void refreshLibrary();
      void refreshStats();
    }
  } catch (error) {
    if (revision === trendOverlayState.revision) {
      card.style.transform = '';
      card.style.opacity = '';
      updateOverlayStamps(0, 0, 0);
      showToast(`未保存：${error.message}`);
    }
    trendOverlayState.busy = false;
    return;
  }
  if (revision !== trendOverlayState.revision) { trendOverlayState.busy = false; return; }
  card.style.transition = "transform 340ms cubic-bezier(.4,0,1,1), opacity 300ms ease";
  const boost = Math.min(1.6, 1 + (velocity || 0) * 0.7);
  let tx = 0, ty = 0, rx = 0, ry = 0;
  if (action === "dismiss")  { tx = -130 * boost; ty = 20;  rx = -3;  ry = -18; }
  if (action === "save")     { tx = 130 * boost;  ty = 20;  rx = -3;  ry = 18; }
  if (action === "priority") { tx = 10;           ty = -140 * boost; rx = -18; ry = 2; }
  if (action === "read")     { tx = -5;           ty = 140 * boost;  rx = 18;  ry = -2; }
  card.style.transform = `translate(${tx}vw, ${ty}px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  card.style.opacity = ".15";
  updateOverlayStamps(0, 0, 0);

  const labels = { dismiss: "Skipped", save: "Saved!", priority: "Marked Key!", read: "Marked Read" };
  showToast(labels[action] || action);

  setTimeout(() => {
    trendOverlayState.busy = false;
    if (revision !== trendOverlayState.revision) return;
    if (trendOverlayState.index < papers.length - 1) {
      trendOverlayState.index += 1;
      renderTrendOverlayCard();
    } else {
      closeTrendOverlay();
    }
  }, 320);
}

function updateOverlayStamps(dx, dy, strength) {
  const card = document.querySelector("#trend-overlay-card");
  if (!card) return;
  const nls = Math.pow(strength, .65);
  const s = {
    dismiss: card.querySelector(".stamp.dismiss"),
    save: card.querySelector(".stamp.save"),
    priority: card.querySelector(".stamp.priority"),
    read: card.querySelector(".stamp.read"),
  };
  if (!s.dismiss) return;
  s.dismiss.style.opacity  = dx < -10 && Math.abs(dx) > Math.abs(dy) * .5 ? nls : 0;
  s.save.style.opacity     = dx >  10 && Math.abs(dx) > Math.abs(dy) * .5 ? nls : 0;
  s.priority.style.opacity = dy < -10 && Math.abs(dy) > Math.abs(dx) * .6 ? nls : 0;
  s.read.style.opacity     = dy >  10 && Math.abs(dy) > Math.abs(dx) * .6 ? nls : 0;
}

function bindTrendOverlayOnce() {
  if (trendOverlayBound) return;
  trendOverlayBound = true;
  const overlay = document.querySelector("#trend-overlay");
  const card = document.querySelector("#trend-overlay-card");
  overlay.querySelector(".trend-overlay-close").addEventListener("click", closeTrendOverlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeTrendOverlay(); });
  document.addEventListener("keydown", (e) => {
    if (document.body.classList.contains("is-trend-overlay-open")) {
      if (e.key === "Escape") closeTrendOverlay();
      if (e.key === "ArrowLeft") trendOverlayFly("dismiss");
      if (e.key === "ArrowRight") trendOverlayFly("save");
      if (e.key === "ArrowUp") trendOverlayFly("priority");
      if (e.key === "ArrowDown") trendOverlayFly("read");
      if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); toggleTrendOverlayFlip(); }
    }
  });

  const reset = () => {
    card.style.transform = '';
    updateOverlayStamps(0, 0, 0);
  };
  bindSwipeSurface(card, {
    canStart: event => !trendOverlayState.busy && !(trendOverlayState.flipped && event.target.closest('.back-details')),
    move(dx, dy) {
      card.style.transform = `translate(${dx}px, ${dy}px) rotateX(${-dy / 300 * 16}deg) rotateY(${dx / 200 * 12}deg)`;
      updateOverlayStamps(dx, dy, Math.min(1, Math.max(Math.abs(dx), Math.abs(dy)) / 110));
    },
    cancel: reset,
    tap() { reset(); toggleTrendOverlayFlip(); },
    swipe: trendOverlayFly,
  });
}

function toggleTrendOverlayFlip() {
  const inner = document.querySelector("#trend-overlay-card .card-inner");
  if (!inner) return;
  trendOverlayState.flipped = !trendOverlayState.flipped;
  inner.classList.toggle("is-flipped", trendOverlayState.flipped);
}

function setTrendScope(scope) {
  if (scope !== "mine" && scope !== "global") return;
  if (trendScope === scope) return;
  trendScope = scope;
  renderTrendBoard();
}

function renderSettings() {
  const identities = { graduate: "Graduate / PhD", researcher: "Professor / Researcher", enthusiast: "Explorer" };
  const styleLabel = onboardingProfile.discoveryStyle === "broaden" ? "Broaden discovery" : "Focused discovery";
  elements.settingsTopicChips.innerHTML = settingsTopicDraft.map((topic) => `<button type="button" data-settings-topic-remove="${escapeAttribute(topic)}" aria-label="${escapeAttribute((window.PaperSwipeI18n?.t('Remove topic') || 'Remove topic') + ': ' + topic)}"><span>${escapeHTML(topic)}</span><i data-lucide="x"></i></button>`).join("");
  document.querySelectorAll("[data-appearance]").forEach((button) => {
    const selected = button.dataset.appearance === state.appearance;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  document.querySelectorAll("[data-settings-style]").forEach((button) => {
    const selected = button.dataset.settingsStyle === onboardingProfile.discoveryStyle;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  elements.settingsComplexity.value = String(onboardingProfile.complexity);
  renderReaderPicker();
  updateComplexityLabel(elements.settingsComplexityLabel, onboardingProfile.complexity);
  refreshIcons();
}


const WEEK_PLAN_DAY_TARGET_MIN = 120;
const WEEK_PLAN_ORDER = ["priority", "save"];

function buildWeekPlanTask(entry) {
  const p = entry.paper || {};
  return {
    id: p.id,
    title: p.title || "Untitled paper",
    minutes: mockReadMinutes(p.read_minutes, p.id),
    action: entry.action,
    theme: paperTheme(p),
    subtitle: pickSubtitle(p),
    priority: state.weekPlanPriority.get(p.id) || ["high", "medium", "low"][Math.abs(hashString(p.id || "")) % 3],
    done: state.weekPlanDone.has(p.id),
    removed: state.weekPlanRemoved.has(p.id),
    order: WEEK_PLAN_ORDER.indexOf(entry.action) * 1000 + hashString(p.id || ""),
  };
}

function weekStartDate(offset) {
  // Monday-start week. offset: 0 = this week, -1 = last week, +1 = next week.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay(); // 0 = Sun, 1 = Mon, ...
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday + (offset || 0) * 7);
  return monday;
}

function buildWeekPlan(offset) {
  const start = weekStartDate(offset || 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { date: d, items: [], totalMin: 0, isToday: d.getTime() === today.getTime(), isPast: d.getTime() < today.getTime() };
  });

  const tasks = [];
  for (const entry of state.library || []) {
    if (!entry || !entry.paper) continue;
    if (!WEEK_PLAN_ORDER.includes(entry.action)) continue;
    const task = buildWeekPlanTask(entry);
    if (!task.id || task.removed) continue;
    tasks.push(task);
  }
  tasks.sort((a, b) => a.order - b.order);

  // Manual assignments take priority: pin each task to its chosen date.
  const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const placedIds = new Set();
  for (const day of days) {
    const key = dateKey(day.date);
    for (const task of tasks) {
      if (placedIds.has(task.id)) continue;
      if (state.weekPlanAssign.get(task.id) === key) {
        day.items.push(task);
        day.totalMin += task.minutes;
        placedIds.add(task.id);
      }
    }
  }

  // Placement uses a stable per-week hash seed so tasks land differently
  // when you page to another week (rather than showing "empty" everywhere).
  const seed = hashString(`${start.toISOString().slice(0, 10)}`);
  let cursor = 0;
  // Rotate task order per week so different weeks show different subsets.
  const rotated = tasks.filter((t) => !placedIds.has(t.id) && !state.weekPlanAssign.has(t.id));
  rotated.sort((a, b) => a.order - b.order);
  const rotatedFull = rotated.length ? rotated.slice(seed % rotated.length).concat(rotated.slice(0, seed % rotated.length)) : rotated;
  for (let i = 0; i < days.length && cursor < rotatedFull.length; i++) {
    const h = hashString(`${rotatedFull[cursor]?.id || ""}-${i}-${seed}`);
    const limit = (h % 100 < 38) ? 2 : 1;
    for (let slot = 0; slot < limit && cursor < rotatedFull.length; slot++) {
      days[i].items.push(rotatedFull[cursor]);
      days[i].totalMin += rotatedFull[cursor].minutes;
      cursor += 1;
    }
  }

  for (const day of days) {
    day.items.sort((a, b) => Number(a.done) - Number(b.done) || a.order - b.order);
  }
  return { start, days };
}

function formatDayLabel(date, isToday) {
  if (isToday) return "Today";
  const wd = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getDay()];
  return `${wd} ${date.getMonth() + 1}/${date.getDate()}`;
}

function updateTodosBadge() {
  if (!elements.todosToggleBadge) return;
  const count = (state.library || []).filter((e) => e && e.paper && WEEK_PLAN_ORDER.includes(e.action) && !state.weekPlanRemoved.has(e.paper.id)).length;
  if (count > 0) {
    elements.todosToggleBadge.textContent = count > 99 ? "99+" : String(count);
    elements.todosToggleBadge.hidden = false;
  } else {
    elements.todosToggleBadge.hidden = true;
  }
}

function formatWeekRangeLabel(startDate) {
  const end = new Date(startDate);
  end.setDate(startDate.getDate() + 6);
  if (startDate.getFullYear() !== end.getFullYear()) {
    return `${startDate.getFullYear()}/${startDate.getMonth()+1}/${startDate.getDate()} – ${end.getFullYear()}/${end.getMonth()+1}/${end.getDate()}`;
  }
  const sameMonth = startDate.getMonth() === end.getMonth();
  const startStr = `${startDate.getMonth() + 1}/${startDate.getDate()}`;
  const endStr = sameMonth ? `${end.getDate()}` : `${end.getMonth() + 1}/${end.getDate()}`;
  const year = startDate.getFullYear() !== new Date().getFullYear() ? `${startDate.getFullYear()}/` : '';
  return `${year}${startStr} – ${endStr}`;
}

function renderWeekPlan() {
  const grid = elements.weekPlanGrid;
  const summary = elements.weekPlanSummary;
  if (!grid) return;
  const { start, days } = buildWeekPlan(state.weekPlanOffset);
  const totalTasks = days.reduce((n, d) => n + d.items.length, 0);
  const totalMin = days.reduce((n, d) => n + d.totalMin, 0);

  const offset = state.weekPlanOffset || 0;
  const weekWord = offset === 0 ? "This week" : offset === -1 ? "Last week" : offset === 1 ? "Next week" : (offset < 0 ? `${-offset} weeks ago` : `In ${offset} weeks`);
  if (summary) {
    const rangeLabel = formatWeekRangeLabel(start);
    const stats = totalTasks
      ? `${totalTasks} paper${totalTasks > 1 ? "s" : ""} · ${totalMin} min`
      : "Nothing scheduled";
    summary.innerHTML = `
      <div class="wp-nav">
        <button type="button" class="wp-nav-btn" data-week-nav="-1" aria-label="上一周"><i data-lucide="chevron-left"></i></button>
        <button type="button" class="wp-nav-center wp-week-picker" data-open-week-calendar aria-haspopup="dialog" aria-controls="week-calendar-dialog" aria-label="Choose a week">
          <strong>${escapeHTML(weekWord)}</strong>
          <small>${escapeHTML(rangeLabel)} · ${escapeHTML(stats)}</small>
          <span class="wp-week-picker-hint"><i data-lucide="calendar-days"></i><span>Choose a week</span></span>
        </button>
        <button type="button" class="wp-nav-btn" data-week-nav="1" aria-label="下一周"><i data-lucide="chevron-right"></i></button>
      </div>`;
  }

  const renderItem = (t) => `
    <li class="wp-item-shell${t.done ? " is-done" : ""}" data-week-plan-shell data-done="${t.done ? "1" : "0"}">
      <div class="wp-item-actions" aria-hidden="true">
        <button type="button" class="wp-action wp-action--done" data-week-plan-action="done" data-id="${escapeAttribute(t.id)}" aria-label="Mark done" title="Mark done"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg></button>
        <button type="button" class="wp-action wp-action--remove" data-week-plan-action="remove" data-id="${escapeAttribute(t.id)}" aria-label="Delete" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
      </div>
      <button type="button" class="wp-item wp-item--${t.action} wp-priority-${t.priority || "medium"}${t.done ? " is-done" : ""}" data-week-plan-card data-id="${escapeAttribute(t.id)}">
        <span class="wp-item-title">${escapeHTML(t.title)}</span>
        <span class="wp-item-row">
          <span class="wp-item-meta">${t.minutes} min</span>
        </span>
      </button>
    </li>`;

  const renderDayCard = (day, idx, layout) => {
    const active = day.items.filter((t) => !t.done);
    const done = day.items.filter((t) => t.done);
    const activeHTML = active.length ? `<ul class="wp-day-list">${active.map(renderItem).join("")}</ul>` : (day.items.length ? "" : `<div class="wp-empty">Free</div>`);
    const doneHTML = done.length ? `<ul class="wp-day-list wp-day-list--done">${done.map(renderItem).join("")}</ul>` : "";
    const wd = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][day.date.getDay()];
    const dateNum = day.date.getDate();
    return `
      <article class="wp-day wp-day--${layout}${day.isToday ? " is-today" : ""}${day.isPast ? " is-past" : ""}" role="listitem" style="--wp-day-index:${idx}">
        <header class="wp-day-head">
          <div class="wp-day-date">
            <span class="wp-day-num">${dateNum}</span>
            <span class="wp-day-wd">${wd}${day.isToday ? " · Today" : ""}</span>
          </div>
          <span class="wp-day-sum">${day.totalMin ? `${day.totalMin} min` : ""}</span>
        </header>
        ${activeHTML}${doneHTML}
      </article>`;
  };

  // Layout: Today (if this week) gets its own full-width row; other days flow in a 2-col grid.
  const todayIdx = days.findIndex((d) => d.isToday);
  const parts = [];
  if (todayIdx >= 0) {
    parts.push(`<div class="wp-row wp-row--hero">${renderDayCard(days[todayIdx], todayIdx, "hero")}</div>`);
    const rest = days.filter((_, i) => i !== todayIdx);
    parts.push(`<div class="wp-row wp-row--pairs">${rest.map((d, i) => renderDayCard(d, i + 1, "compact")).join("")}</div>`);
  } else {
    parts.push(`<div class="wp-row wp-row--pairs">${days.map((d, i) => renderDayCard(d, i, "compact")).join("")}</div>`);
  }
  grid.innerHTML = parts.join("");
  refreshIcons();
}

async function handleWeekPlanAction(id, action) {
  if (!id) return;
  if (action === "remove") {
    if (await saveSchedulePatch(id, {removed:true, done:false})) showToast('已移出日程，文献库收藏保留');
    return;
  }
  if (action === "done") {
    const done = !state.weekPlanDone.has(id);
    if (await saveSchedulePatch(id, {done})) showToast(done ? "已标记完成" : "已取消完成");
  }
}

function openWeekPlanCard(id) {
  openLibraryCard(id);
}

function bindWeekPlanSwipe() {
  if (!elements.weekPlanGrid) return;
  elements.weekPlanGrid.addEventListener("pointerdown", (event) => {
    const shell = event.target.closest("[data-week-plan-shell]");
    if (!shell || event.target.closest("[data-week-plan-action]")) return;
    if (shell.classList.contains("is-done")) return; // completed cards don't reveal actions
    // Close any other revealed shell before starting a new swipe.
    elements.weekPlanGrid.querySelectorAll(".wp-item-shell.is-revealed").forEach((other) => {
      if (other !== shell) {
        other.classList.remove("is-revealed");
        other.style.setProperty("--wp-swipe", "0px");
      }
    });
    weekPlanSwipe = { shell, startX: event.clientX, startY: event.clientY, dx: 0, active: false };
  });
  elements.weekPlanGrid.addEventListener("pointermove", (event) => {
    if (!weekPlanSwipe) return;
    const dx = event.clientX - weekPlanSwipe.startX;
    const dy = event.clientY - weekPlanSwipe.startY;
    if (!weekPlanSwipe.active && Math.abs(dx) < 8) return;
    if (Math.abs(dy) > Math.abs(dx)) return;
    weekPlanSwipe.active = true;
    weekPlanSwipe.dx = Math.min(0, dx);
    const reveal = Math.max(-132, weekPlanSwipe.dx);
    weekPlanSwipe.shell.style.setProperty("--wp-swipe", `${reveal}px`);
    weekPlanSwipe.shell.classList.toggle("is-revealed", reveal < -56);
  });
  const finish = () => {
    if (!weekPlanSwipe) return;
    const shell = weekPlanSwipe.shell;
    const reveal = Math.max(-132, Math.min(0, weekPlanSwipe.dx || 0));
    const open = reveal < -56;
    shell.style.setProperty("--wp-swipe", open ? "-132px" : "0px");
    shell.classList.toggle("is-revealed", open);
    weekPlanSwipe = null;
  };
  elements.weekPlanGrid.addEventListener("pointerup", finish);
  elements.weekPlanGrid.addEventListener("pointercancel", finish);
  elements.weekPlanGrid.addEventListener("pointerleave", finish);
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const dialogDismissTimers = new WeakMap();
function presentDialog(dialog) {
  clearTimeout(dialogDismissTimers.get(dialog));
  dialogDismissTimers.delete(dialog);
  dialog.classList.remove('is-dismissing');
  if (!dialog.open) dialog.showModal();
}
function dismissDialog(dialog) {
  if (!dialog?.open || dialogDismissTimers.has(dialog)) return;
  if (reducedMotion()) { dialog.close(); return; }
  dialog.classList.add('is-dismissing');
  const timer = setTimeout(() => {
    dialogDismissTimers.delete(dialog);
    dialog.close();
    dialog.classList.remove('is-dismissing');
  }, 200);
  dialogDismissTimers.set(dialog, timer);
}
let settingsMotion;
function animateLibraryChange() {
  if (reducedMotion()) return;
  elements.libraryList.getAnimations().forEach(a => a.cancel());
  elements.libraryList.animate([{opacity:.35,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'cubic-bezier(.22,1,.36,1)'});
}
function openSettingsPage() {
  if (!elements.settingsPage) return;
  if (elements.settingsPage.hidden) {
    settingsTopicDraft = [...onboardingProfile.topics];
    elements.settingsTopicInput.value = onboardingProfile.researchIntent || onboardingProfile.searchQuery || settingsTopicDraft.join(' ');
    document.querySelector('#topic-update-error').hidden = true;
    topicEditRevision++;
  }
  renderSettings();
  elements.settingsPage.hidden = false;
  settingsMotion?.cancel();
  if (!reducedMotion()) settingsMotion = elements.settingsPage.animate([{opacity:0,transform:'translateX(-24px) scale(.98)'},{opacity:1,transform:'translateX(0) scale(1)'}],{duration:320,easing:'cubic-bezier(.22,1,.36,1)'});
  refreshIcons();
}

function closeSettingsPage() {
  setReaderPickerOpen(false);
  const page = elements.settingsPage;
  if (!page || page.hidden) return;
  settingsMotion?.cancel();
  if (reducedMotion()) { page.hidden = true; return; }
  settingsMotion = page.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(-20px)'}],{duration:200,easing:'ease-in'});
  settingsMotion.onfinish = () => { page.hidden = true; elements.settingsToggle?.focus({preventScroll:true}); };
}

function removeSettingsTopic(topic) {
  settingsTopicDraft = settingsTopicDraft.filter((item) => item !== topic);
  elements.settingsTopicInput.value = settingsTopicDraft.join(' ');
  topicEditRevision++;
  renderSettings();
}

async function saveSettingsTopics() {
  const button = document.querySelector('#save-topics-button');
  if (button.disabled) return;
  if (state.actionBusy) { showToast('请等待当前收藏操作完成'); return; }
  const customTopic = elements.settingsTopicInput.value.trim();
  if (state.streaming && (!customTopic || customTopic === onboardingProfile.researchIntent)) {
    showToast('这个主题仍在搜索，无需重复点击 Update');
    return;
  }
  const description = customTopic;
  if (Array.from(description).length < 2) { showToast('请输入至少 2 个字符的研究主题'); return; }
  const label = button.querySelector('span');
  const previousLabel = label.textContent;
  const revision = searchRevision;
  const editRevision = topicEditRevision;
  const errorLabel = document.querySelector('#topic-update-error');
  errorLabel.hidden = true;
  button.disabled = true;
  label.textContent = '正在更新主题…';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40000);
  try {
    let query = description;
    let keywords = [description];
    let usedAI = false;
    // Use the same intent planner as onboarding for free-form descriptions.
    if (customTopic === onboardingProfile.researchIntent && onboardingProfile.searchQuery) {
      query = onboardingProfile.searchQuery; keywords = [...onboardingProfile.topics]; usedAI = onboardingProfile.topicPlanAI;
    } else if (customTopic && Array.from(description).length >= 6) {
      const response = await fetch('/api/topic-plan', {
        method:'POST', headers:{'Content-Type':'application/json', Prefer:'wait=20'},
        body:JSON.stringify({description}), signal:controller.signal
      });
      const plan = await response.json();
      if (!response.ok) throw new Error(plan.error || '主题分析失败，请重试');
      query = String(plan.search_query || '').trim();
      if (!query) throw new Error('未生成有效检索词，请重试');
      keywords = Array.isArray(plan.keywords) ? plan.keywords.filter(x => typeof x === 'string' && x.trim()).slice(0, 8) : [];
      if (!keywords.length) keywords = [query];
      usedAI = Boolean(plan.ai_enabled);
    }
    if (revision !== searchRevision) { showToast('已切换到其他搜索，本次主题更新未应用'); return; }
    if (editRevision !== topicEditRevision) { showToast('主题草稿已改变，请确认后重新搜索'); return; }
    if (state.actionBusy) { showToast('请等待收藏完成后再更新主题'); return; }
    if (customTopic) {
      onboardingProfile.topics = keywords;
      onboardingProfile.researchIntent = description;
      onboardingProfile.searchQuery = query;
      onboardingProfile.topicPlanAI = usedAI;
    }
    persistProfile();
    settingsTopicDraft = [...keywords];
    renderSettings();
    // switchView returns early when Explore is already selected.
    closeSettingsPage();
    switchView('discover');
    void performSearch(query);
    showToast(usedAI ? '主题已更新，按 AI 检索词搜索' : '主题已更新，按关键词搜索');
  } catch (error) {
    const message = error.name === 'AbortError' ? '主题分析超时，请重试；原主题已保留' : error.message;
    errorLabel.textContent = message; errorLabel.hidden = false;
    showToast(message);
  } finally {
    clearTimeout(timeout);
    button.disabled = false;
    label.textContent = previousLabel;
  }
}

function selectAppearance(appearance) {
  state.appearance = appearance;
  window.localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
  applyAppearance(appearance);
  renderSettings();
  showToast(`已切换为 ${appearance === "light" ? "Light" : appearance === "dark" ? "Dark" : "System"} 主题`);
}

function applyAppearance(appearance) {
  const dark = appearance === 'dark' || (appearance === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = dark ? "#000000" : "#f4f5f7";
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.appearance === 'system') applyAppearance('system'); });

function updateComplexityLabel(node, complexity) {
  const labels = ["Easy", "Accessible", "Balanced", "Advanced", "Expert"];
  const value = Math.max(1, Math.min(5, Number(complexity)));
  const changed = node.dataset.level && node.dataset.level !== String(value);
  node.dataset.level = String(value);
  node.textContent = labels[value - 1];
  const input = node.id === 'settings-complexity-label' ? elements.settingsComplexity : elements.complexitySlider;
  input?.style.setProperty('--range-progress', `${(value - 1) * 25}%`);
  if (changed && !reducedMotion()) {
    node.getAnimations().forEach(animation => animation.cancel());
    node.animate([{transform:'translateY(4px) scale(.94)',opacity:.45},{transform:'translateY(0) scale(1)',opacity:1}], {duration:220,easing:'cubic-bezier(.22,1,.36,1)'});
  }
}

function openDetails(id) {
  const papers = [...state.papers, ...state.library.map((entry) => entry.paper)];
  const paper = papers.find((item) => item.id === id);
  if (!paper) return;
  const noveltyText = noveltyBullets(paper).join(" • ");
  const details = [
    ["解决什么", paper.digest?.problem], ["新在哪里", noveltyText],
    ["方法", paper.digest?.method], ["结果", paper.digest?.result],
    ["适合谁读", paper.digest?.audience], ["阅读重点", paper.digest?.reading_focus],
  ];
  const links = [
    safeURL(paper.url) ? `<a class="paper-link" href="${escapeAttribute(paper.url)}" target="_blank" rel="noopener"><i data-lucide="external-link"></i><span>论文页面</span></a>` : "",
    safeURL(paper.pdf_url) ? `<a class="paper-link" href="${escapeAttribute(paper.pdf_url)}" target="_blank" rel="noopener"><i data-lucide="file-down"></i><span>开放 PDF</span></a>` : "",
  ].join("");
  elements.dialogContent.innerHTML = `
    <h2>${escapeHTML(paper.title)}</h2>
    <p class="paper-byline">${escapeHTML(formatAuthors(paper.authors))}<br>${escapeHTML([paper.venue, paper.publication_date || paper.year].filter(Boolean).join(" · "))}</p>
    <div class="detail-list">${details.map(([label, value]) => `<div><small>${label}</small><p>${escapeHTML(value || "摘要未提供足够信息")}</p></div>`).join("")}</div>
    <h3>原始摘要</h3>
    <p>${escapeHTML(paper.abstract || "暂未取得摘要，请打开论文页面核验。")}</p>
    <div class="detail-links">${links}</div>`;
  refreshIcons();
  presentDialog(elements.dialog);
}

function openLibraryCard(id) {
  const entry = state.library.find((item) => item.paper.id === id);
  if (!entry) return;
  const paper = entry.paper;
  const theme = paperTheme(paper);
  const authors = formatAuthors(paper.authors);
  const authorInitials = getInitials(paper.authors?.[0]?.name || "PS");
  const venueName = paper.venue || paper.source || "";
  const venueYear = paper.year || "";
  const venueFull = [venueName, venueYear].filter(Boolean).join(" · ") || "Publication pending";
  const venueBadge = paperVenueBadge(paper);
  const tags = deriveTags(paper);
  const bestFor = deriveBestFor(paper);
  const c = {
    subtitle: pickSubtitle(paper),
    problem: paper.digest?.problem || "Check the introduction for the research question.",
    method: paper.digest?.method || firstNoveltyBullet(paper) || "Core method details need verification from the full text.",
    result: paper.digest?.result || "Key results not available in the abstract — check the experiments section.",
    noveltyBullets: noveltyBullets(paper),
    whyImportant: paper.digest?.why_keep || "Matches the search direction — skim before committing to a deep read.",
    whyRead: paper.digest?.audience || paper.digest?.reading_focus || "Relevant for researchers in this area.",
  };

  elements.libraryCardDialogContent.innerHTML = `
    <article class="card ${theme} library-pop-card" data-library-pop-card>
      <div class="card-inner">
        <div class="card-face card-front">
          <div class="card-hero">
            <div class="card-top-wrap">
              <div class="card-topline">
                <span class="card-badge">${escapeHTML(venueBadge)}</span>
              </div>
              <div class="card-fields">${tags.map(escapeHTML).join(" · ")}</div>
            </div>
            <div class="flip-hint-front">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"/></svg>
              Tap to flip
            </div>
            <div class="card-body">
              ${hookNotice(paper)}<p class="card-subtitle">${escapeHTML(c.subtitle)}</p>
              <h2 class="card-title">${escapeHTML(paper.title)}</h2>
            </div>
            <div class="card-byline">
              <span class="avatar">${escapeHTML(authorInitials)}</span>
              <div class="byline-text"><strong>${escapeHTML(authors)}</strong>${escapeHTML(venueFull)}</div>
            </div>
          </div>
        </div>
        <div class="card-face card-back">
          <div class="card-back-face">
            <div class="back-hero">
              <h2 class="back-title">${escapeHTML(paper.title)}</h2>
              <div class="back-byline">${escapeHTML(authors)}</div>
            </div>
            <div class="back-details">
              <div class="detail-section">
                <div class="detail-label">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  Highlights
                </div>
                <div class="highlight-list">
                  <div class="hl-item"><span class="hl-badge problem">Problem</span><p>${boldMarkup(escapeHTML(truncateText(c.problem)))}</p></div>
                  <div class="hl-item"><span class="hl-badge method">Method</span><p>${boldMarkup(escapeHTML(truncateText(c.method)))}</p></div>
                  <div class="hl-item"><span class="hl-badge result">Results</span><p>${boldMarkup(escapeHTML(truncateText(c.result)))}</p></div>
                </div>
              </div>
              <div class="back-divider"></div>
              <div class="detail-section">
                <div class="detail-label">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  What's New
                </div>
                <ul class="detail-bullets">${(c.noveltyBullets || []).map((b) => `<li>${boldMarkup(escapeHTML(b))}</li>`).join("")}</ul>
              </div>
              <div class="back-divider"></div>
              <div class="detail-section">
                <div class="detail-label">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  Why It Matters
                </div>
                <div class="why-grid">
                  <div class="why-col"><span class="why-tag">For the field</span><p>${escapeHTML(c.whyImportant)}</p></div>
                  <div class="why-col"><span class="why-tag">For you</span><p>${escapeHTML(c.whyRead)}</p></div>
                </div>
              </div>
              <div class="back-divider"></div>
              <div class="detail-section">
                <div class="detail-label">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                  Best for
                </div>
                <div class="best-for-row">${bestFor.map((t) => `<span class="best-chip">${escapeHTML(t)}</span>`).join("")}</div>
              </div>
              <div class="source-links">
                <div class="source-stats-row">
                  <span class="source-stat"><span class="source-stat-emoji">📖</span>${mockReadMinutes(paper.read_minutes, paper.id)} min</span>
                  <span class="source-stat"><span class="source-stat-emoji">🌟</span>${escapeHTML(citationLabel(paper))}</span>
                </div>
                <div class="source-links-row">
                  ${safeURL(paper.url) ? `<a class="source-link" href="${escapeAttribute(paper.url)}" target="_blank" rel="noopener" data-stop-click>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    Original
                  </a>` : ""}
                  ${safeURL(paper.pdf_url) ? `<a class="source-link" href="${escapeAttribute(paper.pdf_url)}" target="_blank" rel="noopener" data-stop-click>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                    PDF
                  </a>` : ""}
                </div>
              </div>
              <div class="flip-hint-back">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"/></svg>
                Tap to flip back
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>`;
  refreshIcons();
  presentDialog(elements.libraryCardDialog);
  const popCard = elements.libraryCardDialogContent.querySelector(".library-pop-card");
  const popInner = popCard && popCard.querySelector(".card-inner");
  if (popCard && popInner) {
    let downX = 0, downY = 0;
    popCard.addEventListener("pointerdown", (event) => { downX = event.clientX; downY = event.clientY; });
    popCard.addEventListener("click", (event) => {
      if (event.target.closest("[data-stop-click], [data-close-dialog]")) return;
      const dx = Math.abs(event.clientX - downX);
      const dy = Math.abs(event.clientY - downY);
      if (dx > 6 || dy > 6) return;
      popInner.classList.toggle("is-flipped");
    });
  }
}

/* ── Library long-press inline actions ── */
let libraryPress = null;
let libraryPressCard = null;

function bindLibraryLongPress() {
  const list = elements.libraryList;
  if (!list) return;
  const HOLD_MS = 450;
  list.addEventListener("pointerdown", (event) => {
    if (state.librarySelectMode) return;
    const card = event.target.closest("[data-library-card]");
    if (!card || event.target.closest("button")) return;
    const id = card.dataset.id;
    const startX = event.clientX, startY = event.clientY;
    let fired = false;
    const timer = setTimeout(() => {
      fired = true;
      if (navigator.vibrate) navigator.vibrate(12);
      openLibraryInlineActions(card, id);
    }, HOLD_MS);
    const cancel = (moveEvent) => {
      if (moveEvent && moveEvent.type === "pointermove") {
        const dx = Math.abs(moveEvent.clientX - startX);
        const dy = Math.abs(moveEvent.clientY - startY);
        if (dx > 10 || dy > 10) clearTimeout(timer);
      } else {
        clearTimeout(timer);
      }
      if (!fired) {
        list.removeEventListener("pointermove", cancel);
        list.removeEventListener("pointerup", cancel);
        list.removeEventListener("pointercancel", cancel);
      }
    };
    list.addEventListener("pointermove", cancel);
    list.addEventListener("pointerup", cancel);
    list.addEventListener("pointercancel", cancel);
    libraryPress = { id, timer, cancel };
  });
  list.addEventListener("pointerup", () => {
    if (libraryPress) {
      clearTimeout(libraryPress.timer);
      libraryPress = null;
    }
  });
}

function clearLibraryInlineActions() {
  if (libraryPressCard) {
    libraryPressCard.classList.remove("is-pressing");
    const overlay = libraryPressCard.querySelector(".library-card-actions");
    if (overlay) overlay.remove();
    if (libraryPressCard._dismissOnOutside) {
      document.removeEventListener("click", libraryPressCard._dismissOnOutside, true);
      libraryPressCard._dismissOnOutside = null;
    }
    libraryPressCard._suppressNextClick = false;
    libraryPressCard = null;
  }
}

function openLibraryInlineActions(card, id) {
  clearLibraryInlineActions();
  state.actionPaperId = id;
  card.classList.add("is-pressing");
  const overlay = document.createElement("div");
  overlay.className = "library-card-actions";
  overlay.innerHTML = `
    <button type="button" class="library-card-action is-danger" data-library-action="delete" aria-label="删除" title="删除">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
    </button>
    <button type="button" class="library-card-action is-schedule" data-library-action="schedule" aria-label="加入日程" title="加入日程">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18"/><path d="M8 3v3"/><path d="M16 3v3"/><path d="M12 13v5"/><path d="M9.5 15.5h5"/></svg>
    </button>`;
  card.appendChild(overlay);
  // Suppress the click that immediately follows the long-press pointerup,
  // so the just-opened overlay isn't dismissed by the same gesture.
  libraryPressCard = card;
  libraryPressCard._suppressNextClick = true;
  // Dismiss when the user taps anywhere outside the action buttons.
  const dismissOnOutside = (event) => {
    if (event.target.closest(".library-card-action")) return;
    // Ignore the very first click after long-press finishes.
    if (libraryPressCard && libraryPressCard._suppressNextClick) {
      libraryPressCard._suppressNextClick = false;
      return;
    }
    if (event.target.closest("[data-library-card]") === card) {
      // Tap on the same card while overlay is up → just dismiss.
      clearLibraryInlineActions();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    clearLibraryInlineActions();
  };
  libraryPressCard._dismissOnOutside = dismissOnOutside;
  // Register on next tick so we don't catch the current pointerup's click.
  setTimeout(() => {
    document.addEventListener("click", dismissOnOutside, true);
  }, 0);
}

function handleLibraryAction(action) {
  const id = state.actionPaperId;
  if (!id) return;
  clearLibraryInlineActions();
  if (action === "delete") {
    removeFromLibrary(id);
    return;
  }
  if (action === "schedule") {
    state.scheduleWeekOffset = 0;
    state.scheduleDraftDate = state.weekPlanAssign.get(id) || null;
    state.scheduleDraftPriority = state.weekPlanPriority.get(id) || null;
    renderScheduleGrid();
    if (elements.libraryScheduleDialog) presentDialog(elements.libraryScheduleDialog);
  }
}

if (elements.libraryScheduleDialog) {
  elements.libraryScheduleDialog.addEventListener("close", () => {
    state.scheduleDraftDate = null;
    state.scheduleDraftPriority = null;
  });
  elements.libraryScheduleDialog.addEventListener("click", (event) => {
    const rect = elements.libraryScheduleDialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) dismissDialog(elements.libraryScheduleDialog);
  });
}

function renderScheduleGrid() {
  if (!elements.scheduleDateGrid) return;
  const offset = state.scheduleWeekOffset || 0;
  const start = weekStartDate(offset);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  if (elements.scheduleWeekLabel) {
    elements.scheduleWeekLabel.textContent = `${start.getMonth() + 1}/${start.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`;
  }
  const assignedKey = state.scheduleDraftDate || state.weekPlanAssign.get(state.actionPaperId);
  const priority = state.scheduleDraftPriority || state.weekPlanPriority.get(state.actionPaperId) || "medium";
  const cells = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = dateKey(d);
    const wd = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
    const isPast = d.getTime() < today.getTime();
    const assigned = assignedKey === key;
    return `
      <button type="button" class="schedule-date-cell${isPast ? " is-past" : ""}${assigned ? " is-assigned" : ""}" data-schedule-date="${key}" ${isPast ? "disabled" : ""}>
        <span class="schedule-date-wd">${wd}</span>
        <span class="schedule-date-num">${d.getDate()}</span>
        ${assigned ? '<span class="schedule-date-tick"><i data-lucide="check"></i></span>' : ""}
      </button>`;
  }).join("");
  elements.scheduleDateGrid.innerHTML = cells;
  document.querySelectorAll("[data-schedule-priority]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.schedulePriority === priority);
  });
  refreshIcons();
}

function setPaperPriority(priority) {
  state.scheduleDraftPriority = priority;
  renderScheduleGrid();
}

async function assignPaperToDate(dateKey) {
  const id = state.actionPaperId;
  if (!id || !dateKey) return;
  const prio = state.scheduleDraftPriority || state.weekPlanPriority.get(id) || "medium";
  if (!await saveSchedulePatch(id, {date:dateKey, priority:prio, removed:false})) return;
  state.scheduleDraftDate = null;
  state.scheduleDraftPriority = null;
  if (elements.libraryScheduleDialog) dismissDialog(elements.libraryScheduleDialog);
  renderLibrary();
  if (state.activeView === "todos") renderWeekPlan();
  showToast("Added to your reading schedule");
}

function updateProgress() {
  const total = state.papers.length;
  const pos = total ? Math.min(state.index + 1, total) : 0;
  if (elements.posLabel) elements.posLabel.textContent = String(pos);
  if (elements.totalLabel) elements.totalLabel.textContent = String(total);
  if (elements.progressFill) elements.progressFill.style.width = total ? ((pos / total) * 100) + "%" : "0%";
}

function updateLibraryCounts() {
  const counts = {
    save: state.library.filter((entry) => entry.action === "save").length,
    priority: state.library.filter((entry) => entry.action === "priority").length,
    read: state.library.filter((entry) => entry.action === "read").length,
  };
  setText("#saved-count", counts.save);
  setText("#priority-count", counts.priority);
  setText("#read-count", counts.read);
  setText("#bottom-library-count", state.library.length);
}

function setActionEnabled(enabled) {
  [elements.dismissButton, elements.priorityButton, elements.readButton, elements.saveButton].forEach((button) => { button.disabled = !enabled; });
}

function currentPaper() {
  return state.papers[state.index] || null;
}

function formatAuthors(authors) {
  const names = (authors || []).map((author) => author.name).filter(Boolean);
  if (!names.length) return "Author info pending";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")}, et al.`;
}

function noveltyBullets(paper) {
  const raw = paper.digest?.novelty;
  const fallback = paper.digest?.why_keep || "Matches current research interests.";
  let items = [];
  if (Array.isArray(raw)) {
    items = raw;
  } else if (typeof raw === "string" && raw.trim()) {
    items = raw.split(/(?:\r?\n|(?<=[.!?])\s+(?=[A-Z]))/);
  }
  items = items.map((s) => String(s || "").trim().replace(/^[-*•\s]+/, "")).filter(Boolean);
  if (!items.length) items = [fallback];
  return items.slice(0, 4);
}

function firstNoveltyBullet(paper) {
  const bullets = noveltyBullets(paper);
  return bullets[0] || "";
}

function getInitials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "PS";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 1800);
}

function anyDialogOpen() {
  return Array.from(document.querySelectorAll("dialog")).some((dialog) => dialog.open);
}

// Native back closes the topmost in-app surface before leaving the app.
document.addEventListener('paperswipe:back', event => {
  const dialog = Array.from(document.querySelectorAll('dialog[open]')).at(-1);
  if (dialog) { dismissDialog(dialog); event.preventDefault(); return; }
  const trending = document.querySelector('#trend-overlay');
  if (trending && !trending.hidden) { closeTrendOverlay(); event.preventDefault(); return; }
  if (elements.aiBotPage && !elements.aiBotPage.hidden) { closeAiBotPage(); event.preventDefault(); return; }
  if (elements.settingsPage && !elements.settingsPage.hidden) { closeSettingsPage(); event.preventDefault(); return; }
  if (isFlipped) { unflip(); event.preventDefault(); return; }
  if (state.started && state.activeView !== 'discover') { switchView('discover'); event.preventDefault(); }
});
let nativeResumeBusy = false;
document.addEventListener('paperswipe:resume', async () => {
  if (!state.started || nativeResumeBusy) return;
  nativeResumeBusy = true;
  try {
    const account = await fetch('/api/me');
    if (account.ok) await refreshLibrary();
  } catch (_) { showToast('暂时无法连接，已保留当前卡片'); }
  finally { nativeResumeBusy = false; }
});

function refreshIcons() {
  seedFrontTranslations();
  if (window.lucide) window.lucide.createIcons();
  window.PaperSwipeI18n?.apply();
  window.PaperSwipeContentLanguage?.refresh();
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = String(value);
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

// Mock fallbacks for missing real data.
function mockCitationCount(value) {
  const n = numberOrZero(value);
  return Math.max(0, n);
}
// Stable mock: same paper id always yields the same minute count so the
// number doesn't jump across re-renders. Range 30–120 min.
function mockReadMinutes(value, paperId) {
  return numberOrZero(value) > 0 ? numberOrZero(value) : 40;
}

// Formats the citation number for display. Always show a number; if no real
// count is available it is mocked to 0-25 upstream, so never show "preprint".
function citationLabel(paper) {
  const n = numberOrZero(paper && paper.citation_count);
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k cites`;
  return `${n} cites`;
}

function safeURL(value) {
  return Boolean(normalizeURL(value));
}

function normalizeURL(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
  } catch (_) {
    return "";
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function escapeAttribute(value) {
  return escapeHTML(value).replace(/`/g, "&#96;");
}
