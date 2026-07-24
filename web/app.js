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
  started: false,
  activeView: "discover",
  library: [],
  libraryFilter: "save",
  libraryTags: [],
  libraryTagsCollapsed: false,
  librarySort: "recent",
  appearance: "system",
  networkTab: "friends",
  aiModel: "",
  imageEnabled: false,
  imageModel: "",
  paperImages: new Map(),
  generatingImage: "",
  connectedPeople: new Set(),
  stats: { saved: 0, priority: 0, read: 0, dismissed: 0 },
  session: { dismiss: 0, save: 0, priority: 0, read: 0 },
  todos: [],
  todoScope: "day",
  librarySelectMode: false,
  librarySelected: new Set(),
};

const ONBOARDING_STORAGE_KEY = "paperswipe-onboarding-v1";
const APPEARANCE_STORAGE_KEY = "paperswipe-appearance-v1";
const elements = {};
let toastTimer;
let onboardingStep = 0;
let onboardingProfile = { ...DEFAULT_PROFILE, topics: [...DEFAULT_PROFILE.topics] };

/* ── Card swipe state ── */
let isFlipped = false;
let flipGuard = false;
let dragging = false;
let dragDX = 0, dragDY = 0, dragStartX = 0, dragStartY = 0, dragStartTime = 0;

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  state.todos = loadTodos() || defaultTodos();
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
});

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
    profileView: document.querySelector("#profile-view"),
    profileSettingsButton: document.querySelector("#profile-settings-button"),
    profileIdentity: document.querySelector("#profile-identity"),
    settingsPage: document.querySelector("#settings-page"),
    settingsClose: document.querySelector("#settings-close"),
    todoList: document.querySelector("#todo-list"),
    todoForm: document.querySelector("#todo-form"),
    todoInput: document.querySelector("#todo-input"),
    searchToggle: document.querySelector("#search-toggle"),
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
    libraryExportToggle: document.querySelector("#library-export-toggle"),
    libraryExportBar: document.querySelector("#library-export-bar"),
    libraryExportCount: document.querySelector("#library-export-n"),
    dialog: document.querySelector("#paper-dialog"),
    dialogContent: document.querySelector("#dialog-content"),
    libraryCardDialog: document.querySelector("#library-card-dialog"),
    libraryCardDialogContent: document.querySelector("#library-card-dialog-content"),
    filterDialog: null,
    forumDialog: document.querySelector("#forum-dialog"),
    aiBotPage: document.querySelector("#ai-bot-page"),
    aiBotMessages: document.querySelector("#ai-bot-messages"),
    aiBotForm: document.querySelector("#ai-bot-form"),
    aiBotInput: document.querySelector("#ai-bot-input"),
    aiBotSend: document.querySelector("#ai-bot-send"),
    aiBotClose: document.querySelector("#ai-bot-close"),
    aiBotReset: document.querySelector("#ai-bot-reset"),
    toast: document.querySelector("#toast"),
    recentSearches: document.querySelector("#recent-searches"),
    clearSearches: document.querySelector("#clear-searches"),
    peopleList: document.querySelector("#people-list"),
    settingsTopicChips: document.querySelector("#settings-topic-chips"),
    settingsTopicInput: document.querySelector("#settings-topic-input"),
    settingsComplexity: document.querySelector("#settings-complexity"),
    settingsComplexityLabel: document.querySelector("#settings-complexity-label"),
    networkScroll: document.querySelector("#network-scroll"),
    networkHeatmap: document.querySelector("#network-heatmap"),
    networkFriends: document.querySelector("#network-friends"),
    networkForum: document.querySelector("#network-forum"),
    forumPosts: document.querySelector("#forum-posts"),
    friendsList: document.querySelector("#friends-list"),
    composeFab: document.querySelector("#compose-fab"),
    composeDialog: document.querySelector("#compose-dialog"),
    composeTitle: document.querySelector("#compose-title"),
    composeBody: document.querySelector("#compose-body"),
    composeSubmit: document.querySelector("#compose-submit"),
    composeRefPick: document.querySelector("#compose-ref-pick"),
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

  elements.searchToggle.addEventListener("click", () => {
    const panel = elements.searchPanel;
    if (panel.hidden) {
      panel.hidden = false;
      panel.classList.remove("is-closing");
      elements.searchInput.focus();
      elements.searchToggle.classList.add("is-search-open");
    } else {
      panel.classList.add("is-closing");
      elements.searchToggle.classList.remove("is-search-open");
      panel.addEventListener("transitionend", function close() {
        panel.hidden = true;
        panel.classList.remove("is-closing");
        panel.removeEventListener("transitionend", close);
      });
    }
  });
  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    closeSearchPanel();
    performSearch(elements.searchInput.value);
  });

  if (elements.clearSearches) {
    elements.clearSearches.addEventListener("click", (e) => {
      e.stopPropagation();
      clearSearchHistory();
    });
  }

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
    const flipToggle = event.target.closest("[data-flip-card]");
    if (flipToggle) {
      event.stopPropagation();
      toggleCardFlip();
      return;
    }
    const queryButton = event.target.closest("[data-query]");
    if (queryButton) {
      elements.searchInput.value = queryButton.dataset.query;
      closeSearchPanel();
      switchView("discover");
      performSearch(queryButton.dataset.query);
      return;
    }
    const detailButton = event.target.closest("[data-detail-id]");
    if (detailButton) {
      elements.libraryCardDialog.close();
      openDetails(detailButton.dataset.detailId);
      return;
    }
    const libraryTag = event.target.closest("[data-library-tag]");
    if (libraryTag) {
      const tag = libraryTag.dataset.libraryTag;
      const index = state.libraryTags.indexOf(tag);
      if (index === -1) state.libraryTags.push(tag);
      else state.libraryTags.splice(index, 1);
      renderLibrary();
      return;
    }
    const libraryCard = event.target.closest("[data-library-card]");
    if (libraryCard && !event.target.closest("button")) {
      if (state.librarySelectMode) {
        toggleLibrarySelection(libraryCard.dataset.id);
      } else {
        openLibraryCard(libraryCard.dataset.id);
      }
      return;
    }
    const removeButton = event.target.closest("[data-remove-id]");
    if (removeButton) {
      elements.libraryCardDialog.close();
      removeFromLibrary(removeButton.dataset.removeId);
      return;
    }
    const closeButton = event.target.closest("[data-close-dialog]");
    if (closeButton) {
      document.querySelector(`#${closeButton.dataset.closeDialog}`)?.close();
      return;
    }
    const topicRemove = event.target.closest("[data-settings-topic-remove]");
    if (topicRemove) {
      removeSettingsTopic(topicRemove.dataset.settingsTopicRemove);
      return;
    }
    const connectButton = event.target.closest("[data-connect-person]");
    if (connectButton) {
      toggleConnection(connectButton);
      return;
    }
    const chatButton = event.target.closest("[data-chat-person]");
    if (chatButton) {
      showToast(`已打开与 ${chatButton.dataset.chatPerson} 的研究对话`);
      return;
    }
    const forumItem = event.target.closest(".forum-list button");
    if (forumItem) {
      elements.forumDialog.close();
      showToast("论坛原型已就绪，讨论数据将在后续接入");
    }
  });

  document.querySelector("#dialog-close").addEventListener("click", () => elements.dialog.close());

  const aiBotButton = document.querySelector("#ai-bot-button");
  if (aiBotButton) {
    aiBotButton.addEventListener("click", () => {
      openAiBotPage();
    });
  }

  if (elements.libraryExportToggle) {
    elements.libraryExportToggle.addEventListener("click", () => toggleLibrarySelectMode());
  }
  if (elements.libraryExportBar) {
    elements.libraryExportBar.addEventListener("click", (event) => {
      const action = event.target.closest("[data-library-export-action]")?.dataset.libraryExportAction;
      if (!action) return;
      if (action === "all") selectAllLibraryVisible();
      else if (action === "clear") clearLibrarySelection();
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
        elements.aiBotInput.value = prompt.prefill;
        sendBotMessage();
        return;
      }
      elements.aiBotInput.value = prompt.prefill;
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
      if (event.target === dialog) dialog.close();
    });
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
    });
  });

  document.querySelector("#forums-button").addEventListener("click", () => elements.forumDialog.showModal());
  document.querySelectorAll("[data-network-tab]").forEach((button) => {
    button.addEventListener("click", () => switchNetworkTab(button.dataset.networkTab));
  });

  document.querySelectorAll("[data-forum-type]").forEach((button) => {
    button.addEventListener("click", () => switchForumType(button.dataset.forumType));
  });

  if (elements.composeFab) {
    elements.composeFab.addEventListener("click", () => openCompose());
  }
  if (elements.composeSubmit) {
    elements.composeSubmit.addEventListener("click", submitComposePost);
  }
  if (elements.composeRefPick) {
    elements.composeRefPick.addEventListener("click", openRefPicker);
  }
  document.querySelectorAll("[data-compose-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      composeTypeState = btn.dataset.composeType;
      document.querySelectorAll("[data-compose-type]").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.composeType === composeTypeState);
      });
    });
  });

  document.querySelector("#save-topics-button").addEventListener("click", saveSettingsTopics);
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
  const zoteroTestBtn = document.querySelector("#zotero-test-button");
  const zoteroClearBtn = document.querySelector("#zotero-clear-button");
  const saved = loadZoteroCredentials();
  if (zoteroApiKeyInput && saved.apiKey) zoteroApiKeyInput.value = saved.apiKey;
  if (zoteroUserIdInput && saved.userId) zoteroUserIdInput.value = saved.userId;
  if (zoteroApiKeyInput) zoteroApiKeyInput.addEventListener("change", persistZoteroCredentials);
  if (zoteroUserIdInput) zoteroUserIdInput.addEventListener("change", persistZoteroCredentials);
  if (zoteroTestBtn) zoteroTestBtn.addEventListener("click", testZoteroConnection);
  if (zoteroClearBtn) zoteroClearBtn.addEventListener("click", clearZoteroCredentials);

  if (elements.profileSettingsButton) elements.profileSettingsButton.addEventListener("click", openSettingsPage);
  if (elements.settingsClose) elements.settingsClose.addEventListener("click", closeSettingsPage);
  if (elements.todoForm) elements.todoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = elements.todoInput.value.trim();
    if (!text) return;
    addTodo(text);
    elements.todoInput.value = "";
  });
  document.querySelectorAll("[data-todo-scope]").forEach((button) => {
    button.addEventListener("click", () => switchTodoScope(button.dataset.todoScope));
  });
  if (elements.todoList) elements.todoList.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-todo-toggle]");
    if (toggle) { toggleTodo(toggle.dataset.todoToggle); return; }
    const remove = event.target.closest("[data-todo-remove]");
    if (remove) { removeTodo(remove.dataset.todoRemove); return; }
  });

  document.addEventListener("keydown", (event) => {
    if (!state.started || state.activeView !== "discover" || state.loading || dragging || anyDialogOpen() || event.target.matches("input, textarea")) return;
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
  return ["light", "system", "dark"].includes(saved) ? saved : "system";
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
  label.textContent = "Analyzing your topic…";

  try {
    const response = await fetch("/api/topic-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  renderPeople();
  renderSettings();
  refreshHealth();
  refreshLibrary();
  refreshStats();
  refreshSearches();
  bindCardGestures();
  performSearch(state.query);
}

function closeSearchPanel() {
  const panel = elements.searchPanel;
  if (panel.hidden) return;
  panel.classList.add("is-closing");
  elements.searchToggle.classList.remove("is-search-open");
  panel.addEventListener("transitionend", function close() {
    panel.hidden = true;
    panel.classList.remove("is-closing");
    panel.removeEventListener("transitionend", close);
  });
}

async function clearSearchHistory() {
  try {
    await fetch("/api/searches", { method: "DELETE" });
  } catch (_) {
    // Clear locally even if API fails
  }
  elements.recentSearches.innerHTML = "";
  if (elements.clearSearches) elements.clearSearches.hidden = true;
  showToast("已清除搜索历史");
}

async function performSearch(rawQuery) {
  const query = String(rawQuery || "").trim();
  if (query.length < 2) {
    showToast("请输入至少 2 个字符");
    elements.searchInput.focus();
    return;
  }
  state.loading = true;
  state.query = query;
  state.index = 0;
  state.papers = [];
  elements.searchInput.value = query;
  elements.searchNote.textContent = "";
  elements.resultSource.textContent = "正在检索开放论文源";
  elements.resultQuery.textContent = query;
  setActionEnabled(false);
  renderLoadingCard();

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "检索失败");
    state.papers = payload.papers || [];
    state.source = payload.source || "Open papers";
    state.imageEnabled = Boolean(payload.image_enabled);
    elements.searchNote.textContent = payload.warning || "";
    elements.resultSource.textContent = `${state.source} · ${state.papers.length} candidates`;
    elements.resultQuery.textContent = payload.query;
    setEngineStatus(Boolean(payload.ai_enabled));
    renderCard();
    refreshSearches();
  } catch (error) {
    renderErrorCard(error.message);
    showToast(error.message);
  } finally {
    state.loading = false;
  }
}

function renderLoadingCard() {
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
  updateProgress();
}

function renderErrorCard(message) {
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
        <div class="card-hero" id="cardHero" style="display:grid;place-items:center;color:#fff;font-size:14px;font-weight:800;text-align:center;padding:30px;">
          No papers found<br><small style="font-weight:400;opacity:.7;margin-top:8px;">${escapeHTML(message)}. Try a different keyword.</small>
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
  setActionEnabled(false);
  updateProgress();
}

function renderCard() {
  const paper = currentPaper();
  /* Reset card state */
  elements.card.style.transition = "";
  elements.card.style.opacity = "";
  elements.card.style.boxShadow = "";
  elements.card.style.transform = "";
  isFlipped = false;
  elements.cardInner.classList.remove("is-flipped");

  if (!paper) {
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
  const venueBadge = venueYear ? venueName + " " + venueYear : venueName || "Publication";

  const c = {
    theme: theme,
    title: paper.title,
    subtitle: pickSubtitle(paper),
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
    read_minutes: numberOrZero(paper.read_minutes),
    citation_count: numberOrZero(paper.citation_count),
  };

  elements.card.className = "card " + c.theme;
  elements.card.style.transform = "";
  elements.card.innerHTML = `
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
            <p class="card-subtitle">${escapeHTML(c.subtitle)}</p>
            <h2 class="card-title">${escapeHTML(c.title)}</h2>
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
              <span class="source-stat"><span class="source-stat-emoji">📖</span>${c.read_minutes} min</span>
              <span class="source-stat"><span class="source-stat-emoji">🌟</span>${c.citation_count} cites</span>
              ${c.url ? `<a class="source-link" href="${escapeAttribute(c.url)}" target="_blank" rel="noopener" data-stop-click>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Original
              </a>` : ""}
              ${c.pdf_url ? `<a class="source-link" href="${escapeAttribute(c.pdf_url)}" target="_blank" rel="noopener" data-stop-click>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                PDF
              </a>` : ""}
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

  /* Entrance animation — slide up + fade in */
  elements.card.style.transition = 'none';
  elements.card.style.transform = 'translateY(38px) scale(0.93)';
  elements.card.style.opacity = '0';
  elements.stack1.style.transition = elements.stack2.style.transition = 'none';
  elements.stack1.style.transform = 'translateY(6px) scale(.96)';
  elements.stack1.style.opacity = '.45';
  elements.stack2.style.transform = 'translateY(14px) scale(.91)';
  elements.stack2.style.opacity = '.25';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      elements.card.style.transition = 'transform 440ms cubic-bezier(.25,.8,.25,1.2), opacity 360ms ease, box-shadow 440ms ease';
      elements.card.style.transform = '';
      elements.card.style.opacity = '';
      elements.card.style.boxShadow = '';
      elements.stack1.style.transition = elements.stack2.style.transition = 'transform 440ms cubic-bezier(.25,.8,.25,1.2), opacity 440ms ease';
      elements.stack1.style.transform = 'translateY(10px) scale(.94)';
      elements.stack1.style.opacity = '.35';
      elements.stack2.style.transform = 'translateY(20px) scale(.89)';
      elements.stack2.style.opacity = '.18';
      elements.card.addEventListener('transitionend', function h() {
        elements.card.style.transition = '';
        elements.card.removeEventListener('transitionend', h);
      });
    });
  });
}

/* Refresh cached element refs after innerHTML replacement */
function refreshElementRefs() {
  elements.cardInner = document.querySelector("#cardInner");
  elements.cardFront = document.querySelector("#cardFront");
  elements.cardBack = document.querySelector("#cardBack");
  elements.cardHero = document.querySelector("#cardHero");
}

/* ── Polish a hook to match card-swipe-demo style ── */
function polishHook(raw, title) {
  if (!raw || raw.length < 10) return null;
  /* Reject Chinese text / placeholders */
  if (/[一-鿿]/.test(raw)) return null;
  if (/research paper worth checking out|noteworthy paper/i.test(raw) && raw.length < 60) return null;
  let s = raw.trim();
  /* Normalize whitespace */
  s = s.replace(/\s+/g, ' ');
  /* Strip trailing dots, ensure one clean sentence */
  s = s.replace(/\.+$/, '').trim();
  if (!/[.!?]$/.test(s)) s += '.';
  /* Truncate to 120 chars at word boundary */
  if (s.length > 120) {
    const cut = s.lastIndexOf(' ', 117);
    s = (cut > 60 ? s.slice(0, cut) : s.slice(0, 117)) + '.';
  }
  /* Remove boilerplate starts — rewrite as demo-style "A [concept]..." */
  s = s.replace(/^(We|In this (paper|work)|This (paper|work)) (propose|present|introduce|demonstrate|show|study|explore|address|develop|describe|investigate|examine|consider|focus on)(s?)\s+(a |an |the )?/i, 'A ');
  /* Remove leading lowercase after "A " replacement */
  s = s.replace(/^A ([a-z])/, (_, c) => 'A ' + c.toUpperCase());
  /* Capitalize first letter */
  s = s.charAt(0).toUpperCase() + s.slice(1);
  /* Reject if it's essentially the same as the title (but be lenient) */
  if (title && s.length > 20) {
    const t = title.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const h = s.toLowerCase().replace(/[^a-z0-9]/g, '');
    /* Only reject if the hook is contained entirely within the title */
    if (h.length > 30 && t.includes(h)) return null;
    /* Also reject if hook is just the title verbatim */
    if (h === t) return null;
  }
  return s;
}

/* ── Pick the hook subtitle: AI-generated first, then heuristic synthesis ── */
function pickSubtitle(paper) {
  const title = (paper.title || "").trim();

  /* 0) AI / heuristic hook from Go backend */
  const aiHook = paper.digest?.hook || "";
  const polished = polishHook(aiHook, title);
  if (polished) return polished;

  /* Fall through to heuristic synthesis (below) */
  const d = paper.digest || {};

  /* ── Step 1: Distill raw academic sentences into clean hook phrases ── */
  function distill(raw) {
    if (!raw) return null;
    /* Reject Chinese text / placeholders outright */
    if (/[一-鿿]|摘要|确认|建议|未提供|未明确|未报告|需要进入正文|值得快速/.test(raw)) return null;
    /* Must start with a letter or digit */
    if (!/^[A-Za-z0-9]/.test(raw)) return null;

    let s = raw.replace(/\s+/g, ' ').trim();

    /* Strip boilerplate prefixes */
    s = s.replace(/^(We|In this (paper|work)|This (paper|work)) (propose|present|introduce|investigate|demonstrate|show|study|explore|address|develop|describe|consider|examine|focus on)(s| that| a novel| an)?\s*/i, '');

    /* Strip trailing "We show / demonstrate / find / observe / report that..." */
    s = s.replace(/,?\s*(we|and|&) (show|demonstrate|find|observe|report|conclude|argue|suggest) that[^.!?]*$/i, '');

    /* Remove inline citations: [1], [2,3,4], (Author, 2020), (Author et al., 2020a) */
    s = s.replace(/\s*[\[\(]\d+(?:[,\s]*\d+)*[\]\)]/g, '');
    s = s.replace(/\s*\([A-Z][a-z]+(?:\s(?:et\s+al\.?))?,?\s*\d{4}[a-z]?\)/g, '');

    /* Capitalize first letter */
    s = s.trim();
    if (s.length < 12) return null;
    s = s.charAt(0).toUpperCase() + s.slice(1);

    /* Ensure sentence-ending punctuation */
    if (!/[.!?]$/.test(s)) s += '.';
    return s;
  }

  /* ── Step 2: Extract a punchy result snippet (numbers / outperformance claims) ── */
  function extractResult(raw) {
    if (!raw) return null;
    if (/[一-鿿]/.test(raw)) return null;
    /* "X% improvement", "outperforms by X", "achieves X BLEU/accuracy/F1" */
    const m = raw.match(/((?:achieve|improve|outperform|reach|boost|increase|reduce|surpass|rival|match|exceed)(?:s|d|ing)?\s+[^.!?]{10,100}?[.!]?)/i);
    if (m) {
      let r = m[1].trim().replace(/\s+/g, ' ');
      if (!/[.!?]$/.test(r)) r += '.';
      return r.charAt(0).toUpperCase() + r.slice(1);
    }
    /* Any sentence with a number or percentage */
    const nm = raw.match(/([^.!?]{10,120}?\d+[%％]?[^.!?]{0,60}[.!]?)/);
    if (nm) {
      let r = nm[1].trim().replace(/\s+/g, ' ');
      if (r.length < 15) return null;
      if (!/[.!?]$/.test(r)) r += '.';
      return r.charAt(0).toUpperCase() + r.slice(1);
    }
    return null;
  }

  /* ── Step 3: Assemble the hook ── */

  const noveltyClean = distill(firstNoveltyBullet(paper));
  const methodClean = distill(d.method);
  const resultClean = extractResult(d.result);
  const resultFull = distill(d.result);

  /* (A) Novelty + Result combo — strongest hook */
  if (noveltyClean && resultClean && noveltyClean !== resultClean) {
    if (noveltyClean.length + resultClean.length < 180) {
      return noveltyClean + ' ' + resultClean;
    }
    return noveltyClean;
  }

  /* (B) Novelty alone (clean, not boilerplate) */
  if (noveltyClean && noveltyClean.length > 20) return noveltyClean;

  /* (C) Method + Result combo */
  if (methodClean && resultClean && methodClean !== resultClean) {
    if (methodClean.length + resultClean.length < 180) {
      return methodClean + ' ' + resultClean;
    }
    return methodClean;
  }

  /* (D) Method alone */
  if (methodClean && methodClean.length > 20) return methodClean;

  /* (E) Result alone (cleaned) */
  if (resultClean) return resultClean;
  if (resultFull && resultFull.length > 20) return resultFull;

  /* (F) Scan abstract for the strongest standalone sentence */
  const abstract = (paper.abstract || "").trim();
  if (abstract && /^[A-Z]/.test(abstract)) {
    const sentences = abstract.match(/[^.!?]+[.!?]+/g) || [];
    for (const s of sentences) {
      const d = distill(s);
      if (d && d.length > 25 && d.length < 160 &&
          /outperform|state.of.the.art|first|novel|significant|improves?|achieves?|enable|transform|reshape|unlock/i.test(d)) {
        return d;
      }
    }
    /* Fallback: distill the first decent sentence */
    for (const s of sentences) {
      const d = distill(s);
      if (d && d.length > 20 && d.length < 160) return d;
    }
  }

  /* (G) Synthesize from title — craft a demo-style one-liner */
  if (title) {
    /* G1: Title has a subtitle after colon — use that part (usually the most interesting) */
    const colonIdx = Math.max(
      title.indexOf(':'), title.indexOf('–'), title.indexOf('—'), title.indexOf('-')
    );
    if (colonIdx > 10 && colonIdx < title.length - 10) {
      const hookPart = title.slice(colonIdx + 1).trim();
      /* Remove common filler: "A Survey", "A Review", "A Comprehensive Study" */
      const cleaned = hookPart.replace(/^(A |An )?(Survey|Review|Comprehensive Study|Systematic Review|Meta.Analysis)( of | on )?/i, '');
      if (cleaned.length > 20 && cleaned.length < 130) return cleaned + '.';
      if (hookPart.length > 20 && hookPart.length < 130) return hookPart + '.';
    }

    /* G2: For verb-heavy titles like "X Elicits Y" or "X Improves Y", extract and reformat */
    const verbPatterns = [
      { verb: 'elicits', adj: 'simple' },
      { verb: 'improves', adj: 'novel' },
      { verb: 'enables', adj: 'powerful' },
      { verb: 'reshapes', adj: 'transformative' },
      { verb: 'transforms', adj: 'revolutionary' },
      { verb: 'matches', adj: 'new' },
      { verb: 'achieves', adj: 'breakthrough' },
      { verb: 'unlocks', adj: 'novel' },
      { verb: 'redefines', adj: 'pioneering' },
      { verb: 'outperforms', adj: 'powerful' },
    ];
    const titleLower = title.toLowerCase();
    for (const {verb, adj} of verbPatterns) {
      const pattern = new RegExp(`(.+?)\\s+${verb}\\s+(.+?)($|\\.)`, 'i');
      const m = title.match(pattern);
      if (m) {
        const subject = m[1].trim();
        const impact = m[2].trim().replace(/\.$/, '');
        /* Clean subject: remove leading "A ", "The ", "On the ", "Towards " */
        const cleanSubject = subject.replace(/^(A |An |The |On the |Towards |Toward )/i, '').toLowerCase();
        const cleanImpact = impact.charAt(0).toLowerCase() + impact.slice(1);
        if (cleanSubject.length > 5 && cleanImpact.length > 10) {
          const hook = `A ${adj} ${cleanSubject} that ${verb}s ${cleanImpact}.`;
          if (hook.length < 140) return hook;
        }
        break;
      }
    }

    /* G3: Extract subject from title ending with common suffixes */
    const suffixes = [
      ' in Large Language Models', ' in Deep Learning', ' for Image Generation',
      ' in Natural Language Processing', ' in Computer Vision', ' for Machine Learning',
      ' in Neural Networks', ' for Sequence Modeling',
    ];
    let subject = title;
    for (const suf of suffixes) {
      if (titleLower.endsWith(suf.toLowerCase())) {
        subject = title.slice(0, -suf.length).trim();
        break;
      }
    }
    if (subject !== title && subject.length > 8 && subject.length < 80) {
      return `A novel ${subject.toLowerCase()} that advances the state of the art.`;
    }

    /* G4: Truncate long title */
    if (title.length > 90) {
      const cut = title.lastIndexOf(' ', 87);
      return (cut > 40 ? title.slice(0, cut) : title.slice(0, 87)) + '…';
    }

    /* G5: For short declarative titles, prefix with "A" and reframe */
    if (title.length < 100 && /^[A-Z]/.test(title)) {
      /* Already a decent one-liner — just ensure period */
      return title.endsWith('.') ? title : title + '.';
    }
  }

  return "A research paper worth checking out.";
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

  function onDown(e) {
    if (!currentPaper() || state.loading) return;
    if (e.target.closest("button, a, [data-stop-click]")) return;
    if (isFlipped && e.target.closest(".back-details")) return;
    dragging = true; dragDX = 0; dragDY = 0;
    dragStartX = e.clientX; dragStartY = e.clientY;
    dragStartTime = Date.now();
    card.classList.add("is-dragging");
    card.setPointerCapture(e.pointerId);
  }

  function onMove(e) {
    if (!dragging) return;
    dragDX = e.clientX - dragStartX;
    dragDY = e.clientY - dragStartY;

    /* Full 3D tilt */
    const rx = (dragDY / 300) * 16;
    const ry = (dragDX / 200) * 12;
    card.style.transform = `translate(${dragDX}px, ${dragDY}px) rotateX(${-rx}deg) rotateY(${ry}deg)`;

    const dist = Math.sqrt(dragDX * dragDX + dragDY * dragDY);
    const lift = Math.min(dist / 30, 1);
    const shadowAlpha = .10 + lift * .12;
    card.style.boxShadow = `
      0 1px 2px rgba(0,0,0,.04),
      0 ${4 + lift * 8}px ${8 + lift * 10}px rgba(0,0,0,.06),
      0 ${14 + lift * 16}px ${28 + lift * 20}px rgba(0,0,0,${shadowAlpha}),
      0 ${28 + lift * 24}px ${56 + lift * 32}px rgba(0,0,0,${shadowAlpha * .8})`;

    const strength = Math.min(1, Math.max(Math.abs(dragDX), Math.abs(dragDY)) / 110);
    elements.stack1.style.transform = `translateY(${10 - strength * 10}px) scale(${.94 + strength * .06})`;
    elements.stack1.style.opacity = .35 - strength * .25;
    elements.stack2.style.transform = `translateY(${20 - strength * 20}px) scale(${.89 + strength * .1})`;
    elements.stack2.style.opacity = .18 - strength * .14;

    updateStamps(dragDX, dragDY, strength);
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    card.classList.remove("is-dragging");

    const dist = Math.sqrt(dragDX * dragDX + dragDY * dragDY);
    const dt = Date.now() - dragStartTime;
    const velocity = dt > 0 ? dist / dt : 0;

    /* Tap: flip (front → back) or unflip (back → front) */
    if (dist < 8 && dt < 300) {
      springBack();
      flipGuard = true;
      setTimeout(() => { flipGuard = false; }, 100);
      isFlipped ? unflip() : flip();
      return;
    }

    /* Dynamic thresholds: fast flick needs less distance */
    const fastFlick = velocity > 0.65;
    const thresholdX = fastFlick ? 50 : 95;
    const thresholdY = fastFlick ? 42 : 85;

    /* Swipe: fly away with velocity boost */
    if (dragDX < -thresholdX && Math.abs(dragDX) > Math.abs(dragDY)) { if (isFlipped) unflip(); decide("dismiss"); }
    else if (dragDX > thresholdX && Math.abs(dragDX) > Math.abs(dragDY)) { if (isFlipped) unflip(); decide("save"); }
    else if (dragDY < -thresholdY && Math.abs(dragDY) > Math.abs(dragDX) * .8) { if (isFlipped) unflip(); decide("priority"); }
    else if (dragDY > thresholdY && Math.abs(dragDY) > Math.abs(dragDX) * .8) { if (isFlipped) unflip(); decide("read"); }
    else { springBack(); }
  }

  card.addEventListener("pointerdown", onDown);
  card.addEventListener("pointermove", onMove);
  card.addEventListener("pointerup", onUp);
  card.addEventListener("pointercancel", onUp);

  /* Tap anywhere on back to flip back */
  card.addEventListener("click", (e) => {
    if (flipGuard || !isFlipped || !currentPaper() || dragging) return;
    if (e.target.closest("button, a, [data-stop-click]")) return;
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

function resetStacks() {
  elements.stack1.style.transition = elements.stack2.style.transition = "transform 420ms cubic-bezier(.25,.8,.25,1.2), opacity 420ms ease";
  elements.stack1.style.transform = "translateY(10px) scale(.94)";
  elements.stack1.style.opacity = ".35";
  elements.stack2.style.transform = "translateY(20px) scale(.89)";
  elements.stack2.style.opacity = ".18";
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
    elements.stack1.style.transition = elements.stack2.style.transition = "none";
    elements.stack1.style.transform = "translateY(10px) scale(.94)";
    elements.stack1.style.opacity = ".35";
    elements.stack2.style.transform = "translateY(20px) scale(.89)";
    elements.stack2.style.opacity = ".18";
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
  if (!paper || state.loading) return;
  state.session[action] += 1;
  unflip();
  fly(action, 0);

  try {
    const response = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paper, action }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} ${body.slice(0, 120)}`);
    }
    await Promise.all([refreshLibrary(), refreshStats()]);
  } catch (err) {
    console.error("[decide] persist failed", { action, paperId: paper.id, err });
    showToast(`未同步到 Library：${err.message || err}`);
  }
}


