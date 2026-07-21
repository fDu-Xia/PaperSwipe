const DEFAULT_PROFILE = {
  identity: "graduate",
  researchIntent: "",
  searchQuery: "",
  topics: [],
  topicPlanAI: false,
  discoveryStyle: "focus",
  complexity: 3,
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
  librarySort: "recent",
  appearance: "system",
  networkTab: "heatmap",
  aiModel: "",
  imageEnabled: false,
  imageModel: "",
  paperImages: new Map(),
  generatingImage: "",
  connectedPeople: new Set(),
  stats: { saved: 0, priority: 0, read: 0, dismissed: 0 },
  session: { dismiss: 0, save: 0, priority: 0, read: 0 },
};

const ONBOARDING_STORAGE_KEY = "paperswipe-onboarding-v1";
const APPEARANCE_STORAGE_KEY = "paperswipe-appearance-v1";
const elements = {};
let toastTimer;
let onboardingStep = 0;
let onboardingProfile = { ...DEFAULT_PROFILE, topics: [...DEFAULT_PROFILE.topics] };

document.addEventListener("DOMContentLoaded", () => {
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
    settingsView: document.querySelector("#settings-view"),
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
    dismissButton: document.querySelector("#dismiss-button"),
    priorityButton: document.querySelector("#priority-button"),
    readButton: document.querySelector("#read-button"),
    saveButton: document.querySelector("#save-button"),
    aiStatus: document.querySelector("#ai-status"),
    libraryList: document.querySelector("#library-list"),
    librarySummary: document.querySelector("#library-summary"),
    dialog: document.querySelector("#paper-dialog"),
    dialogContent: document.querySelector("#dialog-content"),
    filterDialog: document.querySelector("#filter-dialog"),
    forumDialog: document.querySelector("#forum-dialog"),
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
    elements.searchPanel.hidden = !elements.searchPanel.hidden;
    if (!elements.searchPanel.hidden) elements.searchInput.focus();
  });
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
    const detailButton = event.target.closest("[data-detail-id]");
    if (detailButton) {
      openDetails(detailButton.dataset.detailId);
      return;
    }
    const removeButton = event.target.closest("[data-remove-id]");
    if (removeButton) {
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

  document.querySelector("#library-filter-button").addEventListener("click", () => elements.filterDialog.showModal());
  document.querySelectorAll("[data-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      state.librarySort = button.dataset.sort;
      document.querySelectorAll("[data-sort]").forEach((item) => item.classList.toggle("is-active", item === button));
      elements.filterDialog.close();
      renderLibrary();
    });
  });

  document.querySelector("#forums-button").addEventListener("click", () => elements.forumDialog.showModal());
  document.querySelectorAll("[data-network-tab]").forEach((button) => {
    button.addEventListener("click", () => switchNetworkTab(button.dataset.networkTab));
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

  document.addEventListener("keydown", (event) => {
    if (!state.started || state.activeView !== "discover" || state.loading || anyDialogOpen() || event.target.matches("input, textarea")) return;
    if (event.key === "ArrowLeft") decide("dismiss");
    if (event.key === "ArrowUp") decide("priority");
    if (event.key === "ArrowDown") decide("read");
    if (event.key === "ArrowRight") decide("save");
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
  elements.onboarding.scrollTop = 0;
}

function selectIdentity(identity) {
  onboardingProfile.identity = identity;
  document.querySelectorAll("[data-identity]").forEach((button) => {
    const selected = button.dataset.identity === identity;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  document.querySelectorAll("[data-identity-label]").forEach((label) => {
    label.classList.toggle("is-active", label.dataset.identityLabel === identity);
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
  performSearch(state.query);
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
  elements.paperCard.className = "paper-card is-loading";
  elements.paperCard.innerHTML = `
    <div class="skeleton-hero"></div>
    <div class="skeleton-line title"></div>
    <div class="skeleton-line"></div>
    <div class="skeleton-panel"></div>`;
  updateProgress();
}

function renderErrorCard(message) {
  elements.paperCard.className = "paper-card";
  elements.paperCard.innerHTML = `
    <div class="empty-deck">
      <img src="/assets/paper-stack.jpg" alt="叠放的研究论文">
      <h2>这次没抓到论文</h2>
      <p>${escapeHTML(message)}。换一个更具体的关键词再试试。</p>
    </div>`;
  setActionEnabled(false);
  updateProgress();
}

function renderCard() {
  const paper = currentPaper();
  elements.paperCard.style.transform = "";
  elements.paperCard.style.opacity = "";
  elements.paperCard.className = "paper-card";
  if (!paper) {
    elements.paperCard.innerHTML = `
      <div class="empty-deck">
        <img src="/assets/paper-stack.jpg" alt="叠放的研究论文">
        <h2>这一组筛完了</h2>
        <p>去 Library 回看保留的论文，或搜索一个新的研究主题。</p>
      </div>`;
    setActionEnabled(false);
    updateProgress();
    return;
  }

  const theme = paperTheme(paper);
  const authors = formatAuthors(paper.authors);
  const authorInitials = getInitials(paper.authors?.[0]?.name || "PS");
  const venue = [paper.venue, paper.year].filter(Boolean).join(" · ") || "Publication pending verification";
  const tags = deriveTags(paper);
  const paperLink = safeURL(paper.url) ? `<a href="${escapeAttribute(paper.url)}" target="_blank" rel="noopener"><i data-lucide="external-link"></i>Original</a>` : "";
  const pdfLink = safeURL(paper.pdf_url) ? `<a href="${escapeAttribute(paper.pdf_url)}" target="_blank" rel="noopener"><i data-lucide="file-down"></i>PDF</a>` : "";
  const generatedImage = normalizeURL(state.paperImages.get(paper.id));
  const heroClass = generatedImage ? "knowledge-hero has-generated-image" : "knowledge-hero";
  const heroStyle = generatedImage ? ` style="--paper-image: url(&quot;${escapeAttribute(generatedImage)}&quot;)"` : "";
  const generatingImage = state.generatingImage === paper.id;
  const imageButton = state.imageEnabled ? `
    <button class="visual-button${generatingImage ? " is-generating" : ""}${generatedImage ? " is-active" : ""}" type="button" data-generate-image-id="${escapeAttribute(paper.id)}" aria-label="${generatedImage ? "重新生成论文视觉图" : "生成论文视觉图（按次计费）"}" title="${generatedImage ? "重新生成视觉图" : "使用 AI 生成视觉图（按次计费）"}" ${generatingImage ? "disabled" : ""}><i data-lucide="${generatedImage ? "image-check" : "image-plus"}"></i></button>` : "";
  const highlights = [
    {
      label: "研究问题",
      icon: "search",
      text: paper.digest?.problem || "摘要未提供明确的研究问题",
    },
    {
      label: "核心方法",
      icon: "book-open",
      text: paper.digest?.method || paper.digest?.novelty || "摘要未提供明确的方法说明",
    },
    {
      label: "主要结果",
      icon: "sparkles",
      text: paper.digest?.result || "摘要未提供可核验的研究结果",
    },
  ];

  elements.paperCard.className = `paper-card ${theme}`;
  elements.paperCard.innerHTML = `
    <span class="swipe-stamp dismiss">NOPE</span>
    <span class="swipe-stamp save">INTERESTED</span>
    <span class="swipe-stamp priority">KEY</span>
    <span class="swipe-stamp read">READ</span>
    <div class="card-scroll">
      <header class="${heroClass}"${heroStyle}>
        <div class="knowledge-topline">
          <span>Knowledge Card · ${escapeHTML(paper.source || state.source)}</span>
          <div class="knowledge-tools">
            ${imageButton}
            <button type="button" data-card-action="priority" aria-label="标为重点论文" title="重点论文"><i data-lucide="star"></i></button>
          </div>
        </div>
        <h2 class="knowledge-title">${escapeHTML(paper.title)}</h2>
        <p class="knowledge-verdict">${escapeHTML(paper.digest?.verdict || "值得快速核验方法和结果")}</p>
        <div class="knowledge-byline">
          <span class="author-avatar">${escapeHTML(authorInitials)}</span>
          <div><strong>${escapeHTML(authors)}</strong><span>${escapeHTML(venue)}</span></div>
        </div>
        <span class="match-pill">${numberOrZero(paper.match_score)}</span>
      </header>
      <div class="knowledge-body">
        <section class="knowledge-section">
          <h3>Highlights</h3>
          <div class="core-idea" aria-label="AI 提取的论文要点">
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
          <p class="insight-copy">${escapeHTML(paper.digest?.why_keep || paper.digest?.result || "与当前研究主题高度相关，适合进入下一轮精读。")}</p>
        </section>
        <section class="knowledge-section">
          <h3>Application</h3>
          <div class="application-copy"><i data-lucide="briefcase-business"></i><span>${escapeHTML(paper.digest?.audience || paper.digest?.reading_focus || "适合关注该方向的方法研究者")}</span></div>
        </section>
        <div class="paper-meta">
          <span><i data-lucide="gauge"></i>Match ${numberOrZero(paper.match_score)}</span>
          <span><i data-lucide="clock-3"></i>${numberOrZero(paper.read_minutes)} min</span>
          <span><i data-lucide="quote"></i>${numberOrZero(paper.citation_count)} citations</span>
          ${paperLink}${pdfLink}
        </div>
        <button class="detail-trigger" type="button" data-detail-id="${escapeAttribute(paper.id)}"><i data-lucide="panel-right-open"></i><span>查看判断依据与原始摘要</span></button>
      </div>
    </div>`;
  setActionEnabled(true);
  updateProgress();
  refreshIcons();
  enableGestures(elements.paperCard);
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
  const themes = ["theme-teal", "theme-violet", "theme-coral", "theme-green"];
  const hash = String(paper.title || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return themes[hash % themes.length];
}

function deriveTags(paper) {
  const fields = (paper.fields || []).filter(Boolean).slice(0, 3);
  if (fields.length >= 3) return fields;
  return [...fields, paper.digest?.novelty ? "Novel method" : "Research", paper.pdf_url ? "Open PDF" : "Metadata"].slice(0, 3);
}

function enableGestures(card) {
  const zone = card.querySelector(".knowledge-hero");
  if (!zone) return;
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let dy = 0;
  let dragging = false;

  zone.addEventListener("pointerdown", (event) => {
    if (state.loading || event.target.closest("button, a")) return;
    dragging = true;
    dx = 0;
    dy = 0;
    startX = event.clientX;
    startY = event.clientY;
    zone.setPointerCapture(event.pointerId);
    card.classList.add("is-dragging");
  });
  zone.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    dx = event.clientX - startX;
    dy = event.clientY - startY;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 30}deg)`;
    const strength = Math.min(1, Math.max(Math.abs(dx), Math.abs(dy)) / 105);
    setStampOpacity(card, dx, dy, strength);
  });
  const finish = () => {
    if (!dragging) return;
    dragging = false;
    card.classList.remove("is-dragging");
    if (dx < -95 && Math.abs(dx) > Math.abs(dy)) return decide("dismiss");
    if (dx > 95 && Math.abs(dx) > Math.abs(dy)) return decide("save");
    if (dy < -85 && Math.abs(dy) > Math.abs(dx) * .8) return decide("priority");
    if (dy > 85 && Math.abs(dy) > Math.abs(dx) * .8) return decide("read");
    card.style.transform = "";
    setStampOpacity(card, 0, 0, 0);
  };
  zone.addEventListener("pointerup", finish);
  zone.addEventListener("pointercancel", finish);
}

function setStampOpacity(card, dx, dy, strength) {
  const stamps = {
    dismiss: card.querySelector(".swipe-stamp.dismiss"),
    save: card.querySelector(".swipe-stamp.save"),
    priority: card.querySelector(".swipe-stamp.priority"),
    read: card.querySelector(".swipe-stamp.read"),
  };
  if (!stamps.dismiss) return;
  stamps.dismiss.style.opacity = dx < 0 && Math.abs(dx) > Math.abs(dy) ? strength : 0;
  stamps.save.style.opacity = dx > 0 && Math.abs(dx) > Math.abs(dy) ? strength : 0;
  stamps.priority.style.opacity = dy < 0 && Math.abs(dy) >= Math.abs(dx) ? strength : 0;
  stamps.read.style.opacity = dy > 0 && Math.abs(dy) >= Math.abs(dx) ? strength : 0;
}

async function decide(action) {
  const paper = currentPaper();
  if (!paper || state.loading || elements.paperCard.classList.contains("is-leaving")) return;
  elements.paperCard.classList.add("is-leaving", `fly-${action}`);
  state.session[action] += 1;
  const labels = { dismiss: "已跳过", save: "已加入 Interested", priority: "已标为 Key", read: "已标为 Read" };

  window.setTimeout(() => {
    state.index += 1;
    renderCard();
  }, 235);

  try {
    const response = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paper, action }),
    });
    if (!response.ok) throw new Error("保存失败");
    showToast(labels[action]);
    await Promise.all([refreshLibrary(), refreshStats()]);
  } catch (_) {
    showToast("本次判断没有保存，请稍后重试");
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
  if (state.librarySort === "citations") {
    entries = [...entries].sort((a, b) => numberOrZero(b.paper.citation_count) - numberOrZero(a.paper.citation_count));
  } else if (state.librarySort === "easy") {
    entries = [...entries].sort((a, b) => numberOrZero(a.paper.read_minutes) - numberOrZero(b.paper.read_minutes));
  }

  renderLibrarySummary();
  if (!entries.length) {
    const labels = { save: "Interested", priority: "Key", read: "Read" };
    elements.libraryList.innerHTML = `<div class="library-empty"><i data-lucide="library"></i><h2>${labels[state.libraryFilter]} 还是空的</h2><p>回到 Explore，保留第一篇真正值得读的论文。</p></div>`;
    refreshIcons();
    return;
  }

  const actionIcons = { save: "heart", priority: "star", read: "check" };
  elements.libraryList.innerHTML = entries.map((entry) => {
    const paper = entry.paper;
    return `<article class="library-item">
      <div class="library-visual"><i data-lucide="workflow"></i></div>
      <div class="library-copy">
        <h2>${escapeHTML(paper.title)}</h2>
        <p>${escapeHTML(paper.digest?.verdict || paper.digest?.why_keep || "等待核验")}</p>
        <small><span>${numberOrZero(paper.match_score)}% match</span> · ${numberOrZero(paper.read_minutes)} min · ${numberOrZero(paper.citation_count)} citations</small>
      </div>
      <div class="library-actions">
        <span class="library-badge"><i data-lucide="${actionIcons[entry.action]}"></i></span>
        <button type="button" data-detail-id="${escapeAttribute(paper.id)}" aria-label="查看论文详情" title="详情"><i data-lucide="chevron-right"></i></button>
        <button type="button" data-remove-id="${escapeAttribute(paper.id)}" aria-label="移出清单" title="移出清单"><i data-lucide="trash-2"></i></button>
      </div>
    </article>`;
  }).join("");
  refreshIcons();
}

function renderLibrarySummary() {
  const interested = state.library.filter((entry) => entry.action === "save").length;
  const total = state.library.length;
  const strong = interested >= 90 ? `Interested 已接近上限 (${interested}/100)` : `${total} papers in your reading system`;
  const detail = interested >= 90 ? "先完成或归档一批论文，再继续滑动。" : "让 Key 保持稀缺，让 Read 记录真正完成的阅读。";
  elements.librarySummary.innerHTML = `<i data-lucide="${interested >= 90 ? "triangle-alert" : "sparkles"}"></i><div><strong>${escapeHTML(strong)}</strong><span>${escapeHTML(detail)}</span></div>`;
  refreshIcons();
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
    elements.recentSearches.innerHTML = items.slice(0, 5).map((item) => `<button type="button" data-query="${escapeAttribute(item.query)}">${escapeHTML(item.query)}</button>`).join("");
  } catch (_) {
    elements.recentSearches.innerHTML = "";
  }
}

function switchView(view) {
  const validViews = ["discover", "library", "network", "settings"];
  state.activeView = validViews.includes(view) ? view : "discover";
  const views = {
    discover: elements.discoverView,
    library: elements.libraryView,
    network: elements.networkView,
    settings: elements.settingsView,
  };
  Object.entries(views).forEach(([name, panel]) => {
    const active = name === state.activeView;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
  document.querySelectorAll(".bottom-nav [data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === state.activeView));
  elements.searchPanel.hidden = true;
  if (state.activeView === "library") refreshLibrary();
  if (state.activeView === "network") renderPeople();
  if (state.activeView === "settings") renderSettings();
}

function switchNetworkTab(tab) {
  state.networkTab = tab === "connections" ? "connections" : "heatmap";
  document.querySelector("#network-heatmap").hidden = state.networkTab !== "heatmap";
  document.querySelector("#network-connections").hidden = state.networkTab !== "connections";
  document.querySelectorAll("[data-network-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.networkTab === state.networkTab));
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

function renderSettings() {
  const identities = { graduate: "研究生", researcher: "教授 / 研究员", enthusiast: "AI 探索者" };
  const styleLabel = onboardingProfile.discoveryStyle === "broaden" ? "Broaden discovery" : "Focused discovery";
  document.querySelector("#settings-identity").textContent = `${identities[onboardingProfile.identity] || "研究者"} · ${styleLabel}`;
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
  const details = [
    ["解决什么", paper.digest?.problem], ["新在哪里", paper.digest?.novelty],
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

function updateProgress() {
  const total = state.papers.length;
  elements.paperPosition.textContent = total ? Math.min(state.index + 1, total) : "0";
  elements.paperTotal.textContent = String(total);
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
  if (!names.length) return "作者信息待核验";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} 等 ${names.length} 位作者`;
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