async function refreshHealth() {
  try {
    const response = await fetch("/api/health");
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
  elements.aiStatus.textContent = aiEnabled ? (state.aiModel || "LLM summary") : "Local summary";
  elements.aiStatus.parentElement.classList.toggle("is-ai", aiEnabled);
}

const AI_BOT_PROMPTS = [
  {
    id: "daily",
    icon: "calendar-check-2",
    theme: "violet",
    title: "帮我安排每日任务",
    subtitle: "结合 DDL 和空闲时间，从 Library 派发今日阅读",
    prefill: "我最近的目标是……（DDL：___；每天可读 ___ 分钟）。请从 Library 里帮我安排今日阅读任务，尽量按重要性和阅读时长排。",
  },
  {
    id: "today",
    icon: "sparkles",
    theme: "coral",
    title: "今天最该读哪一篇？",
    subtitle: "描述你的当前目标，让 AI 挑最相关的一篇",
    prefill: "我目前在做……。请从 Library 里推荐今天最应该读的那一篇论文，并告诉我为什么。",
  },
  {
    id: "roadmap",
    icon: "route",
    theme: "teal",
    title: "论文太多，给我一条 Roadmap",
    subtitle: "按主题聚类并生成分阶段学习路径",
    prefill: "Library 里论文太多了，请给我一条从综述到经典再到最新的学习 roadmap。",
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
    <span class="ai-bot-hero-avatar"><i data-lucide="sparkles"></i></span>
    <p class="ai-bot-hero-title">Hi，我是你的论文助手</p>
    <p class="ai-bot-hero-sub">${count
      ? `你的 Library 里已经有 <b>${count}</b> 篇论文${intent ? `，围绕「${escapeHTML(shorten(intent, 24))}」` : ""}。告诉我你的目标，我来帮你规划。`
      : "先去 Explore 划几篇论文到 Library，我就能帮你做阅读规划。"}</p>
  `;
  elements.aiBotMessages.appendChild(hero);

  const suggestions = document.createElement("div");
  suggestions.className = "ai-bot-suggestions";
  suggestions.setAttribute("aria-label", "推荐提问");
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
    return "你的 Library 还是空的。先回到 Explore 划几篇感兴趣的论文，再回来让我帮你规划。";
  }
  if (/(每周|一周|按周|week|周计划|排一周|一周内)/i.test(query) ||
      (/(ddl|deadline|截止)/i.test(query) && /(每天.*分钟|每日.*分钟|min\/day|分钟\/?天)/i.test(query))) {
    return buildWeekPlanReply(papers, query);
  }
  if (/(每日|每天|今日安排|任务|schedule|daily|ddl|deadline|空闲|计划)/i.test(query)) {
    return buildDailyPlanReply(papers, query);
  }
  if (/(今天.*读|该读|最应该读|优先读|priority|top pick|哪一篇)/i.test(query)) {
    return buildTopPickReply(papers, query);
  }
  if (/(roadmap|路线|路径|学习顺序|入门到进阶|阶段|分阶段|太多|从综述|综述.*经典|经典.*最新)/i.test(query)) {
    return { type: "roadmap", data: window.__PAPERSWIPE_ROADMAP__ };
  }
  if (/(主题|方向|topic|领域)/i.test(query)) {
    const tags = {};
    papers.forEach((p) => deriveTags(p).forEach((t) => { if (t) tags[t] = (tags[t] || 0) + 1; }));
    const top = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (!top.length) return "我暂时没能从你的论文里总结出明确主题，先多收藏几篇吧。";
    return "你 Library 里的主要主题：\n" + top.map(([t, n]) => `• ${t}（${n} 篇）`).join("\n");
  }
  if (/(排序|顺序|order)/i.test(query)) {
    const sorted = [...papers].sort((a, b) => (a.read_minutes || 99) - (b.read_minutes || 99));
    return "按阅读时长从短到长的顺序：\n" + sorted.slice(0, 8).map((p, i) => `${i + 1}. ${p.title}（约 ${p.read_minutes || "?"} 分钟）`).join("\n");
  }
  const cleaned = q.replace(/[?？。.,、\s]/g, "");
  if (cleaned.length >= 2) {
    const matched = papers.filter((p) =>
      (p.title || "").toLowerCase().includes(cleaned) ||
      (p.abstract || "").toLowerCase().includes(cleaned)
    );
    if (matched.length) {
      const p = matched[0];
      const tldr = p.digest?.tldr || p.abstract || "（暂无摘要）";
      const authors = (p.authors || []).slice(0, 3).map((a) => a.name || a).join("、") || "未知";
      return `找到《${p.title}》：\n${tldr}\n\n作者：${authors}`;
    }
  }
  return "我可以帮你：\n• 结合 DDL / 空闲时间安排每日任务\n• 挑出今天最该读的那一篇\n• 生成一条学习 roadmap\n\n把你的目标告诉我就行。";
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
  const header = `按你 ~${budget} 分钟的时间预算，今天可以安排：`;
  const body = plan.map((p, i) => `${i + 1}. ${p.title}（约 ${p.read_minutes || 20} 分钟｜相关度 ${p.match_score || "?"}）`).join("\n");
  return `${header}\n${body}\n\n建议先看方法框架和主实验，把它当作 30 分钟一段的番茄工作。如果告诉我 DDL 我可以给你分到未来几天。`;
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
    return { order: 0, tag: "综述", accent: "violet" };
  }
  const year = Number(paper.year || paper.published_year || 0);
  if (year && year >= new Date().getFullYear() - 1) return { order: 2, tag: "最新", accent: "teal" };
  return { order: 1, tag: "经典", accent: "coral" };
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
      title: `按 ${dailyBudget} 分钟/天为你排好了 ${totalDays} 天阅读计划`,
      subtitle: ddl
        ? `DDL：${ddl.getFullYear()}/${ddl.getMonth() + 1}/${ddl.getDate()}｜共 ${enriched.length - overflow.length} 篇入表`
        : `共 ${enriched.length - overflow.length} 篇入表，按 综述 → 经典 → 最新 顺序推进`,
      dailyBudget,
      ddl: ddl ? ddl.toISOString() : null,
      days,
      overflow,
    },
  };
}

function buildTopPickReply(papers, query) {
  const pick = pickBestForToday(papers);
  if (!pick) return "我暂时没找到候选论文，可以先去 Library 加几篇。";
  const digest = pick.digest || {};
  const reason = digest.why_keep || digest.tldr || digest.verdict || "与你 Library 里的主线方向相关度最高";
  const focus = digest.reading_focus || "先看方法框架、主实验与局限性";
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

function buildRoadmapReply(papers) {
  return { type: "roadmap", data: window.__PAPERSWIPE_ROADMAP__ };
}

function appendBotRoadmap(data) {
  if (!data || !Array.isArray(data.stages) || !data.stages.length) {
    appendBotMessage("我暂时没能生成 roadmap，请稍后再试。");
    return;
  }
  const container = document.createElement("div");
  container.className = "ai-bot-roadmap";
  container.innerHTML = `
    <header class="ai-bot-roadmap-head">
      <span class="ai-bot-roadmap-badge"><i data-lucide="route"></i></span>
      <div>
        <strong>${escapeHTML(data.title || "为你生成的学习 roadmap")}</strong>
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
                      ${paper.minutes ? `<small class="ai-bot-roadmap-time"><i data-lucide="clock-3"></i>${escapeHTML(String(paper.minutes))} 分钟</small>` : ""}
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

const WEEKDAY_LABEL = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
let __weekPlanCounter = 0;

function appendBotWeekPlan(data) {
  if (!data || !Array.isArray(data.days) || !data.days.length) {
    appendBotMessage("我暂时没能生成周计划，请稍后再试。");
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
        <strong>${escapeHTML(data.title || "本周阅读计划")}</strong>
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
              <span class="ai-bot-weekplan-day-sum"><i data-lucide="clock-3"></i>${day.minutes} 分钟</span>
            </div>
            <ul class="ai-bot-weekplan-items">
              ${day.items.map((it) => `
                <li class="ai-bot-weekplan-item accent-${escapeAttribute(it.prio.accent || "violet")}">
                  <span class="ai-bot-weekplan-chip">${escapeHTML(it.prio.tag || "")}</span>
                  <div class="ai-bot-weekplan-item-body">
                    <h5>${escapeHTML(it.paper.title || "")}</h5>
                    <small>约 ${it.minutes} 分钟</small>
                  </div>
                </li>
              `).join("")}
            </ul>
          </li>
        `;
      }).join("")}
    </ol>
    ${data.overflow && data.overflow.length ? `
      <p class="ai-bot-weekplan-overflow">还有 ${data.overflow.length} 篇没排进日程，DDL 之后可继续跟进。</p>
    ` : ""}
    <footer class="ai-bot-weekplan-foot">
      <button type="button" class="ai-bot-weekplan-cta" data-weekplan-export="${planId}">
        <i data-lucide="calendar-plus"></i>
        <span>一键加到我的日历</span>
      </button>
      <small>会下载一个 .ics 文件，双击即可导入 Apple / Google / Outlook 日历</small>
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
  if (!data) { showToast("找不到这份计划，可能已过期"); return; }
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PaperSwipe//AI Bot//CN", "CALSCALE:GREGORIAN"];
  const stamp = icsDateTime(new Date());
  data.days.filter((day) => day.items.length).forEach((day, i) => {
    const start = new Date(day.date); start.setHours(20, 0, 0, 0);
    const end = new Date(start.getTime() + day.minutes * 60000);
    const summary = `PaperSwipe · ${day.items.length} 篇 · ${day.minutes}min`;
    const desc = day.items.map((it, idx) => `${idx + 1}. [${it.prio.tag}] ${it.paper.title}（约 ${it.minutes} 分钟）`).join("\n");
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
  showToast("已生成 .ics 文件，双击导入你的日历");
}

function appendBotTopPick(data) {
  if (!data || !data.paper) {
    appendBotMessage("我暂时没找到候选论文，可以先去 Library 加几篇。");
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
    { label: "研究问题", icon: "search", text: digest.problem || "摘要未提供明确的研究问题" },
    { label: "核心方法", icon: "book-open", text: digest.method || (Array.isArray(digest.novelty) ? digest.novelty.join(" ") : digest.novelty) || "摘要未提供明确的方法说明" },
    { label: "主要结果", icon: "sparkles", text: digest.result || "摘要未提供可核验的研究结果" },
  ];
  const minutes = Number(paper.read_minutes) || 0;
  const needsReproduction = /复现|repro|reproduc/i.test(digest.reading_focus || "") || /代码|code|开源/i.test(digest.audience || "");
  const focusText = digest.reading_focus || "先看方法框架、主实验与局限性";

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
              <p class="front-tldr">${escapeHTML(digest.tldr || digest.verdict || "点击卡片查看详细分析")}</p>
            </div>
            <div class="knowledge-byline">
              <span class="author-avatar">${escapeHTML(authorInitials)}</span>
              <div><strong>${escapeHTML(authors)}</strong><span>${escapeHTML(venue)}</span></div>
            </div>
            <span class="match-pill">${numberOrZero(paper.match_score)}</span>
            <button class="flip-hint" type="button" data-bot-flip-btn aria-label="翻到详情"><i data-lucide="repeat"></i><span>轻点卡片查看要点</span></button>
          </header>
        </div>
        <div class="card-face card-back">
          <div class="card-scroll">
            <div class="back-topbar">
              <button class="flip-back-button" type="button" data-bot-flip-btn aria-label="返回一句话总结"><i data-lucide="arrow-left"></i><span>返回</span></button>
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
                <p class="insight-copy">${escapeHTML(digest.why_keep || digest.result || "与当前研究主题高度相关，适合进入下一轮精读。")}</p>
              </section>
              <div class="paper-meta">
                <span><i data-lucide="gauge"></i>Match ${numberOrZero(paper.match_score)}</span>
                <span><i data-lucide="clock-3"></i>${numberOrZero(paper.read_minutes)} min</span>
                <span><i data-lucide="quote"></i>${numberOrZero(paper.citation_count)} citations</span>
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
        <li><i data-lucide="target"></i><span><strong>阅读重点：</strong>${escapeHTML(focusText)}${needsReproduction ? "（建议动手复现）" : ""}</span></li>
        ${minutes ? `<li><i data-lucide="clock-3"></i><span><strong>所需时间：</strong>约 ${minutes} 分钟</span></li>` : ""}
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

async function refreshLibrary() {
  try {
    const response = await fetch("/api/library");
    const payload = await response.json();
    state.library = payload.papers || [];
    updateLibraryCounts();
    if (state.activeView === "library") renderLibrary();
  } catch (_) {
    // Preserve the current list when the local API is temporarily unavailable.
  }
}

function renderLibrary() {
  let entries = state.library.filter((entry) => entry.action === state.libraryFilter);
  if (state.libraryTags.length) {
    const selected = new Set(state.libraryTags);
    entries = entries.filter((entry) => deriveTags(entry.paper).some((tag) => selected.has(tag)));
  }
  if (state.librarySort === "citations") {
    entries = [...entries].sort((a, b) => numberOrZero(b.paper.citation_count) - numberOrZero(a.paper.citation_count));
  } else if (state.librarySort === "easy") {
    entries = [...entries].sort((a, b) => numberOrZero(a.paper.read_minutes) - numberOrZero(b.paper.read_minutes));
  }

  renderLibraryTags();
  if (!entries.length) {
    const labels = { save: "Interested", priority: "Key", read: "Read" };
    elements.libraryList.innerHTML = `<div class="library-empty"><i data-lucide="library"></i><h2>${labels[state.libraryFilter]} 还是空的</h2><p>回到 Explore，保留第一篇真正值得读的论文。</p></div>`;
    refreshIcons();
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
        <div class="library-card-title">${escapeHTML(paper.title)}</div>
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
    .filter((entry) => entry.action === state.libraryFilter)
    .forEach((entry) => deriveTags(entry.paper).forEach((tag) => {
      if (tag && !tags.includes(tag)) tags.push(tag);
    }));
  return tags;
}

function toggleLibrarySelectMode(forceValue) {
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
  if (state.librarySelected.has(id)) state.librarySelected.delete(id);
  else state.librarySelected.add(id);
  renderLibrary();
}

function visibleLibraryIds() {
  let entries = state.library.filter((entry) => entry.action === state.libraryFilter);
  if (state.libraryTags.length) {
    const selected = new Set(state.libraryTags);
    entries = entries.filter((entry) => deriveTags(entry.paper).some((tag) => selected.has(tag)));
  }
  return entries.map((entry) => entry.paper.id);
}

function selectAllLibraryVisible() {
  visibleLibraryIds().forEach((id) => state.librarySelected.add(id));
  renderLibrary();
}

function clearLibrarySelection() {
  state.librarySelected.clear();
  renderLibrary();
}

function updateLibraryExportBar() {
  if (!elements.libraryExportBar) return;
  elements.libraryExportBar.hidden = !state.librarySelectMode;
  if (elements.libraryExportCount) {
    elements.libraryExportCount.textContent = String(state.librarySelected.size);
  }
  const empty = state.librarySelected.size === 0;
  elements.libraryExportBar.querySelectorAll('[data-library-export-action="bibtex"], [data-library-export-action="zotero"]').forEach((btn) => {
    btn.disabled = empty;
  });
}

function bibtexEscape(text) {
  return String(text || "")
    .replace(/[{}\\]/g, (m) => `\\${m}`)
    .replace(/\s+/g, " ")
    .trim();
}

function bibtexCiteKey(paper) {
  const first = ((paper.authors || [])[0]?.name || "anon").split(/\s+/).pop() || "anon";
  const year = paper.year || "n.d.";
  const slug = (paper.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || "paper";
  return `${first.toLowerCase().replace(/[^a-z0-9]/g, "")}${year}${slug}`;
}

function paperToBibTeX(paper) {
  const type = /thesis|dissertation/i.test(paper.venue || "") ? "phdthesis"
    : /proceedings|conf|workshop|symposium/i.test(paper.venue || "") ? "inproceedings"
    : paper.venue ? "article"
    : "misc";
  const key = bibtexCiteKey(paper);
  const fields = [];
  const push = (k, v) => { if (v != null && String(v).trim() !== "") fields.push(`  ${k} = {${bibtexEscape(v)}}`); };
  push("title", paper.title);
  const authorList = (paper.authors || []).map((a) => a.name || a).filter(Boolean).join(" and ");
  push("author", authorList);
  push("year", paper.year);
  if (type === "inproceedings") push("booktitle", paper.venue);
  else push("journal", paper.venue);
  push("url", paper.url);
  push("doi", paper.doi);
  if (paper.digest?.tldr) push("abstract", paper.digest.tldr);
  const noteParts = [];
  if (paper.match_score != null) noteParts.push(`match=${paper.match_score}`);
  if (paper.read_minutes) noteParts.push(`read=${paper.read_minutes}min`);
  noteParts.push("via PaperSwipe");
  push("note", noteParts.join("; "));
  return `@${type}{${key},\n${fields.join(",\n")}\n}`;
}

function exportSelectedBibTeX() {
  const ids = [...state.librarySelected];
  if (!ids.length) { showToast("请先选中至少一篇论文"); return; }
  const papers = state.library
    .filter((entry) => ids.includes(entry.paper.id))
    .map((entry) => entry.paper);
  const usedKeys = new Map();
  const body = papers.map((paper) => {
    const bib = paperToBibTeX(paper);
    return bib.replace(/@(\w+)\{([^,]+),/, (match, type, key) => {
      const n = (usedKeys.get(key) || 0) + 1;
      usedKeys.set(key, n);
      return `@${type}{${n > 1 ? `${key}${n}` : key},`;
    });
  }).join("\n\n");
  const header = `% Exported from PaperSwipe · ${new Date().toISOString().slice(0, 10)}\n% ${papers.length} paper${papers.length > 1 ? "s" : ""}\n\n`;
  const blob = new Blob([header + body + "\n"], { type: "application/x-bibtex;charset=utf-8" });
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

const ZOTERO_STORAGE_KEY = "paperswipe_zotero_v1";
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
  try {
    const res = await fetch(`${ZOTERO_API_BASE}/users/${encodeURIComponent(userId)}/items?limit=1&format=json`, {
      headers: { "Zotero-API-Key": apiKey, "Zotero-API-Version": "3" },
    });
    if (res.status === 403 || res.status === 401) { setZoteroStatus("鉴权失败：请检查 API Key 是否有写入权限，以及 userID 是否正确。", "warn"); return; }
    if (!res.ok) { setZoteroStatus(`连接失败：HTTP ${res.status}`, "warn"); return; }
    const total = res.headers.get("Total-Results") || "?";
    setZoteroStatus(`✓ 已连接。你的 library 当前有 ${total} 条 items。`, "ok");
  } catch (err) {
    setZoteroStatus(`连接失败：${err.message || err}`, "warn");
  }
}

function paperToZoteroItem(paper) {
  const venue = paper.venue || "";
  const isConf = /proceedings|conf|workshop|symposium/i.test(venue);
  const isThesis = /thesis|dissertation/i.test(venue);
  const isPreprint = /arxiv|preprint|biorxiv|medrxiv/i.test(venue);
  const itemType = isThesis ? "thesis" : isConf ? "conferencePaper" : isPreprint ? "preprint" : venue ? "journalArticle" : "document";
  const creators = (paper.authors || []).map((a) => {
    const name = a.name || a || "";
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return { creatorType: "author", lastName: name, firstName: "" };
    return { creatorType: "author", firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
  });
  const tags = (typeof deriveTags === "function" ? deriveTags(paper) : []).slice(0, 12).map((tag) => ({ tag }));
  const item = {
    itemType,
    title: paper.title || "",
    creators,
    date: paper.year ? String(paper.year) : "",
    url: paper.url || paper.pdf_url || "",
    abstractNote: paper.digest?.tldr || paper.abstract || "",
    tags,
    extra: [
      paper.doi ? `DOI: ${paper.doi}` : "",
      paper.match_score != null ? `PaperSwipe match: ${paper.match_score}` : "",
      paper.read_minutes ? `PaperSwipe read: ${paper.read_minutes} min` : "",
      "via PaperSwipe",
    ].filter(Boolean).join("\n"),
  };
  if (itemType === "journalArticle") item.publicationTitle = venue;
  else if (itemType === "conferencePaper") item.proceedingsTitle = venue;
  else if (itemType === "thesis") item.university = venue;
  else if (itemType === "preprint") item.repository = venue;
  if (paper.doi) item.DOI = paper.doi;
  return item;
}

async function exportSelectedToZotero() {
  const ids = [...state.librarySelected];
  if (!ids.length) { showToast("请先选中至少一篇论文"); return; }
  const { apiKey, userId } = loadZoteroCredentials();
  if (!apiKey || !userId) {
    showToast("请先在 Settings → Zotero 里填 API Key 和 userID");
    openSettingsPage();
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
      const batch = papers.slice(i, i + 50).map(paperToZoteroItem);
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
  const tags = collectLibraryTags();
  if (!tags.length) {
    elements.libraryTags.innerHTML = "";
    return;
  }
  elements.libraryTags.innerHTML = tags.map((tag) => {
    const active = state.libraryTags.includes(tag);
    return `<button type="button" class="library-tag${active ? " is-active" : ""}" data-library-tag="${escapeAttribute(tag)}" aria-pressed="${active}">${escapeHTML(tag)}</button>`;
  }).join("");
}

async function removeFromLibrary(id) {
  const entry = state.library.find((item) => item.paper.id === id);
  if (!entry) return;
  try {
    const response = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paper: entry.paper, action: "dismiss" }),
    });
    if (!response.ok) throw new Error("移除失败");
    showToast("已移出 Library");
    await Promise.all([refreshLibrary(), refreshStats()]);
  } catch (error) {
    showToast(error.message);
  }
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
    const hasItems = items.length > 0;
    elements.recentSearches.innerHTML = items.slice(0, 8).map((item) => `<button type="button" data-query="${escapeAttribute(item.query)}">${escapeHTML(item.query)}</button>`).join("");
    if (elements.clearSearches) elements.clearSearches.hidden = !hasItems;
  } catch (_) {
    elements.recentSearches.innerHTML = "";
    if (elements.clearSearches) elements.clearSearches.hidden = true;
  }
}

function switchView(view) {
  const validViews = ["discover", "library", "network", "profile"];
  state.activeView = validViews.includes(view) ? view : "discover";
  closeAiBotPage();
  closeSettingsPage();
  const views = {
    discover: elements.discoverView,
    library: elements.libraryView,
    network: elements.networkView,
    profile: elements.profileView,
  };
  Object.entries(views).forEach(([name, panel]) => {
    const active = name === state.activeView;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
  document.querySelectorAll(".bottom-nav [data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === state.activeView));
  elements.searchPanel.hidden = true;
  elements.searchPanel.classList.remove("is-closing");
  elements.searchToggle.classList.remove("is-search-open");
  if (state.activeView === "library") refreshLibrary();
  if (state.activeView === "network") { renderFriends(); renderForumPosts(); }
  if (state.activeView === "profile") renderProfile();
}

function switchNetworkTab(tab) {
  state.networkTab = tab;
  document.querySelectorAll("[data-network-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.networkTab === state.networkTab));

  const fab = elements.composeFab;

  if (tab === "friends") {
    if (elements.networkFriends) elements.networkFriends.hidden = false;
    if (elements.networkForum) elements.networkForum.hidden = true;
    if (fab) fab.hidden = true;
    renderFriends();
  } else {
    // forum
    if (elements.networkFriends) elements.networkFriends.hidden = true;
    if (elements.networkForum) elements.networkForum.hidden = false;
    if (fab) fab.hidden = false;
    renderForumPosts();
  }

  if (elements.networkScroll) elements.networkScroll.scrollTop = 0;
}

let forumActiveType = "qa";

function switchForumType(type) {
  forumActiveType = type;
  document.querySelectorAll("[data-forum-type]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.forumType === type);
  });
  renderForumPosts();
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

function renderPeople() {
  const people = [
    { id: "maya", initials: "MG", name: "Maya Garcia", role: "Postdoc", topic: "Deep RL in robotics" },
    { id: "chen", initials: "JC", name: "J. Chen", role: "PhD", topic: "Explainable AI agents" },
    { id: "alex", initials: "AL", name: "Alex Lin", role: "Researcher", topic: "Multimodal computer vision" },
  ];
  elements.peopleList.innerHTML = people.map((person) => {
    const connected = state.connectedPeople.has(person.id);
    return `<article class="person-item">
      <span class="person-avatar">${person.initials}</span>
      <div class="person-info"><strong>${escapeHTML(person.name)} <small>${escapeHTML(person.role)}</small></strong><span>${escapeHTML(person.topic)}</span></div>
      <button class="connect-button${connected ? " is-connected" : ""}" type="button" data-connect-person="${person.id}">${connected ? "Connected" : "Connect"}</button>
      <button class="chat-button" type="button" data-chat-person="${escapeAttribute(person.name)}" aria-label="与 ${escapeAttribute(person.name)} 对话" title="Chat"><i data-lucide="message-circle"></i></button>
    </article>`;
  }).join("");
  document.querySelector("#connection-count").textContent = String(3 + state.connectedPeople.size);
  const topics = onboardingProfile.topics.slice(0, 2).join(" and ") || "AI agents";
  document.querySelector("#network-overlap").textContent = `Your interests overlap most with ${topics}.`;
  refreshIcons();
}

function toggleConnection(button) {
  const id = button.dataset.connectPerson;
  if (state.connectedPeople.has(id)) state.connectedPeople.delete(id);
  else state.connectedPeople.add(id);
  renderPeople();
  showToast(state.connectedPeople.has(id) ? "已建立研究连接" : "已取消连接");
}

/* ── Friends list ── */
const FRIENDS_DATA = [
  { id: "sandra", initials: "SW", name: "Sandra Wei", role: "Ph.D. Candidate · Stanford · HCI + LLMs", mutual: "你和 Sandra 都在关注 AI Agents 和 HCI", state: "none", avatar: "fa1" },
  { id: "kobayashi", initials: "TK", name: "T. Kobayashi", role: "Associate Prof. · UTokyo · NLP & Knowledge Graphs", mutual: "共同好友: J. Chen · Maya Garcia", state: "following", avatar: "fa2" },
  { id: "lina", initials: "LN", name: "Li Na", role: "Research Scientist · DeepMind · RL & Agents", mutual: "你和 Li Na 在 8 个话题上有交集", state: "mutual", avatar: "fa3" },
  { id: "david", initials: "DP", name: "David P.", role: "ML Engineer · OpenAI · Safety & Alignment", mutual: "", state: "none", avatar: "fa4" },
  { id: "yuki", initials: "YR", name: "Yuki R.", role: "Master's Student · ETH · Computer Vision", mutual: "", state: "none", avatar: "fa5" },
];

function renderFriends() {
  if (!elements.friendsList) return;
  elements.friendsList.innerHTML = FRIENDS_DATA.map((friend) => `
    <article class="friend-card">
      <span class="friend-avatar ${friend.avatar}">${friend.initials}</span>
      <div class="friend-info">
        <strong>${escapeHTML(friend.name)}</strong>
        <span>${escapeHTML(friend.role)}</span>
        ${friend.mutual ? `<div class="mutual">🔗 ${escapeHTML(friend.mutual)}</div>` : ""}
      </div>
      <button class="follow-btn ${friend.state === "mutual" ? "is-mutual" : friend.state === "following" ? "is-following" : ""}" type="button" data-follow-id="${friend.id}">${friend.state === "mutual" ? "Mutual" : friend.state === "following" ? "Following" : "Follow"}</button>
    </article>
  `).join("");

  elements.friendsList.querySelectorAll("[data-follow-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFriendFollow(btn);
    });
  });
}

function toggleFriendFollow(btn) {
  const id = btn.dataset.followId;
  const friend = FRIENDS_DATA.find((f) => f.id === id);
  if (!friend) return;

  if (friend.state === "mutual") {
    friend.state = "following";
    btn.classList.remove("is-mutual");
    btn.classList.add("is-following");
    btn.textContent = "Following";
    showToast("已取消互相关注");
  } else if (friend.state === "following") {
    friend.state = "none";
    btn.classList.remove("is-following");
    btn.textContent = "Follow";
    showToast("已取消关注");
  } else {
    friend.state = "following";
    btn.classList.add("is-following");
    btn.textContent = "Following";
    showToast("✅ 已关注");
  }
}

/* ── Forum posts ── */
const FORUM_POSTS = {
  qa: [
    {
      type: "qa", resolved: false, avatar: "av1", initials: "RL", name: "Ryan L.", meta: "Ph.D. Student · 3 小时前",
      title: "怎么处理 LLM Agent 在 multi-turn tool use 时的 context 膨胀问题？",
      body: "我的 agent 在调用 5+ 轮工具后 context window 就快炸了。目前试过 sliding window truncation 但会丢关键信息。有没有更优雅的方案？特别是有没有 paper 讨论过 selective context compression for tool-calling agents?",
      tags: [{ label: "LLM Agents", cls: "purple" }, { label: "Context Management", cls: "green" }, { label: "Tool Use", cls: "amber" }],
      stats: [{ label: "12 回复", icon: "message-circle" }, { label: "引用 1 篇论文", icon: "file-text" }],
    },
    {
      type: "qa", resolved: true, avatar: "av2", initials: "MG", name: "Maya Garcia", meta: "Postdoc · 昨天",
      title: "Evaluation protocol for long-form text generation — 除了 ROUGE/BLEU 还有什么？",
      body: "在做一个 narrative generation 项目，传统自动指标完全不够用。想请教大家有没有好的 human eval protocol 或者更 semantic 的自动指标推荐？",
      ref: { title: "G-Eval: NLG Evaluation using GPT-4", meta: "Liu et al., EMNLP 2023 · 来自我的收藏" },
      tags: [],
      stats: [{ label: "已解决", icon: "check", cls: "resolved" }, { label: "18 回复", icon: "message-circle" }],
    },
  ],
  discuss: [
    {
      type: "discuss", avatar: "av3", initials: "AL", name: "Alex Lin", meta: "Researcher · 5 小时前",
      title: "多模态大模型真的「理解」了视觉吗，还是只是在做 pattern matching？",
      body: "最近读了 GPT-4V 和 LLaVA 几篇论文的系统评测，发现很多所谓的 'visual reasoning' 其实可以被纯文本 + OCR 替代。这是不是说明当前的 vision-language alignment 还停留在很浅的层面？",
      ref: { title: "Eyes Wide Shut? Exploring the Visual Shortcomings of Multimodal LLMs", meta: "Tong et al., CVPR 2024" },
      tags: [{ label: "Vision-Language", cls: "purple" }, { label: "Critical Analysis", cls: "amber" }],
      stats: [{ label: "引用 1 篇论文", icon: "file-text" }, { label: "34 讨论", icon: "message-circle" }, { label: "89", icon: "heart" }],
    },
    {
      type: "discuss", avatar: "av1", initials: "ZH", name: "Zhiwei H.", meta: "ML Engineer · 昨天",
      title: "Open-source LLMs are closing the gap faster than expected — time to rethink proprietary API dependencies?",
      body: "从 Llama 3 到 DeepSeek-V3，开源模型的进步速度比我预想的快太多了。我们团队正在认真考虑把部分 pipeline 从 GPT-4 迁移到自部署模型。大家怎么看？主要是 latency 和 reliability 的 tradeoff。",
      tags: [],
      stats: [{ label: "56 讨论", icon: "message-circle" }, { label: "142", icon: "heart" }],
    },
  ],
  rec: [
    {
      type: "rec", avatar: "av2", initials: "R4", name: "精选读者 #42", meta: "速递 · 30 分钟前",
      title: "本周最值得读的 Agent 安全论文",
      body: "社区投票选出本周最值得关注的 3 篇 Agent Safety 论文，滑动投票 ↓",
      tags: [],
      stats: [],
      swipeCards: [
        { bg: "linear-gradient(135deg,#2d1b69 0%,#4b2d9e 55%,#7c54d0 100%)", badge: "NeurIPS 2024", title: "R-Judge: Benchmarking Safety Risk Awareness for LLM Agents", sub: "Yuan et al. · 评估 LLM Agent 在风险场景中的安全判断能力" },
        { bg: "linear-gradient(135deg,#0d3d3a 0%,#14776e 55%,#2aada0 100%)", badge: "arXiv 2025", title: "AgentPoison: Red-teaming LLM Agents via Memory Poisoning", sub: "Chen et al. · 通过污染 agent 记忆来实现红队攻击的新方法" },
      ],
    },
  ],
};

function renderForumPosts() {
  if (!elements.forumPosts) return;
  const type = forumActiveType;
  const posts = FORUM_POSTS[type] || [];

  elements.forumPosts.innerHTML = posts.map((post, pi) => {
    let html = `<article class="forum-post" data-post-index="${pi}">
      <div class="forum-post-header">
        <span class="forum-post-avatar ${post.avatar}">${post.initials}</span>
        <div class="forum-post-meta"><strong>${escapeHTML(post.name)}</strong><span>${escapeHTML(post.meta)}</span></div>
        <span class="forum-post-type-tag ${post.type}${post.resolved ? " resolved" : ""}">${post.type === "qa" ? (post.resolved ? "已解决" : "Q&A") : post.type === "discuss" ? "观点" : "速递"}</span>
      </div>
      <div class="forum-post-title">${escapeHTML(post.title)}</div>
      ${post.body ? `<div class="forum-post-body">${escapeHTML(post.body)}</div>` : ""}`;

    if (post.ref) {
      html += `<div class="forum-post-ref" data-ref-click>
        <span class="ref-icon"><i data-lucide="file-text"></i></span>
        <div><strong>${escapeHTML(post.ref.title)}</strong><br><span>${escapeHTML(post.ref.meta)}</span></div>
      </div>`;
    }

    if (post.tags && post.tags.length) {
      html += `<div class="forum-post-tags">${post.tags.map((t) => `<span class="forum-tag-chip ${t.cls}">${escapeHTML(t.label)}</span>`).join("")}</div>`;
    }

    if (post.stats && post.stats.length) {
      html += `<div class="forum-post-stats">${post.stats.map((s, si) => `<span class="${s.cls || ""}" data-stat-index="${si}"><i data-lucide="${s.icon}"></i> ${escapeHTML(s.label)}</span>`).join("")}</div>`;
    }

    html += `</article>`;

    // Swipe cards for rec type
    if (post.swipeCards && post.swipeCards.length) {
      post.swipeCards.forEach((card) => {
        html += `
        <div class="swipe-card" style="background:${card.bg}">
          <div class="swipe-card-inner">
            <span class="swipe-card-badge">${escapeHTML(card.badge)}</span>
            <div class="swipe-card-title">${escapeHTML(card.title)}</div>
            <div class="swipe-card-sub">${escapeHTML(card.sub)}</div>
          </div>
        </div>
        <div class="swipe-actions">
          <button class="swipe-pass" type="button" data-swipe-action="pass">✕</button>
          <button class="swipe-like" type="button" data-swipe-action="like">♥</button>
        </div>`;
      });
    }

    return html;
  }).join("");

  // Bind: click post → open detail
  elements.forumPosts.querySelectorAll(".forum-post").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-ref-click]")) return;
      if (e.target.closest("[data-swipe-action]")) return;
      if (e.target.closest(".forum-post-stats span")) return;
      openForumDetail(forumActiveType, parseInt(el.dataset.postIndex));
    });
  });

  // Bind: click paper ref → show paper info
  elements.forumPosts.querySelectorAll("[data-ref-click]").forEach((ref) => {
    ref.addEventListener("click", (e) => {
      e.stopPropagation();
      const title = ref.querySelector("strong")?.textContent || "";
      const meta = ref.querySelector("span")?.textContent || "";
      showToast(`📄 ${title} — ${meta}`);
    });
  });

  // Bind swipe actions
  elements.forumPosts.querySelectorAll("[data-swipe-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      showToast(btn.dataset.swipeAction === "like" ? "👍 推荐 +1" : "🙅 已跳过");
    });
  });

  // Bind stat clicks — different behavior per icon type
  elements.forumPosts.querySelectorAll(".forum-post-stats span").forEach((span) => {
    span.addEventListener("click", (e) => {
      e.stopPropagation();
      const iconEl = span.querySelector("svg");
      // Detect icon type from lucide icon class
      const isHeart = iconEl && iconEl.classList.contains("lucide-heart");
      const isMessage = iconEl && iconEl.classList.contains("lucide-message-circle");
      const isFile = iconEl && iconEl.classList.contains("lucide-file-text");

      if (isHeart) {
        span.classList.toggle("liked");
        showToast(span.classList.contains("liked") ? "❤️ 已点赞" : "已取消点赞");
      } else if (isMessage) {
        // Open detail dialog to show replies
        const postIdx = span.closest(".forum-post")?.dataset?.postIndex;
        if (postIdx != null) openForumDetail(forumActiveType, parseInt(postIdx));
      } else if (isFile) {
        const refEl = span.closest(".forum-post")?.querySelector(".forum-post-ref");
        const refTitle = refEl?.querySelector("strong")?.textContent || "论文";
        const refMeta = refEl?.querySelector("span")?.textContent || "";
        showRefCardDialog(refTitle, refMeta);
      }
      // "已解决" check icon — no action
    });
  });

  refreshIcons();
}

/* ── Forum post detail ── */
const FAKE_REPLIES = {
  qa: [
    [
      { initials: "KW", name: "Kai W.", role: "ML Researcher · 2 小时前", body: "建议看看 MemGPT 的 paper，他们对 context 管理有一套很优雅的方案。核心思路是把 context 当作操作系统里的 virtual memory 来管理。", avatar: "ra1" },
      { initials: "RL", name: "Ryan L. (楼主)", role: "Ph.D. Student", body: "@Kai W. 谢谢！MemGPT 的思路确实有意思，但他们的实现依赖 function calling，我在想要不要试一个更轻量的方案。", avatar: "ra2" },
      { initials: "YC", name: "Y. Chen", role: "Postdoc · 1 小时前", body: "最近有篇新的 arXiv paper 叫 LongAgent，用 hierarchical summary + retrieval 的方式来处理长 context，实测效果比 sliding window 好很多。", avatar: "ra4" },
    ],
    [
      { initials: "DP", name: "David P.", role: "ML Engineer · 昨天", body: "我觉得 G-Eval 是目前最靠谱的方案，GPT-4 作为 evaluator 和人类判断的相关性非常高。不过要注意 prompt 的设计，他们论文里有详细的 ablation。", avatar: "ra3" },
      { initials: "MG", name: "Maya Garcia (楼主)", role: "Postdoc", body: "@David P. 确实，我们已经开始用 G-Eval 了。另外我们也试了 UniEval，多维度评估比单一分数有用很多。", avatar: "ra2" },
    ],
  ],
  discuss: [
    [
      { initials: "ZH", name: "Zhiwei H.", role: "ML Engineer · 4 小时前", body: "我觉得现在的 VLM 确实主要是 pattern matching。真正的 visual reasoning 需要 spatial understanding 和 causal reasoning，这两块目前都没解决。", avatar: "ra1" },
      { initials: "SW", name: "Sandra Wei", role: "Ph.D. Candidate", body: "我不同意'只是 pattern matching'这个说法。最近一些工作显示 VLM 确实能做一些零样本的空间推理，只是还不够稳健。问题在于 benchmark 太简单了。", avatar: "ra4" },
      { initials: "AL", name: "Alex Lin (楼主)", role: "Researcher", body: "@Sandra Wei 你说得对，benchmark 是个大问题。我们需要更多像 VSR 和 SpatialRAG 这样的硬测试来区分真正的理解和表面匹配。", avatar: "ra3" },
      { initials: "TK", name: "T. Kobayashi", role: "Associate Prof.", body: "推荐一篇 CVPR 2024 的 oral：他们用 counterfactual image editing 来测试 VLM 是否真的'看见'了物体之间的关系。相当有说服力。", avatar: "ra2" },
    ],
    [
      { initials: "LN", name: "Li Na", role: "Research Scientist · 12 小时前", body: "我们团队刚做完迁移评估。结论是：自部署模型在 latency 上确实不如 GPT-4，但如果用 vLLM + AWQ 量化，差距已经缩小到可接受范围。reliability 方面没有明显差异。", avatar: "ra1" },
      { initials: "DP", name: "David P.", role: "ML Engineer · 10 小时前", body: "成本才是决定性因素。我们跑了一个月的数据，自部署方案的总成本只有 API 调用的 1/4。而且数据不用离开自己的 infra，合规方面也更放心。", avatar: "ra3" },
    ],
  ],
  rec: [
    [
      { initials: "JC", name: "J. Chen", role: "PhD · 25 分钟前", body: "R-Judge 这个 benchmark 太及时了。我们在做 agent safety 相关的工作，正好缺一个系统性的评估框架。已加入 reading list！", avatar: "ra2" },
      { initials: "YR", name: "Yuki R.", role: "Master's Student · 18 分钟前", body: "AgentPoison 的方法让我有点担忧——如果记忆投毒这么容易，那 RAG-based agent 的安全假设就需要重新审视了。期待后续的 defense 工作。", avatar: "ra4" },
    ],
  ],
};

function openForumDetail(type, index) {
  const dialog = document.querySelector("#forum-detail-dialog");
  const body = document.querySelector("#forum-detail-body");
  const typeLabel = document.querySelector("#forum-detail-type");
  if (!dialog || !body) return;

  const posts = FORUM_POSTS[type] || [];
  const post = posts[index];
  if (!post) return;

  const typeLabels = { qa: "Q&A 求助", discuss: "观点讨论", rec: "论文速递" };
  if (typeLabel) typeLabel.textContent = typeLabels[type] || "帖子详情";

  let html = `<div class="forum-detail-full-post">
    <article class="forum-post">
      <div class="forum-post-header">
        <span class="forum-post-avatar ${post.avatar}">${post.initials}</span>
        <div class="forum-post-meta"><strong>${escapeHTML(post.name)}</strong><span>${escapeHTML(post.meta)}</span></div>
        <span class="forum-post-type-tag ${post.type}${post.resolved ? " resolved" : ""}">${post.type === "qa" ? (post.resolved ? "已解决" : "Q&A") : post.type === "discuss" ? "观点" : "速递"}</span>
      </div>
      <div class="forum-post-title">${escapeHTML(post.title)}</div>
      <div class="forum-post-body">${escapeHTML(post.body || "")}</div>`;

  if (post.ref) {
    html += `<div class="forum-post-ref" data-ref-detail-click>
      <span class="ref-icon"><i data-lucide="file-text"></i></span>
      <div><strong>${escapeHTML(post.ref.title)}</strong><br><span>${escapeHTML(post.ref.meta)}</span></div>
    </div>`;
  }

  if (post.tags && post.tags.length) {
    html += `<div class="forum-post-tags">${post.tags.map((t) => `<span class="forum-tag-chip ${t.cls}">${escapeHTML(t.label)}</span>`).join("")}</div>`;
  }

  html += `</article></div>`;

  // Replies
  const replies = (FAKE_REPLIES[type] && FAKE_REPLIES[type][index]) ? FAKE_REPLIES[type][index] : [];
  html += `<div class="forum-detail-replies">
    <h3><i data-lucide="messages-square"></i> ${replies.length} 条回复 <small>假数据演示</small></h3>`;
  replies.forEach((r) => {
    html += `<div class="forum-reply-item">
      <div class="forum-reply-header">
        <span class="forum-reply-avatar ${r.avatar}">${r.initials}</span>
        <div class="forum-reply-meta"><strong>${escapeHTML(r.name)}</strong><span>${escapeHTML(r.role)}</span></div>
      </div>
      <p class="forum-reply-body">${escapeHTML(r.body)}</p>
      <div class="forum-reply-actions">
        <button type="button" data-reply-like><i data-lucide="heart"></i> 赞</button>
        <button type="button" data-reply-reply><i data-lucide="corner-up-left"></i> 回复</button>
      </div>
    </div>`;
  });
  html += `</div>`;

  body.innerHTML = html;
  refreshIcons();

  // Bind reply action buttons
  body.querySelectorAll("[data-reply-like]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("liked");
      showToast(btn.classList.contains("liked") ? "❤️ 已点赞" : "已取消点赞");
    });
  });
  body.querySelectorAll("[data-reply-reply]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const replyInput = document.querySelector("#forum-reply-input");
      if (replyInput) replyInput.focus();
    });
  });

  // Paper ref click → show floating card dialog
  body.querySelectorAll("[data-ref-detail-click]").forEach((ref) => {
    ref.addEventListener("click", (e) => {
      e.stopPropagation();
      const title = ref.querySelector("strong")?.textContent || "";
      const meta = ref.querySelector("span")?.textContent || "";
      showRefCardDialog(title, meta);
    });
  });

  dialog.showModal();
}

// Ensure forum detail dialog can be closed via backdrop click
const forumDetailDialog = document.querySelector("#forum-detail-dialog");
if (forumDetailDialog) {
  forumDetailDialog.addEventListener("click", (e) => {
    // Close only when clicking the backdrop (dialog itself), not its children
    if (e.target === forumDetailDialog) {
      forumDetailDialog.close();
    }
  });
  // Also handle Escape key properly
  forumDetailDialog.addEventListener("cancel", (e) => {
    // default behavior closes, just ensure it works
    const input = document.querySelector("#forum-reply-input");
    if (input) input.value = "";
  });
}

// Bind reply form submit
const replyForm = document.querySelector("#forum-detail-reply-form");
const replyInput = document.querySelector("#forum-reply-input");
if (replyForm && replyInput) {
  replyForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = replyInput.value.trim();
    if (!text) return;
    showToast("✅ 回复已发布（假数据演示）");
    replyInput.value = "";
  });
}

/* ── Compose modal ── */
let composeTypeState = "qa";

function openCompose() {
  if (!elements.composeDialog) return;
  document.querySelectorAll("[data-compose-type]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.composeType === composeTypeState);
  });
  elements.composeDialog.showModal();
  setTimeout(() => elements.composeTitle && elements.composeTitle.focus(), 80);
}

function submitComposePost() {
  const title = (elements.composeTitle?.value || "").trim();
  const body = (elements.composeBody?.value || "").trim();
  if (!title) { showToast("请填写帖子标题"); return; }
  if (!body) { showToast("请填写帖子内容"); return; }

  const type = composeTypeState;
  const avatars = { qa: "av1", discuss: "av3", rec: "av2" };
  const initials = { qa: "ME", discuss: "ME", rec: "ME" };

  const newPost = {
    type, resolved: false,
    avatar: avatars[type] || "av1",
    initials: initials[type] || "ME",
    name: "我 (PaperSwipe Researcher)",
    meta: "刚刚发布",
    title, body,
    tags: [],
    stats: [{ label: "0 回复", icon: "message-circle" }, { label: "0", icon: "heart" }],
  };

  if (!FORUM_POSTS[type]) FORUM_POSTS[type] = [];
  FORUM_POSTS[type].unshift(newPost);

  const labels = { qa: "Q&A 求助", discuss: "观点讨论", rec: "论文速递" };
  showToast(`✅ 已发布为「${labels[type] || "帖子"}」（假数据）`);
  closeCompose();
  renderForumPosts();
}

function closeCompose() {
  if (elements.composeDialog) elements.composeDialog.close();
  if (elements.composeTitle) elements.composeTitle.value = "";
  if (elements.composeBody) elements.composeBody.value = "";
}

/* ── Paper ref card dialog ── */
function showRefCardDialog(title, meta) {
  const dialog = document.querySelector("#ref-card-dialog");
  const body = document.querySelector("#ref-card-body");
  if (!dialog || !body) return;

  body.innerHTML = `
    <h4>${escapeHTML(title)}</h4>
    <p class="ref-card-meta">${escapeHTML(meta)}</p>
    <p class="ref-card-abstract">这篇论文来自发帖者的 Library 收藏（假数据演示）。摘要内容将在接入 Semantic Scholar API 后实时获取。当前展示的是社区成员基于论文内容撰写的推荐理由和关键贡献总结。</p>
    <div class="ref-card-tags">
      <span>Agent Safety</span>
      <span>Benchmark</span>
      <span>LLM Evaluation</span>
    </div>
    <div class="ref-card-links">
      <button class="ref-card-link" type="button" onclick="window.open('https://arxiv.org','_blank')"><i data-lucide="external-link"></i> arXiv</button>
      <button class="ref-card-link" type="button" onclick="window.open('https://scholar.google.com','_blank')"><i data-lucide="search"></i> Google Scholar</button>
      <button class="ref-card-link" type="button" data-close-dialog="ref-card-dialog"><i data-lucide="library"></i> 加入 Library</button>
    </div>`;
  refreshIcons();
  dialog.showModal();
}

/* ── Paper ref picker ── */
const FAKE_LIBRARY_PAPERS = [
  { title: "MemGPT: Towards LLMs as Operating Systems", venue: "arXiv 2023", authors: "Packer et al." },
  { title: "G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment", venue: "EMNLP 2023", authors: "Liu et al." },
  { title: "Eyes Wide Shut? Exploring the Visual Shortcomings of Multimodal LLMs", venue: "CVPR 2024", authors: "Tong et al." },
  { title: "R-Judge: Benchmarking Safety Risk Awareness for LLM Agents", venue: "NeurIPS 2024", authors: "Yuan et al." },
  { title: "AgentPoison: Red-teaming LLM Agents via Memory Poisoning", venue: "arXiv 2025", authors: "Chen et al." },
];

function openRefPicker() {
  const dialog = document.querySelector("#ref-picker-dialog");
  const list = document.querySelector("#ref-picker-list");
  if (!dialog || !list) return;

  list.innerHTML = FAKE_LIBRARY_PAPERS.map((p, i) => `
    <div class="ref-picker-item" data-ref-pick="${i}">
      <span class="rp-icon"><i data-lucide="file-text"></i></span>
      <div class="rp-info"><strong>${escapeHTML(p.title)}</strong><span>${escapeHTML(p.authors)} · ${escapeHTML(p.venue)}</span></div>
    </div>
  `).join("");

  list.querySelectorAll(".ref-picker-item").forEach((item) => {
    item.addEventListener("click", () => {
      item.classList.toggle("is-selected");
      const paper = FAKE_LIBRARY_PAPERS[parseInt(item.dataset.refPick)];
      showToast(item.classList.contains("is-selected")
        ? `📎 已引用：${paper.title.slice(0, 40)}…`
        : `已取消引用`);
    });
  });

  refreshIcons();
  dialog.showModal();
}

function renderSettings() {
  const identities = { graduate: "Graduate / PhD", researcher: "Professor / Researcher", enthusiast: "Explorer" };
  const styleLabel = onboardingProfile.discoveryStyle === "broaden" ? "Broaden discovery" : "Focused discovery";
  elements.settingsTopicChips.innerHTML = onboardingProfile.topics.map((topic) => `<button type="button" data-settings-topic-remove="${escapeAttribute(topic)}"><span>${escapeHTML(topic)}</span><i data-lucide="x"></i></button>`).join("");
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
  updateComplexityLabel(elements.settingsComplexityLabel, onboardingProfile.complexity);
  refreshIcons();
}

const TODO_STORAGE_KEY = "paperswipe_todos";
const TODO_SCOPES = ["day", "week", "month"];

function loadTodos() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(TODO_STORAGE_KEY));
    if (!Array.isArray(saved)) return null;
    return saved.filter((item) => item && typeof item.text === "string");
  } catch (_) {
    return null;
  }
}

function persistTodos() {
  window.localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(state.todos));
}

function defaultTodos() {
  return [
    { id: "t1", text: "Deep-read MemGPT hierarchical memory management", done: false, scope: "day" },
    { id: "t2", text: "Organize RAG evaluation benchmark notes", done: false, scope: "week" },
    { id: "t3", text: "Track this week's new Memory Agent papers", done: false, scope: "week" },
    { id: "t4", text: "Finish the long-term memory survey monthly report", done: false, scope: "month" },
  ];
}

function scopeLabel(scope) {
  return scope === "day" ? "Today" : scope === "week" ? "This week" : "This month";
}

function renderProfile() {
  const identities = { graduate: "Graduate / PhD", researcher: "Professor / Researcher", enthusiast: "Explorer" };
  const styleLabel = onboardingProfile.discoveryStyle === "broaden" ? "Broaden discovery" : "Focused discovery";
  if (elements.profileIdentity) elements.profileIdentity.textContent = `${identities[onboardingProfile.identity] || "研究者"} · ${styleLabel}`;
  renderTodos();
  refreshIcons();
}

function renderTodos() {
  const scope = state.todoScope || "day";
  document.querySelectorAll("[data-todo-scope]").forEach((button) => {
    const active = button.dataset.todoScope === scope;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", String(active));
  });
  const items = state.todos.filter((item) => item.scope === scope);
  if (!items.length) {
    elements.todoList.innerHTML = `<li class="todo-empty">${scopeLabel(scope)}暂无阅读任务，添加一项吧。</li>`;
    return;
  }
  elements.todoList.innerHTML = items.map((item) => `
    <li class="todo-item${item.done ? " is-done" : ""}" data-todo-id="${escapeAttribute(item.id)}">
      <button class="todo-check" type="button" data-todo-toggle="${escapeAttribute(item.id)}" aria-label="${item.done ? "标记为未完成" : "标记为完成"}" title="完成">
        <i data-lucide="${item.done ? "check" : "circle"}"></i>
      </button>
      <span class="todo-text">${escapeHTML(item.text)}</span>
      <button class="todo-remove" type="button" data-todo-remove="${escapeAttribute(item.id)}" aria-label="删除任务" title="删除"><i data-lucide="x"></i></button>
    </li>`).join("");
}

function addTodo(text) {
  const scope = state.todoScope || "day";
  state.todos.unshift({ id: `t${Date.now()}`, text: text.trim(), done: false, scope });
  persistTodos();
  renderTodos();
}

function toggleTodo(id) {
  const item = state.todos.find((entry) => entry.id === id);
  if (!item) return;
  item.done = !item.done;
  persistTodos();
  renderTodos();
}

function removeTodo(id) {
  state.todos = state.todos.filter((entry) => entry.id !== id);
  persistTodos();
  renderTodos();
}

function switchTodoScope(scope) {
  if (!TODO_SCOPES.includes(scope)) return;
  state.todoScope = scope;
  renderTodos();
}

function openSettingsPage() {
  if (!elements.settingsPage) return;
  renderSettings();
  elements.settingsPage.hidden = false;
  document.body.classList.add("is-settings-open");
  refreshIcons();
}

function closeSettingsPage() {
  if (!elements.settingsPage) return;
  elements.settingsPage.hidden = true;
  document.body.classList.remove("is-settings-open");
}

function removeSettingsTopic(topic) {
  if (onboardingProfile.topics.length === 1) {
    showToast("至少保留一个研究主题");
    return;
  }
  onboardingProfile.topics = onboardingProfile.topics.filter((item) => item !== topic);
  onboardingProfile.searchQuery = onboardingProfile.topics.join(" ");
  persistProfile();
  renderSettings();
}

function saveSettingsTopics() {
  const customTopic = elements.settingsTopicInput.value.trim();
  if (customTopic && !onboardingProfile.topics.some((topic) => topic.toLowerCase() === customTopic.toLowerCase())) {
    onboardingProfile.topics = [customTopic, ...onboardingProfile.topics].slice(0, 8);
    onboardingProfile.researchIntent = customTopic;
    onboardingProfile.searchQuery = customTopic;
    onboardingProfile.topicPlanAI = false;
  }
  if (!onboardingProfile.topics.length) {
    showToast("至少添加一个研究主题");
    return;
  }
  elements.settingsTopicInput.value = "";
  persistProfile();
  renderSettings();
  switchView("discover");
  performSearch(onboardingProfile.searchQuery || onboardingProfile.topics[0]);
  showToast("发现主题已更新");
}

function selectAppearance(appearance) {
  state.appearance = appearance;
  window.localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
  applyAppearance(appearance);
  renderSettings();
  showToast(`已切换为 ${appearance === "light" ? "Light" : appearance === "dark" ? "Dark" : "System"} 主题`);
}

function applyAppearance(appearance) {
  document.documentElement.dataset.theme = appearance;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = appearance === "dark" ? "#101118" : "#f4f5f7";
}

function updateComplexityLabel(node, complexity) {
  const labels = ["Easy", "Accessible", "Balanced", "Advanced", "Expert"];
  node.textContent = labels[Math.max(1, Math.min(5, Number(complexity))) - 1];
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
  elements.dialog.showModal();
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
  const venueBadge = venueYear ? `${venueName} ${venueYear}` : (venueName || "Publication");
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
      <button class="library-pop-close" type="button" data-close-dialog="library-card-dialog" aria-label="Close"><i data-lucide="x"></i></button>
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
              <p class="card-subtitle">${escapeHTML(c.subtitle)}</p>
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
                <span class="source-stat"><span class="source-stat-emoji">📖</span>${numberOrZero(paper.read_minutes)} min</span>
                <span class="source-stat"><span class="source-stat-emoji">🌟</span>${numberOrZero(paper.citation_count)} cites</span>
                ${safeURL(paper.url) ? `<a class="source-link" href="${escapeAttribute(paper.url)}" target="_blank" rel="noopener" data-stop-click>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Original
                </a>` : ""}
                ${safeURL(paper.pdf_url) ? `<a class="source-link" href="${escapeAttribute(paper.pdf_url)}" target="_blank" rel="noopener" data-stop-click>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                  PDF
                </a>` : ""}
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
  elements.libraryCardDialog.showModal();
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

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = String(value);
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
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
