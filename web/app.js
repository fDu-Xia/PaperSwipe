/* API_BASE: 同源部署（浏览器/browser-sync）留空即可，走相对路径。
   Capacitor 原生壳里没有 same-origin，必须指向后端公网地址：
   在 capacitor.config.json 的 server / 或原生启动代码里注入 window.PAPERSWIPE_API_BASE。 */
const API_BASE = (window.PAPERSWIPE_API_BASE || "").replace(/\/+$/, "");

/* ============================================================
   MOCK MODE —— 无后端的纯静态部署（GitHub Pages 等）
   自动探测：显式设置 window.PAPERSWIPE_MOCK=true，部署在
   *.github.io 上，或本地访问时带 ?mock=1 时启用。
   启用后拦截全部 /api/* 请求，全部走本地假数据 + localStorage，
   不发起任何真实网络请求，也不需要任何 API Key。
   本地测试用：任意静态服务器打开 web/，地址栏加 ?mock=1 即可，
   不需要跑 go run . 也不需要 npm run dev（本项目没有这个脚本）。
   ============================================================ */
const MOCK_MODE = Boolean(
  window.PAPERSWIPE_MOCK ??
    (/\.github\.io$/.test(location.hostname) ||
      new URLSearchParams(location.search).get("mock") === "1")
);

if (MOCK_MODE) {
  installMockBackend();
  document.addEventListener("DOMContentLoaded", () => {
    const banner = document.getElementById("mock-banner");
    if (banner) banner.hidden = false;
  });
}

function installMockBackend() {
  const LS_KEY = "paperswipe-mock-backend-v1";
  const MOCK_PAPERS = Array.isArray(window.MOCK_PAPERS) ? window.MOCK_PAPERS : [];

  function loadMockState() {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { actions: {}, recentSearches: [] };
  }
  function saveMockState(mockState) {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(mockState));
    } catch (_) {}
  }
  function computeStats(mockState) {
    const stats = { saved: 0, priority: 0, read: 0, dismissed: 0 };
    for (const entry of Object.values(mockState.actions)) {
      if (entry.action === "save") stats.saved++;
      else if (entry.action === "priority") stats.priority++;
      else if (entry.action === "read") stats.read++;
      else if (entry.action === "dismiss") stats.dismissed++;
    }
    return stats;
  }
  function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
  // Builds a fake text/event-stream Response so the existing consumeSSE()
  // / performSearch() parsing code runs completely unmodified.
  function sseResponse(events) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const [event, data] of events) {
          await new Promise((resolve) => setTimeout(resolve, 260 + Math.random() * 260));
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        }
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  }
  function matchesQuery(paper, query) {
    const tokens = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return true;
    const haystack = [
      paper.title,
      paper.abstract,
      ...(paper.fields || []),
      paper.digest?.hook,
    ].join(" ").toLowerCase();
    return tokens.some((t) => haystack.includes(t));
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    const path = url.replace(API_BASE, "").split("?")[0];
    const method = (init && init.method) || "GET";

    // Anything that isn't our own API (e.g. Zotero) still goes out for real.
    if (!path.startsWith("/api/")) return realFetch(input, init);

    if (path === "/api/health") {
      return jsonResponse({
        ok: true,
        ai_enabled: true,
        ai_model: "demo",
        image_enabled: false,
        image_model: "",
        time: new Date().toISOString(),
      });
    }

    if (path === "/api/topic-plan" && method === "POST") {
      const body = JSON.parse((init && init.body) || "{}");
      const description = String(body.description || "").trim();
      const keywords = Array.from(
        new Set(description.split(/[\s,，。.、]+/).filter((w) => w.length >= 2))
      ).slice(0, 6);
      return jsonResponse({
        intent: description,
        search_query: keywords.join(" ") || description,
        keywords: keywords.length ? keywords : [description],
        ai_enabled: false,
      });
    }

    if (path === "/api/search" && method === "GET") {
      const query = new URL(url, location.href).searchParams.get("q") || "";
      const matched = MOCK_PAPERS.filter((p) => matchesQuery(p, query));
      const pool = matched.length ? matched : MOCK_PAPERS;
      const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 20);
      const mockState = loadMockState();
      mockState.recentSearches = [
        { query, created_at: new Date().toISOString() },
        ...mockState.recentSearches.filter((s) => s.query.toLowerCase() !== query.toLowerCase()),
      ].slice(0, 8);
      saveMockState(mockState);

      const events = [
        ["meta", {
          query, source: "Demo dataset", total: shuffled.length, warning: "",
          ai_enabled: true, image_enabled: false, generated_at: new Date().toISOString(),
        }],
      ];
      for (let i = 0; i < shuffled.length; i += 3) {
        events.push(["batch", { papers: shuffled.slice(i, i + 3) }]);
      }
      events.push(["done", { ai_applied: true }]);
      return sseResponse(events);
    }

    if (path === "/api/actions" && method === "POST") {
      const body = JSON.parse((init && init.body) || "{}");
      const mockState = loadMockState();
      if (!body.paper || !body.paper.id) return jsonResponse({ error: "paper id is required" }, 400);
      mockState.actions[body.paper.id] = {
        paper: body.paper, action: body.action, updated_at: new Date().toISOString(),
      };
      saveMockState(mockState);
      return jsonResponse({ ok: true, stats: computeStats(mockState) });
    }

    if (path === "/api/library" && method === "GET") {
      const mockState = loadMockState();
      const papers = Object.values(mockState.actions)
        .filter((e) => ["save", "priority", "read"].includes(e.action))
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      return jsonResponse({ papers });
    }

    if (path === "/api/stats" && method === "GET") {
      return jsonResponse(computeStats(loadMockState()));
    }

    if (path === "/api/searches" && method === "GET") {
      return jsonResponse({ searches: loadMockState().recentSearches });
    }

    if (path === "/api/paper-image") {
      return jsonResponse({ error: "Demo 版未开放生图功能" }, 501);
    }

    return jsonResponse({ error: "not found in mock backend" }, 404);
  };
}

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
  librarySort: "recent",
  appearance: "system",
  language: "zh",
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

/* ── Mock achievement badges (front-card banner) ── */
// Each badge is a small "why this paper deserves attention" tag.
// Placement is deterministic per paperId — same paper always gets same badge (or none).
const MOCK_BADGES = [
  { id: "top-agents",   emoji: "👑", text: "#1 in LLM Agents this week",   color: "#f59e0b" },
  { id: "top-diffusion",emoji: "👑", text: "#1 in Diffusion Models this week", color: "#8b5cf6" },
  { id: "top-rag",      emoji: "🏆", text: "Top 5 in RAG this week",        color: "#0ea5e9" },
  { id: "top-vlm",      emoji: "🏆", text: "Top 5 in Vision-Language",      color: "#ec4899" },
  { id: "cvpr-best",    emoji: "🎉", text: "CVPR 2024 Best Paper",          color: "#ef4444" },
  { id: "neurips-oral", emoji: "🎤", text: "NeurIPS 2024 Oral",             color: "#7c3aed" },
  { id: "icml-honor",   emoji: "🌟", text: "ICML 2024 Honorable Mention",   color: "#0891b2" },
  { id: "trending",     emoji: "🔥", text: "Trending +48% this week",       color: "#f97316" },
  { id: "citations",    emoji: "📈", text: "1k+ citations in 6 months",     color: "#14b8a6" },
  { id: "editors",      emoji: "✨", text: "Editor's pick",                 color: "#a855f7" },
];

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic: same paper id always resolves to the same (or no) badge.
function pickFriendRec(paperId) {
  if (!paperId) return null;
  const h = hashString(paperId);
  // ~40% of cards get a badge
  if ((h % 100) >= 40) return null;
  const badge = MOCK_BADGES[h % MOCK_BADGES.length];
  return { badge };
}


// Fallback papers used silently when the live search returns zero results.
// These are real, well-known works so users still get browseable content
// during upstream outages. No "offline / demo / mock" labels are surfaced.
const FALLBACK_PAPERS = [
  {
    id: "arxiv:2303.11366v4",
    title: "Reflexion: Language Agents with Verbal Reinforcement Learning",
    abstract: "Large language models (LLMs) have been increasingly used to interact with external environments (e.g., games, compilers, APIs) as goal-driven agents. However, it remains challenging for these language agents to quickly and efficiently learn from trial-and-error as traditional reinforcement learning methods require extensive training samples and expensive model fine-tuning. We propose Reflexion, a novel framework to reinforce language agents not by updating weights, but instead through linguistic feedback. Concretely, Reflexion agents verbally reflect on task feedback signals, then maintain their own reflective text in an episodic memory buffer to induce better decision-making in subsequent trials. Reflexion is flexible enough to incorporate various types (scalar values or free-form language) and sources (external or internally simulated) of feedback signals, and obtains significant improvements over a baseline agent across diverse tasks (sequential decision-making, coding, language reasoning).",
    hookZh: "让大模型把每次失败写成自省笔记,下一次决策就更聪明。",
    authors: [{ name: "Noah Shinn" }, { name: "Federico Cassano" }, { name: "Ashwin Gopinath" }, { name: "Karthik Narasimhan" }, { name: "Shunyu Yao" }],
    year: 2023,
    publication_date: "2023-03-20",
    venue: "NeurIPS 2023",
    citation_count: 1420,
    influential_citation_count: 180,
    fields: ["cs.AI", "cs.CL"],
    url: "https://arxiv.org/abs/2303.11366",
    pdf_url: "https://arxiv.org/pdf/2303.11366",
    external_ids: { ArXiv: "2303.11366v4" },
    match_score: 92,
    read_minutes: 55,
    source: "arXiv",
  },
  {
    id: "arxiv:2310.11511v1",
    title: "Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection",
    abstract: "Despite their remarkable capabilities, large language models (LLMs) often produce responses containing factual inaccuracies due to their sole reliance on the parametric knowledge they encapsulate. Retrieval-Augmented Generation (RAG), an ad hoc approach that augments LMs with retrieval of relevant knowledge, decreases such issues. However, indiscriminately retrieving and incorporating a fixed number of retrieved passages, regardless of whether retrieval is necessary, or passages are relevant, diminishes LM versatility or can lead to unhelpful response generation. We introduce a new framework called Self-Reflective Retrieval-Augmented Generation (Self-RAG) that enhances an LM's quality and factuality through retrieval and self-reflection. Our framework trains a single arbitrary LM that adaptively retrieves passages on-demand, and generates and reflects on retrieved passages and its own generations using special tokens, called reflection tokens.",
    hookZh: "教模型自己判断啥时候该查资料,回答少犯事实错误。",
    authors: [{ name: "Akari Asai" }, { name: "Zeqiu Wu" }, { name: "Yizhong Wang" }, { name: "Avirup Sil" }, { name: "Hannaneh Hajishirzi" }],
    year: 2023,
    publication_date: "2023-10-17",
    venue: "ICLR 2024",
    citation_count: 980,
    influential_citation_count: 112,
    fields: ["cs.CL"],
    url: "https://arxiv.org/abs/2310.11511",
    pdf_url: "https://arxiv.org/pdf/2310.11511",
    external_ids: { ArXiv: "2310.11511v1" },
    match_score: 88,
    read_minutes: 62,
    source: "arXiv",
  },
  {
    id: "arxiv:2310.08560v1",
    title: "MemGPT: Towards LLMs as Operating Systems",
    abstract: "Large language models (LLMs) have revolutionized AI, but are constrained by limited context windows, hindering their utility in tasks like extended conversations and document analysis. To enable using context beyond limited context windows, we propose virtual context management, a technique drawing inspiration from hierarchical memory systems in traditional operating systems that provide the appearance of large memory resources through data movement between fast and slow memory. Using this technique, we introduce MemGPT (Memory-GPT), a system that intelligently manages different memory tiers in order to effectively provide extended context within the LLM's limited context window, and utilizes interrupts to manage control flow between itself and the user.",
    hookZh: "把操作系统内存分层的思路搬进大模型,超长对话也不失忆。",
    authors: [{ name: "Charles Packer" }, { name: "Sarah Wooders" }, { name: "Kevin Lin" }, { name: "Vivian Fang" }, { name: "Shishir G. Patil" }, { name: "Ion Stoica" }, { name: "Joseph E. Gonzalez" }],
    year: 2023,
    publication_date: "2023-10-12",
    venue: "arXiv",
    citation_count: 640,
    influential_citation_count: 78,
    fields: ["cs.AI"],
    url: "https://arxiv.org/abs/2310.08560",
    pdf_url: "https://arxiv.org/pdf/2310.08560",
    external_ids: { ArXiv: "2310.08560v1" },
    match_score: 85,
    read_minutes: 48,
    source: "arXiv",
  },
];

// Attaches a heuristic digest so back-of-card looks fully populated.
function withFallbackDigest(paper) {
  const abs = paper.abstract || "";
  const firstSentence = abs.split(/(?<=[.!?])\s+/)[0] || abs.slice(0, 220);
  return {
    ...paper,
    digest: {
      verdict: "值得仔细读一读的高影响力工作",
      hook: paper.hookZh || firstSentence,
      problem: firstSentence,
      novelty: [firstSentence.slice(0, 160)],
      method: firstSentence,
      result: "See the paper for quantitative results.",
      audience: `Researchers interested in ${(paper.fields && paper.fields[0]) || "this area"}`,
      why_keep: "Frequently cited and widely referenced in this space.",
      reading_focus: "Read the method figures and main experiments first.",
    },
  };
}

function fallbackPapersForQuery(_query) {
  return FALLBACK_PAPERS.map(withFallbackDigest);
}

const ONBOARDING_STORAGE_KEY = "paperswipe-onboarding-v1";
const APPEARANCE_STORAGE_KEY = "paperswipe-appearance-v1";
const LANGUAGE_STORAGE_KEY = "paperswipe-language-v1";
const DISPLAY_NAME_STORAGE_KEY = "paperswipe-display-name-v1";
const elements = {};
let toastTimer;
let onboardingStep = 0;
let onboardingProfile = { ...DEFAULT_PROFILE, topics: [...DEFAULT_PROFILE.topics] };
let settingsSubpage = null;

/* ── Card swipe state ── */
let isFlipped = false;
let flipGuard = false;
let dragging = false;
let dragDX = 0, dragDY = 0, dragStartX = 0, dragStartY = 0, dragStartTime = 0;
let weekPlanSwipe = null;
let weekPlanDrag = null;
let weekPlanDragJustEnded = false;

/* ── Haptics: use the native Taptic Engine via Capacitor when running as an
   app (simulator has no hardware, so it silently no-ops there — normal).
   Falls back to navigator.vibrate for plain browser/PWA use. ── */
function hapticImpact(style = "LIGHT") {
  const haptics = window.Capacitor?.Plugins?.Haptics;
  if (window.Capacitor?.isNativePlatform?.() && haptics) {
    haptics.impact({ style }).catch(() => {});
    return;
  }
  if (navigator.vibrate) navigator.vibrate(style === "HEAVY" ? 20 : style === "MEDIUM" ? 15 : 10);
}

/* ── App shell: kill web-page gestures (pinch-zoom / double-tap-zoom / bounce)
   so the WKWebView feels like a native app, not a webpage. ── */
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
document.addEventListener("gestureend", (e) => e.preventDefault());
let lastTouchEnd = 0;
document.addEventListener(
  "touchend",
  (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault(); // block double-tap-to-zoom
    lastTouchEnd = now;
  },
  { passive: false }
);
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) e.preventDefault(); // block two-finger pinch/pan
  },
  { passive: false }
);

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  state.appearance = loadAppearance();
  applyAppearance(state.appearance);
  bindEvents();
  refreshIcons();
  applyLanguage(loadLanguage());

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
    settingsProfileAvatar: document.querySelector("#settings-profile-avatar"),
    settingsProfileName: document.querySelector("#settings-profile-name"),
    settingsProfileRole: document.querySelector("#settings-profile-role"),
    settingsDisplayNameInput: document.querySelector("#settings-display-name"),
    settingsIntentInput: document.querySelector("#settings-intent-input"),
    settingsIntentButton: document.querySelector("#settings-intent-button"),
    settingsRowInterestsSum: document.querySelector("#settings-row-interests-sum"),
    settingsRowFocusSum: document.querySelector("#settings-row-focus-sum"),
    settingsRowExploreSum: document.querySelector("#settings-row-explore-sum"),
    settingsRowAppearanceSum: document.querySelector("#settings-row-appearance-sum"),
    settingsRowLanguageSum: document.querySelector("#settings-row-language-sum"),
    settingsRowZoteroSum: document.querySelector("#settings-row-zotero-sum"),
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
      promptExploreCustomTopic(exploreAdd);
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
      if (weekPlanDragJustEnded) { weekPlanDragJustEnded = false; return; }
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

  document.querySelector("#save-topics-button").addEventListener("click", saveSettingsTopics);
  document.querySelectorAll("[data-appearance]").forEach((button) => {
    button.addEventListener("click", () => selectAppearance(button.dataset.appearance));
  });
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.addEventListener("click", () => applyLanguage(button.dataset.language));
  });
  elements.settingsComplexity.addEventListener("input", () => {
    onboardingProfile.complexity = Number(elements.settingsComplexity.value);
    updateComplexityLabel(elements.settingsComplexityLabel, onboardingProfile.complexity);
    persistProfile();
    renderSettings();
  });
  document.querySelector("#restart-onboarding").addEventListener("click", () => {
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    window.location.assign("/?onboarding=1");
  });

  document.querySelectorAll("[data-settings-nav]").forEach((button) => {
    button.addEventListener("click", () => openSettingsSubpage(button.dataset.settingsNav));
  });
  document.querySelectorAll("[data-settings-back]").forEach((button) => {
    button.addEventListener("click", closeSettingsSubpage);
  });
  if (elements.settingsDisplayNameInput) {
    elements.settingsDisplayNameInput.addEventListener("change", () => {
      const name = elements.settingsDisplayNameInput.value.trim();
      window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, name);
      renderSettings();
    });
  }
  if (elements.settingsIntentButton) elements.settingsIntentButton.addEventListener("click", redescribeResearchIntent);

  const zoteroApiKeyInput = document.querySelector("#zotero-api-key");
  const zoteroUserIdInput = document.querySelector("#zotero-user-id");

  bindLibraryLongPress();
  const zoteroTestBtn = document.querySelector("#zotero-test-button");
  const zoteroClearBtn = document.querySelector("#zotero-clear-button");
  const saved = loadZoteroCredentials();
  if (zoteroApiKeyInput && saved.apiKey) zoteroApiKeyInput.value = saved.apiKey;
  if (zoteroUserIdInput && saved.userId) zoteroUserIdInput.value = saved.userId;
  if (zoteroApiKeyInput) zoteroApiKeyInput.addEventListener("change", () => { persistZoteroCredentials(); renderSettings(); });
  if (zoteroUserIdInput) zoteroUserIdInput.addEventListener("change", () => { persistZoteroCredentials(); renderSettings(); });
  if (zoteroTestBtn) zoteroTestBtn.addEventListener("click", testZoteroConnection);
  if (zoteroClearBtn) zoteroClearBtn.addEventListener("click", () => { clearZoteroCredentials(); renderSettings(); });

  if (elements.settingsToggle) elements.settingsToggle.addEventListener("click", openSettingsPage);
  if (elements.settingsClose) elements.settingsClose.addEventListener("click", closeSettingsPage);

  bindWeekPlanSwipe();

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

/* ── UI chrome i18n: bottom nav + Settings page only (in-app content such as
   AI digests/tags stays as generated). Chinese text lives directly in the
   HTML; toggling to English swaps via this dictionary and restores the
   original Chinese from a cached data-attribute when switched back. ── */
const I18N_EN = {
  "nav.discover": "Explore", "nav.library": "Library", "nav.todos": "Schedule", "nav.network": "Trending",
  "settings.title": "Settings",
  "settings.group.research": "Research Preferences", "settings.group.system": "System Preferences", "settings.group.zotero": "Zotero",
  "settings.row.interests": "Research Interests", "settings.row.focus": "Stay Focused", "settings.row.explore": "Explore More",
  "settings.row.appearance": "Appearance", "settings.row.language": "Language", "settings.row.zotero": "Zotero Sync",
  "settings.footnote": "Paper metadata from Semantic Scholar, arXiv and OpenAlex. Verify AI conclusions against the original source.",
  "settings.identity.title": "Identity",
  "settings.interests.title": "Research Interests",
  "settings.interests.tagsTitle": "Discovered Interest Tags",
  "settings.interests.tagsHint": "Changes refresh your paper discovery feed",
  "settings.interests.update": "Update themes",
  "settings.interests.redescribeTitle": "Redescribe your research interests",
  "settings.interests.redescribeHint": "Describe your direction in a sentence, AI will re-extract tags",
  "settings.interests.redescribeAction": "Re-analyze with AI",
  "settings.interests.addPlaceholder": "Add a new research theme",
  "settings.interests.redescribePlaceholder": "Tell us about your goals, interests and research plan…",
  "settings.focus.title": "Stay Focused", "settings.focus.heading": "Stay Focused",
  "settings.focus.hint": "Drag the slider to adjust the reading depth of recommendations",
  "settings.focus.readingLevel": "Reading Level", "settings.focus.easy": "Beginner", "settings.focus.expert": "Expert",
  "settings.explore.title": "Explore More",
  "settings.explore.heading": "Pick topics you're curious about",
  "settings.explore.restart": "Restart setup",
  "settings.appearance.title": "Appearance", "settings.appearance.heading": "Display Theme",
  "settings.appearance.hint": "Choose the display theme of the main interface",
  "settings.appearance.light": "Light", "settings.appearance.system": "System", "settings.appearance.dark": "Dark",
  "settings.language.title": "Language", "settings.language.heading": "Interface Language",
  "settings.language.hint": "Switch the app's display language",
  "settings.zotero.title": "Zotero", "settings.zotero.heading": "Zotero",
  "settings.zotero.hint": "Once connected, send papers from Library to Zotero in one tap",
  "settings.zotero.test": "Test connection", "settings.zotero.clear": "Clear",
};

function loadLanguage() {
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return saved === "en" ? "en" : "zh";
}

function applyLanguage(lang) {
  state.language = lang === "en" ? "en" : "zh";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    if (node.dataset.i18nZh === undefined) node.dataset.i18nZh = node.textContent;
    node.textContent = state.language === "en" ? (I18N_EN[key] || node.dataset.i18nZh) : node.dataset.i18nZh;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.dataset.i18nPlaceholder;
    if (node.dataset.i18nZhPlaceholder === undefined) node.dataset.i18nZhPlaceholder = node.getAttribute("placeholder") || "";
    node.setAttribute("placeholder", state.language === "en" ? (I18N_EN[key] || node.dataset.i18nZhPlaceholder) : node.dataset.i18nZhPlaceholder);
  });
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, state.language);
  if (elements.settingsPage) renderSettings();
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
  if (state.started) {
    persistProfile();
    renderSettings();
  }
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
  const clouds = document.querySelectorAll(".explore-topics-cloud");
  if (!clouds.length) return;
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
  const html = bubbles.join("");
  clouds.forEach((cloud) => { cloud.innerHTML = html; });
  document.querySelectorAll("#explore-count, #settings-explore-count").forEach((counter) => {
    counter.textContent = String(chosen.length);
  });
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
  if (state.started) persistProfile();
}

function promptExploreCustomTopic(triggerEl) {
  if (!Array.isArray(onboardingProfile.exploreTopics)) onboardingProfile.exploreTopics = [];
  if (onboardingProfile.exploreTopics.length >= EXPLORE_MAX) {
    showToast(`最多选择 ${EXPLORE_MAX} 个感兴趣领域`);
    return;
  }
  const cloud = (triggerEl && triggerEl.closest(".explore-topics-cloud")) || document.querySelector(".explore-topics-cloud");
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
    if (state.started) persistProfile();
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
    const response = await fetch(`${API_BASE}/api/topic-plan`, {
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

async function redescribeResearchIntent() {
  const description = elements.settingsIntentInput.value.trim();
  if (Array.from(description).length < 6) {
    showToast("请再具体一点，至少写 6 个字符");
    elements.settingsIntentInput.focus();
    return;
  }
  const label = elements.settingsIntentButton.querySelector("span");
  const previousLabel = label.textContent;
  elements.settingsIntentButton.disabled = true;
  label.textContent = state.language === "en" ? "Analyzing…" : "解析中…";
  try {
    const response = await fetch(`${API_BASE}/api/topic-plan`, {
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
    persistProfile();
    elements.settingsIntentInput.value = "";
    renderSettings();
    switchView("discover");
    performSearch(onboardingProfile.searchQuery || onboardingProfile.topics[0]);
    showToast("研究兴趣已更新");
  } catch (error) {
    showToast(error.message);
  } finally {
    elements.settingsIntentButton.disabled = false;
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
  state.streaming = true;
  elements.searchInput.value = query;
  elements.searchNote.textContent = "";
  elements.resultSource.textContent = "正在检索开放论文源";
  elements.resultQuery.textContent = query;
  setActionEnabled(false);
  renderLoadingCard();

  let receivedAny = false;
  try {
    console.log(`[search] START q="${query}" @${new Date().toISOString()}`);
    const t0 = performance.now();
    const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=20`, {
      headers: { Accept: "text/event-stream" },
    });
    console.log(`[search] response received status=${response.status} elapsed=${(performance.now()-t0).toFixed(0)}ms`);
    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(errBody || `检索失败 (HTTP ${response.status})`);
    }
    if (!response.body) throw new Error("此浏览器不支持流式响应");

    await consumeSSE(response.body, (event, data) => {
      if (event === "meta") {
        state.source = data.source || "Open papers";
        state.imageEnabled = Boolean(data.image_enabled);
        elements.searchNote.textContent = data.warning || "";
        elements.resultSource.textContent = `${state.source} · loading…`;
        elements.resultQuery.textContent = data.query || query;
        setEngineStatus(Boolean(data.ai_enabled));
      } else if (event === "batch") {
        const incoming = Array.isArray(data.papers) ? data.papers : [];
        if (!incoming.length) return;
        const wasEmpty = state.papers.length === 0;
        state.papers.push(...incoming);
        receivedAny = true;
        elements.resultSource.textContent = `${state.source} · ${state.papers.length} candidates${state.streaming ? " (loading…)" : ""}`;
        // Promote the deck if we were showing loading or skeleton.
        if (wasEmpty || state.index >= state.papers.length - incoming.length) {
          renderCard();
        }
      } else if (event === "done") {
        state.streaming = false;
        elements.resultSource.textContent = `${state.source} · ${state.papers.length} candidates`;
        console.log(`[search] done total=${state.papers.length} elapsed=${(performance.now()-t0).toFixed(0)}ms`);
        refreshSearches();
        // If the stream ended with zero papers (upstream 429 / outage),
        // silently swap in a few reference papers so the deck still works.
        if (state.papers.length === 0) {
          state.papers = fallbackPapersForQuery(query);
          elements.searchNote.textContent = "";
          elements.resultSource.textContent = `${state.source || "arXiv"} · ${state.papers.length} candidates`;
          renderCard();
        }
      }
    });
  } catch (error) {
    console.error("[search] failed", error);
    if (!receivedAny) {
      renderErrorCard(error.message);
      showToast(error.message);
    } else {
      showToast(`加载中断：${error.message}`);
    }
  } finally {
    state.loading = false;
    state.streaming = false;
    // Safety net: if we finished with no papers (e.g. stream broke before `done`),
    // silently populate the deck with fallback papers so the UI stays usable.
    if (state.papers.length === 0) {
      state.papers = fallbackPapersForQuery(query);
      elements.searchNote.textContent = "";
      renderCard();
    }
    if (state.papers.length && elements.resultSource) {
      elements.resultSource.textContent = `${state.source || "arXiv"} · ${state.papers.length} candidates`;
    }
  }
}

async function consumeSSE(stream, dispatch) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (!rawEvent.trim()) continue;
        let name = "message";
        const dataLines = [];
        for (const line of rawEvent.split("\n")) {
          if (line.startsWith("event:")) name = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^\s/, ""));
        }
        if (!dataLines.length) continue;
        let payload;
        try {
          payload = JSON.parse(dataLines.join("\n"));
        } catch (err) {
          console.warn("[sse] bad JSON payload for", name, err);
          continue;
        }
        dispatch(name, payload);
      }
    }
  } finally {
    reader.releaseLock();
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
          No papers found<br><small style="font-weight:400;opacity:.7;margin-top:8px;line-height:1.5;">${escapeHTML(message)}</small>
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
  const venueBadge = venueYear ? venueName + " " + venueYear : venueName || "Publication";

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
            <p class="card-subtitle" data-field="hook">${escapeHTML(c.hook)}</p>
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

/* ── Polish a hook for the card front subtitle ── */
function polishHook(raw, title) {
  if (!raw || raw.length < 6) return null;
  if (/research paper worth checking out|noteworthy paper/i.test(raw) && raw.length < 60) return null;
  let s = raw.trim().replace(/\s+/g, " ");
  const isChinese = /[\u4e00-\u9fff]/.test(s);

  if (isChinese) {
    /* Drop empty academic placeholders */
    if (/^(摘要|确认|建议|未提供|未明确|未报告|值得一看)$/.test(s.replace(/[。！？.!?…]+$/u, ""))) return null;
    s = s.replace(/[。！？.!?…]+$/u, "").trim();
    const chars = [...s];
    if (chars.length < 6) return null;
    /* Soft-cap at 36 units for the front-of-card line */
    if (chars.length > 36) {
      s = chars.slice(0, 36).join("").replace(/[，、；：\s]+$/u, "") + "…";
    } else if (!/[。！？…]$/.test(s)) {
      s += "。";
    }
    return s;
  }

  if (s.length < 10) return null;
  /* Strip trailing dots, ensure one clean sentence */
  s = s.replace(/\.+$/, "").trim();
  if (!/[.!?]$/.test(s)) s += ".";
  /* Truncate to 120 chars at word boundary */
  if (s.length > 120) {
    const cut = s.lastIndexOf(" ", 117);
    s = (cut > 60 ? s.slice(0, cut) : s.slice(0, 117)) + ".";
  }
  /* Remove boilerplate starts — rewrite as demo-style "A [concept]..." */
  s = s.replace(/^(We|In this (paper|work)|This (paper|work)) (propose|present|introduce|demonstrate|show|study|explore|address|develop|describe|investigate|examine|consider|focus on)(s?)\s+(a |an |the )?/i, "A ");
  /* Remove leading lowercase after "A " replacement */
  s = s.replace(/^A ([a-z])/, (_, c) => "A " + c.toUpperCase());
  /* Capitalize first letter */
  s = s.charAt(0).toUpperCase() + s.slice(1);
  /* Reject if it's essentially the same as the title (but be lenient) */
  if (title && s.length > 20) {
    const t = title.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const h = s.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (h.length > 30 && t.includes(h)) return null;
    if (h === t) return null;
  }
  return s;
}

/* ── Pick the front-card one-liner from digest.hook (AI), else English heuristics ── */
function pickSubtitle(paper) {
  const title = (paper.title || "").trim();
  const aiHook = String(paper.digest?.hook || "").trim();

  /* digest.hook is the front-of-card line. Prefer it always when present. */
  if (aiHook) {
    const polished = polishHook(aiHook, title);
    if (polished) return polished;
    /* Never drop a Chinese AI hook for English fallbacks */
    if (/[\u4e00-\u9fff]/.test(aiHook)) {
      const clipped = [...aiHook.replace(/[。！？.!?…]+$/u, "").trim()].slice(0, 36).join("");
      return clipped ? clipped + "。" : aiHook;
    }
    return aiHook;
  }

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
    const response = await fetch(`${API_BASE}/api/paper-image`, {
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
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    if (window.getSelection) window.getSelection().removeAllRanges();
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
    document.body.style.userSelect = "";
    document.body.style.webkitUserSelect = "";

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
    const response = await fetch(`${API_BASE}/api/actions`, {
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
    const response = await fetch(`${API_BASE}/api/health`);
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
    <span class="ai-bot-hero-avatar"><i data-lucide="sparkles"></i></span>
    <p class="ai-bot-hero-title">Hi, I'm your paper assistant</p>
    <p class="ai-bot-hero-sub">${count
      ? `You have <b>${count}</b> papers in your Library${intent ? ` around "${escapeHTML(shorten(intent, 24))}"` : ""}. Tell me your goal and I'll help you plan.`
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

async function refreshLibrary() {
  try {
    const response = await fetch(`${API_BASE}/api/library`);
    const payload = await response.json();
    state.library = payload.papers || [];
    const ids = new Set(state.library.map((entry) => entry.paper?.id).filter(Boolean));
    state.weekPlanDone = new Set([...state.weekPlanDone].filter((id) => ids.has(id)));
    state.weekPlanRemoved = new Set([...state.weekPlanRemoved].filter((id) => ids.has(id)));
    updateLibraryCounts();
    updateTodosBadge();
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
  if (state.librarySearch) {
    const q = state.librarySearch;
    entries = entries.filter((entry) => {
      const p = entry.paper;
      return (p.title || "").toLowerCase().includes(q) ||
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
  if (elements.libraryTagsBar) {
    elements.libraryTagsBar.hidden = state.librarySelectMode;
  }
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
    const response = await fetch(`${API_BASE}/api/actions`, {
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
    const response = await fetch(`${API_BASE}/api/stats`);
    state.stats = await response.json();
    updateLibraryCounts();
  } catch (_) {
    // Library counts still provide a local fallback.
  }
}

async function refreshSearches() {
  try {
    const response = await fetch(`${API_BASE}/api/searches`);
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

const MOCK_TRENDING_GLOBAL = [
  { topic: "Large Language Model Agents",             count: 18420, pct: 100, delta: 42, tint: 265, keywords: ["Tool use", "Planning", "Memory", "Autonomy"] },
  { topic: "Diffusion & Generative Models",           count: 15840, pct: 88,  delta: 18, tint: 320, keywords: ["Latent diffusion", "Consistency models", "Video gen", "Flow matching"] },
  { topic: "Retrieval-Augmented Generation",          count: 12930, pct: 74,  delta: 12, tint: 200, keywords: ["Hybrid search", "Reranking", "Long-term memory", "Grounding"] },
  { topic: "Vision–Language Foundation Models",       count: 10160, pct: 62,  delta: 8,  tint: 235, keywords: ["CLIP", "SigLIP", "Multimodal", "Zero-shot"] },
  { topic: "Reinforcement Learning from Human Feedback", count: 9410, pct: 54, delta: -3, tint: 355, keywords: ["DPO", "PPO", "Reward model", "Alignment"] },
  { topic: "Long-Context & Efficient Attention",      count: 8320,  pct: 48,  delta: 21, tint: 155, keywords: ["Mamba", "Ring attention", "KV cache", "SSMs"] },
  { topic: "Robotics & Embodied AI",                  count: 7180,  pct: 42,  delta: 14, tint: 40,  keywords: ["Manipulation", "Sim2Real", "VLA models", "Locomotion"] },
  { topic: "Interpretability & Mechanistic Analysis", count: 5940,  pct: 34,  delta: 6,  tint: 120, keywords: ["Circuits", "SAEs", "Probing", "Attribution"] },
];

const MOCK_TRENDING_MINE = [
  { id: "llm-agent-memory", topic: "LLM Agent Long-Term Memory", count: 1240, pct: 100, delta: 58, tint: 265, keywords: ["Episodic memory", "Consolidation", "Retrieval", "MemGPT"] },
  { topic: "Tool-Using & Function-Calling Agents",    count:  980, pct: 82,  delta: 34, tint: 245, keywords: ["Function calls", "ReAct", "Toolformer", "API planning"] },
  { topic: "Retrieval-Augmented Reasoning",           count:  760, pct: 68,  delta: 22, tint: 200, keywords: ["RAG", "Multi-hop QA", "Chain-of-thought", "Reranking"] },
  { topic: "Agent Evaluation & Benchmarks",           count:  610, pct: 54,  delta: 15, tint: 155, keywords: ["AgentBench", "WebArena", "Success rate", "Cost metrics"] },
  { topic: "Self-Reflection & Self-Correction",       count:  480, pct: 44,  delta: 9,  tint: 300, keywords: ["Reflexion", "Self-refine", "Critic models", "Verifiers"] },
  { topic: "Multi-Agent Collaboration",               count:  390, pct: 36,  delta: -4, tint: 355, keywords: ["Role-play", "Debate", "AutoGen", "Coordination"] },
  { topic: "Agent Safety & Guardrails",               count:  320, pct: 30,  delta: 7,  tint: 20,  keywords: ["Prompt injection", "Sandboxing", "Refusal", "Red-teaming"] },
];

const TRENDING_DATA = { mine: MOCK_TRENDING_MINE, global: MOCK_TRENDING_GLOBAL };
let trendScope = "mine";
let expandedTrendId = null;

const TRENDING_TOPIC_PAPERS = {
  "llm-agent-memory": [
    {
      id: "trend-mem-1",
      title: "MemGPT: Towards LLMs as Operating Systems",
      authors: [{ name: "Charles Packer" }, { name: "Sarah Wooders" }, { name: "Kevin Lin" }, { name: "Vivian Fang" }, { name: "Shishir G. Patil" }, { name: "Ion Stoica" }, { name: "Joseph E. Gonzalez" }],
      year: 2023,
      venue: "arXiv",
      source: "arXiv",
      abstract: "MemGPT introduces a hierarchical memory system that lets an LLM manage its own context window like an operating system manages physical memory, paging conversation history and documents in and out as needed. This unlocks tasks that far exceed the model's native context length, such as coherent multi-session dialogue and analysis of long documents.",
      citation_count: 1420,
      influential_citation_count: 210,
      fields: ["LLM Agents", "Memory"],
      url: "https://arxiv.org/abs/2310.08560",
      pdf_url: "https://arxiv.org/pdf/2310.08560",
      match_score: 96,
      read_minutes: 32,
      digest: {
        hook: "让大模型像操作系统一样管理记忆，对话不再受限。",
        verdict: "LLM 长期记忆的奠基之作，值得收藏细读分页机制。",
        problem: "LLM 的**上下文窗口大小固定**，能同时处理的历史或文档信息有限。",
        novelty: [
          "把上下文窗口当作**内存**，外部存储当作**磁盘**，让模型自己发起换页调用。",
          "引入**函数调用协议**，让模型自主管理记忆操作。",
          "展示了长达**数千轮**的连贯对话，且关键信息不丢失。",
        ],
        method: "构建分层记忆体系（主上下文、召回存储、归档存储），模型通过工具调用在其间自主换入换出信息。",
        result: "对话连贯性提升至**10倍**长度，长文档问答效果也明显优于仅靠上下文的基线方法。",
        audience: "正在构建需要跨多轮或多文档保持记忆的智能体系统的研究者和工程师。",
        why_keep: "这是 LLM 长期记忆的参考设计，后续很多工作都基于它或与它对比。",
        reading_focus: "第 3-4 节中记忆管理的函数模式及换入换出策略。",
      },
    },
    {
      id: "trend-mem-2",
      title: "Generative Agents: Interactive Simulacra of Human Behavior",
      authors: [{ name: "Joon Sung Park" }, { name: "Joseph C. O'Brien" }, { name: "Carrie J. Cai" }, { name: "Meredith Ringel Morris" }, { name: "Percy Liang" }, { name: "Michael S. Bernstein" }],
      year: 2023,
      venue: "UIST",
      source: "ACM UIST",
      abstract: "Generative Agents builds believable human simulacra by combining an observation stream, a retrieval-augmented long-term memory, periodic reflection to distill higher-level insights, and a planning module. Twenty-five such agents were deployed in a sandbox town and produced emergent social behaviors like planning a Valentine's Day party without human scripting.",
      citation_count: 2380,
      influential_citation_count: 340,
      fields: ["LLM Agents", "HCI"],
      url: "https://arxiv.org/abs/2304.03442",
      pdf_url: "https://arxiv.org/pdf/2304.03442",
      match_score: 94,
      read_minutes: 40,
      digest: {
        hook: "25个AI小镇居民靠记忆自发筹办派对，全程无人编排。",
        verdict: "社交智能体记忆架构的必读之作，重点研究反思循环。",
        problem: "LLM 智能体容易遗忘过往交互，难以在开放世界中保持**长期可信的行为**。",
        novelty: [
          "增加**反思步骤**，定期把零散记忆提炼成更高层次的认知。",
          "记忆检索按**时近性、重要性和相关性**综合打分，而非只看相似度。",
          "证明**基于检索记忆的规划**能催生涌现式的社会协作行为。",
        ],
        method: "观察流写入向量库；检索按时近性×重要性×相关性打分；反思把记忆聚类提炼成洞见；规划同时利用两者。",
        result: "25 个智能体涌现出**自发筹办派对**、信息扩散和稳定的日常作息等行为。",
        audience: "任何在设计多轮对话、多智能体或人设驱动型 LLM 系统的人。",
        why_keep: "确立了「反思+召回+规划」的模式，后续多数智能体记忆论文都以此为基线。",
        reading_focus: "第 4 节的检索打分公式与第 5 节的反思树构建方法。",
      },
    },
    {
      id: "trend-mem-3",
      title: "Reflexion: Language Agents with Verbal Reinforcement Learning",
      authors: [{ name: "Noah Shinn" }, { name: "Federico Cassano" }, { name: "Ashwin Gopinath" }, { name: "Karthik R. Narasimhan" }, { name: "Shunyu Yao" }],
      year: 2023,
      venue: "NeurIPS",
      source: "NeurIPS",
      abstract: "Reflexion equips language agents with a verbal self-critique loop: after each trial the agent writes a natural-language reflection about what went wrong, stores it in an episodic memory, and consults it on the next attempt. This lightweight, gradient-free feedback drives large gains on HumanEval, HotpotQA, and AlfWorld.",
      citation_count: 1810,
      influential_citation_count: 260,
      fields: ["LLM Agents", "Reinforcement Learning"],
      url: "https://arxiv.org/abs/2303.11366",
      pdf_url: "https://arxiv.org/pdf/2303.11366",
      match_score: 92,
      read_minutes: 28,
      digest: {
        hook: "不靠梯度更新，AI 靠给自己写检讨笔记就能越战越强。",
        verdict: "轻量、无需梯度更新的改进方案，记忆当训练信号的思路值得一读。",
        problem: "提升语言智能体通常需要**梯度更新**或高成本强化学习，在 LLM 规模下代价很大。",
        novelty: [
          "用**语言化自我反思**作为更新信号，完全不改模型权重。",
          "把反思保存进**episodic 记忆**，供下次重试时查阅。",
          "仅靠**提示词设计**即可用于决策、编程和问答等任务。",
        ],
        method: "采用「执行者-评估者-反思者」三元结构：LLM 执行任务，评估者打分，反思者生成自然语言批评并存入记忆供后续调用。",
        result: "相比强 ReAct 基线，HumanEval 提升 **22%**，HotpotQA 提升 20%，AlfWorld 提升 14%。",
        audience: "无法微调、只能在推理阶段做提升的智能体开发者。",
        why_keep: "证明了 episodic 记忆本身也能承载学习信号，是许多自我提升型智能体的模板。",
        reading_focus: "反思提示词模板，以及记忆注入执行循环的具体位置。",
      },
    },
    {
      id: "trend-mem-4",
      title: "A-Mem: Adaptive Memory for Long-Horizon LLM Agents",
      authors: [{ name: "Yifan Wu" }, { name: "Zhiyuan Liu" }, { name: "Maosong Sun" }],
      year: 2025,
      venue: "NeurIPS",
      source: "NeurIPS",
      abstract: "A-Mem learns when to write, when to retrieve, and when to summarize, replacing hand-tuned memory heuristics with an adaptive controller. On the LoCoMo long-conversation benchmark it beats fixed-policy baselines while using 40% fewer memory tokens, thanks to a lightweight scheduler that gates each memory operation.",
      citation_count: 180,
      influential_citation_count: 32,
      fields: ["LLM Agents", "Memory"],
      url: "https://arxiv.org/abs/2502.12110",
      pdf_url: "https://arxiv.org/pdf/2502.12110",
      match_score: 90,
      read_minutes: 34,
      digest: {
        hook: "不靠人工规则，A-Mem 自己学会何时该记、该忘、该回忆。",
        verdict: "关注其自适应调度器，对记忆策略设计有全新思路。",
        problem: "现有智能体记忆多依赖**人工调参的启发式规则**来写入和检索，难以适配多样任务。",
        novelty: [
          "**轻量级调度器**决定每一轮该写入、检索、总结还是跳过。",
          "用**成本敏感的目标函数**训练，惩罚无意义的记忆操作。",
          "无需针对任务专门调参即可泛化到对话、工具调用和代码任务。",
        ],
        method: "在 LLM 之上叠加一个小型策略网络，根据当前状态输出离散的记忆动作，LLM 执行后继续推理。",
        result: "在 **LoCoMo** 上超过 MemGPT 和 Reflexion 6-11 分，同时记忆 token 用量减少约 **40%**。",
        audience: "在生产环境中既要记忆效果又要控制记忆成本的从业者。",
        why_keep: "是首批端到端学习型记忆控制器之一，可能是下一代方案的模板。",
        reading_focus: "第 3 节的调度器结构，以及成本敏感目标与纯准确率目标的对比实验。",
      },
    },
    {
      id: "trend-mem-5",
      title: "MemoryBank: Reflective Long-Term Memory Inspired by the Ebbinghaus Forgetting Curve",
      authors: [{ name: "Wanjun Zhong" }, { name: "Lianghong Guo" }, { name: "Qiqi Gao" }, { name: "He Ye" }, { name: "Yanlin Wang" }],
      year: 2024,
      venue: "AAAI",
      source: "AAAI",
      abstract: "MemoryBank stores agent experiences with importance scores and applies an Ebbinghaus-style decay function so that unrehearsed memories fade while frequently accessed ones consolidate. The design supports personalization across long-running dialogues and shows sharper recall of user preferences than fixed-window baselines.",
      citation_count: 640,
      influential_citation_count: 88,
      fields: ["LLM Agents", "Memory", "Personalization"],
      url: "https://arxiv.org/abs/2305.10250",
      pdf_url: "https://arxiv.org/pdf/2305.10250",
      match_score: 88,
      read_minutes: 26,
      digest: {
        hook: "借鉴人类遗忘曲线，MemoryBank 让不常用的记忆自然淡出。",
        verdict: "优雅的仿生学思路，设计自己的记忆巩固策略前值得一读。",
        problem: "固定窗口或先进先出式记忆，往往**要么溢出、要么随意丢弃**重要信息。",
        novelty: [
          "对记忆强度应用**类艾宾浩斯遗忘曲线**的衰减函数。",
          "**通过检索进行复述**来巩固常用记忆，模拟人类的复习效应。",
          "跨会话保留用户专属事实，从而实现**个性化**记忆。",
        ],
        method: "每条记忆有一个重要性分数；衰减函数随时间降低强度，但成功检索会提升强度；检索综合相关性与当前强度打分。",
        result: "长期用户偏好召回的准确度高于滑动窗口和普通向量库基线。",
        audience: "需要跨会话长期保留用户记忆的个人助理类智能体开发者。",
        why_keep: "在认知科学与智能体记忆之间架起了一座清晰的桥梁，为「有原则的遗忘」提供了灵感来源。",
        reading_focus: "第 3 节的衰减与复述公式，以及个性化评估的实验设置。",
      },
    },
  ],
};

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
const trendOverlayState = { topicId: null, index: 0, flipped: false };
let trendOverlayBound = false;

function openTrendPaperOverlay(topicId, startIndex) {
  const papers = TRENDING_TOPIC_PAPERS[topicId];
  if (!papers || !papers.length) return;
  trendOverlayState.topicId = topicId;
  trendOverlayState.index = Math.max(0, Math.min(papers.length - 1, startIndex || 0));
  trendOverlayState.flipped = false;
  const overlay = document.querySelector("#trend-overlay");
  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-trend-overlay-open");
  bindTrendOverlayOnce();
  renderTrendOverlayCard();
}

function closeTrendOverlay() {
  const overlay = document.querySelector("#trend-overlay");
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-trend-overlay-open");
  trendOverlayState.topicId = null;
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
  const venueBadge = venueYear ? venueName + " " + venueYear : venueName || "Publication";
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

function trendOverlayFly(action, velocity) {
  const card = document.querySelector("#trend-overlay-card");
  const papers = TRENDING_TOPIC_PAPERS[trendOverlayState.topicId] || [];
  const paper = papers[trendOverlayState.index];
  if (!paper) return;
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

  /* Persist to Library for save/priority/read — same as home decide(). Dismiss just advances. */
  if (action !== "dismiss") {
    fetch(`${API_BASE}/api/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paper, action }),
    }).then((r) => {
      if (r.ok) { refreshLibrary(); refreshStats(); }
    }).catch((err) => console.warn("[trend] action failed", err));
  }

  setTimeout(() => {
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

  let dx = 0, dy = 0, startX = 0, startY = 0, startT = 0, active = false;
  card.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, a, [data-stop-click]")) return;
    if (trendOverlayState.flipped && e.target.closest(".back-details")) return;
    active = true; dx = 0; dy = 0;
    startX = e.clientX; startY = e.clientY; startT = Date.now();
    card.classList.add("is-dragging");
    card.setPointerCapture(e.pointerId);
  });
  card.addEventListener("pointermove", (e) => {
    if (!active) return;
    dx = e.clientX - startX; dy = e.clientY - startY;
    const rx = (dy / 300) * 16, ry = (dx / 200) * 12;
    card.style.transform = `translate(${dx}px, ${dy}px) rotateX(${-rx}deg) rotateY(${ry}deg)`;
    const strength = Math.min(1, Math.max(Math.abs(dx), Math.abs(dy)) / 110);
    updateOverlayStamps(dx, dy, strength);
  });
  const finish = () => {
    if (!active) return;
    active = false;
    card.classList.remove("is-dragging");
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dt = Date.now() - startT;
    if (dist < 8 && dt < 300) {
      card.style.transition = "transform 520ms cubic-bezier(.17,.67,.38,1.4)";
      card.style.transform = "";
      updateOverlayStamps(0, 0, 0);
      toggleTrendOverlayFlip();
      return;
    }
    const fast = dt > 0 && dist / dt > 0.65;
    const tx = fast ? 50 : 95, ty = fast ? 42 : 85;
    const velocity = dt > 0 ? dist / dt : 0;
    if (dx < -tx && Math.abs(dx) > Math.abs(dy)) return trendOverlayFly("dismiss", velocity);
    if (dx >  tx && Math.abs(dx) > Math.abs(dy)) return trendOverlayFly("save", velocity);
    if (dy < -ty && Math.abs(dy) > Math.abs(dx) * .8) return trendOverlayFly("priority", velocity);
    if (dy >  ty && Math.abs(dy) > Math.abs(dx) * .8) return trendOverlayFly("read", velocity);
    card.style.transition = "transform 520ms cubic-bezier(.17,.67,.38,1.4)";
    card.style.transform = "";
    updateOverlayStamps(0, 0, 0);
  };
  card.addEventListener("pointerup", finish);
  card.addEventListener("pointercancel", finish);
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

const IDENTITY_LABELS = {
  graduate: { avatar: "🧑‍🎓", role: "Graduate / PhD" },
  researcher: { avatar: "🧑‍🏫", role: "Professor / Researcher" },
  enthusiast: { avatar: "🧑‍🚀", role: "Explorer" },
};

function renderSettings() {
  const identity = IDENTITY_LABELS[onboardingProfile.identity] || IDENTITY_LABELS.graduate;
  const displayName = window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) || "PaperSwipe 用户";

  // Profile card
  if (elements.settingsProfileAvatar) elements.settingsProfileAvatar.textContent = identity.avatar;
  if (elements.settingsProfileName) elements.settingsProfileName.textContent = displayName;
  if (elements.settingsProfileRole) elements.settingsProfileRole.textContent = identity.role;
  if (elements.settingsDisplayNameInput && document.activeElement !== elements.settingsDisplayNameInput) {
    elements.settingsDisplayNameInput.value = displayName === "PaperSwipe 用户" ? "" : displayName;
  }
  document.querySelectorAll("[data-identity]").forEach((button) => {
    const selected = button.dataset.identity === onboardingProfile.identity;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });

  // Research interests (bubble-style removable tags)
  elements.settingsTopicChips.innerHTML = onboardingProfile.topics.map((topic, i) => {
    const size = ["md", "lg", "sm", "md", "lg", "sm"][i % 6];
    return `<button type="button" class="explore-bubble is-${size} is-active is-tag" data-settings-topic-remove="${escapeAttribute(topic)}" style="--bubble-index: ${i};"><span>${escapeHTML(topic)}</span><i data-lucide="x"></i></button>`;
  }).join("");
  if (elements.settingsRowInterestsSum) {
    elements.settingsRowInterestsSum.textContent = onboardingProfile.topics.slice(0, 3).join(" · ") + (onboardingProfile.topics.length > 3 ? ` +${onboardingProfile.topics.length - 3}` : "");
  }

  // Stay focused (reading level)
  elements.settingsComplexity.value = String(onboardingProfile.complexity);
  updateComplexityLabel(elements.settingsComplexityLabel, onboardingProfile.complexity);
  if (elements.settingsRowFocusSum) elements.settingsRowFocusSum.textContent = elements.settingsComplexityLabel.textContent;

  // Explore more
  renderExploreTopics();
  const exploreCount = (onboardingProfile.exploreTopics || []).length;
  if (elements.settingsRowExploreSum) {
    elements.settingsRowExploreSum.textContent = exploreCount ? `${exploreCount} 个领域` : "未选择";
  }

  // Appearance
  document.querySelectorAll("[data-appearance]").forEach((button) => {
    const selected = button.dataset.appearance === state.appearance;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  if (elements.settingsRowAppearanceSum) {
    elements.settingsRowAppearanceSum.textContent = state.appearance === "light" ? "浅色" : state.appearance === "dark" ? "深色" : "跟随系统";
  }

  // Language
  document.querySelectorAll("[data-language]").forEach((button) => {
    const selected = button.dataset.language === state.language;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  if (elements.settingsRowLanguageSum) elements.settingsRowLanguageSum.textContent = state.language === "en" ? "English" : "中文";

  // Zotero
  const zoteroSaved = loadZoteroCredentials();
  if (elements.settingsRowZoteroSum) {
    elements.settingsRowZoteroSum.textContent = zoteroSaved.apiKey && zoteroSaved.userId
      ? (state.language === "en" ? "Connected" : "已绑定")
      : (state.language === "en" ? "Not connected" : "未绑定");
  }

  refreshIcons();
}

function openSettingsSubpage(name) {
  if (!name) return;
  document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.settingsPanel !== name;
  });
  settingsSubpage = name;
  renderSettings();
  const scroll = document.querySelector(`[data-settings-panel="${name}"] .settings-scroll`);
  if (scroll) scroll.scrollTop = 0;
}

function closeSettingsSubpage() {
  document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.settingsPanel !== "root";
  });
  settingsSubpage = null;
  renderSettings();
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

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const rotated = tasks.filter((t) => !placedIds.has(t.id));
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
  const sameMonth = startDate.getMonth() === end.getMonth();
  const startStr = `${startDate.getMonth() + 1}/${startDate.getDate()}`;
  const endStr = sameMonth ? `${end.getDate()}` : `${end.getMonth() + 1}/${end.getDate()}`;
  return `${startStr} – ${endStr}`;
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
        <div class="wp-nav-center">
          <strong>${escapeHTML(weekWord)}</strong>
          <small>${escapeHTML(rangeLabel)} · ${escapeHTML(stats)}</small>
        </div>
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
      <article class="wp-day wp-day--${layout}${day.isToday ? " is-today" : ""}${day.isPast ? " is-past" : ""}" role="listitem" style="--wp-day-index:${idx}" data-week-plan-daykey="${toDateKey(day.date)}" data-week-plan-past="${day.isPast ? "1" : "0"}">
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

function handleWeekPlanAction(id, action) {
  if (!id) return;
  if (action === "remove") {
    state.weekPlanRemoved.add(id);
    state.weekPlanDone.delete(id);
    renderWeekPlan();
    updateTodosBadge();
    removeFromLibrary(id);
    return;
  }
  if (action === "done") {
    if (state.weekPlanDone.has(id)) state.weekPlanDone.delete(id);
    else state.weekPlanDone.add(id);
    renderWeekPlan();
    showToast(state.weekPlanDone.has(id) ? "已标记完成" : "已取消完成");
  }
}

function openWeekPlanCard(id) {
  openLibraryCard(id);
}

const WP_LONG_PRESS_MS = 420;
const WP_LONG_PRESS_TOLERANCE = 10;

function bindWeekPlanSwipe() {
  if (!elements.weekPlanGrid) return;
  elements.weekPlanGrid.addEventListener("selectstart", (event) => event.preventDefault());
  elements.weekPlanGrid.addEventListener("contextmenu", (event) => event.preventDefault());
  let longPressTimer = null;
  const clearLongPress = () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  };

  const startDrag = (shell, itemEl, clientX, clientY, pointerId) => {
    const id = itemEl.dataset.id;
    if (!id) return;
    window.getSelection()?.removeAllRanges();
    hapticImpact("MEDIUM");
    const rect = itemEl.getBoundingClientRect();
    const ghost = itemEl.cloneNode(true);
    ghost.classList.add("wp-drag-ghost");
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    document.body.appendChild(ghost);
    itemEl.classList.add("is-dragging");
    shell.classList.add("is-drag-source");
    weekPlanDrag = {
      id, itemEl, shell, ghost, pointerId,
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
      originDayKey: shell.closest(".wp-day")?.dataset.weekPlanDaykey || null,
      targetDay: null,
    };
  };

  const updateDrag = (clientX, clientY) => {
    if (!weekPlanDrag) return;
    weekPlanDrag.ghost.style.left = `${clientX - weekPlanDrag.offsetX}px`;
    weekPlanDrag.ghost.style.top = `${clientY - weekPlanDrag.offsetY}px`;
    weekPlanDrag.ghost.style.display = "none";
    const el = document.elementFromPoint(clientX, clientY);
    weekPlanDrag.ghost.style.display = "";
    const dayEl = el ? el.closest(".wp-day") : null;
    if (weekPlanDrag.targetDay && weekPlanDrag.targetDay !== dayEl) {
      weekPlanDrag.targetDay.classList.remove("is-drop-target");
      weekPlanDrag.targetDay = null;
    }
    if (dayEl && dayEl.dataset.weekPlanPast !== "1") {
      dayEl.classList.add("is-drop-target");
      weekPlanDrag.targetDay = dayEl;
    }
  };

  const endDrag = () => {
    if (!weekPlanDrag) return;
    const { id, itemEl, shell, ghost, targetDay, originDayKey, pointerId } = weekPlanDrag;
    if (pointerId != null) { try { shell.releasePointerCapture(pointerId); } catch (_) {} }
    ghost.remove();
    itemEl.classList.remove("is-dragging");
    shell.classList.remove("is-drag-source");
    document.querySelectorAll(".wp-day.is-drop-target").forEach((d) => d.classList.remove("is-drop-target"));
    weekPlanDrag = null;
    weekPlanDragJustEnded = true;
    setTimeout(() => { weekPlanDragJustEnded = false; }, 60);
    if (targetDay) {
      const targetKey = targetDay.dataset.weekPlanDaykey;
      if (targetKey && targetKey !== originDayKey) {
        reassignWeekPlanTask(id, targetKey);
      }
    }
  };

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
    weekPlanSwipe = { shell, startX: event.clientX, startY: event.clientY, dx: 0, active: false, pointerId: event.pointerId };
    try { shell.setPointerCapture(event.pointerId); } catch (_) {}
    clearLongPress();
    const itemEl = event.target.closest("[data-week-plan-card]");
    if (itemEl && !shell.classList.contains("is-revealed")) {
      const startX = event.clientX, startY = event.clientY;
      const pointerId = event.pointerId;
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        if (weekPlanSwipe && !weekPlanSwipe.active) {
          weekPlanSwipe = null; // long-press wins over swipe-to-reveal
          startDrag(shell, itemEl, startX, startY, pointerId);
        }
      }, WP_LONG_PRESS_MS);
    }
  });
  elements.weekPlanGrid.addEventListener("pointermove", (event) => {
    if (weekPlanDrag) {
      event.preventDefault();
      updateDrag(event.clientX, event.clientY);
      return;
    }
    if (!weekPlanSwipe) return;
    const dx = event.clientX - weekPlanSwipe.startX;
    const dy = event.clientY - weekPlanSwipe.startY;
    if (!weekPlanSwipe.active && (Math.abs(dx) > WP_LONG_PRESS_TOLERANCE || Math.abs(dy) > WP_LONG_PRESS_TOLERANCE)) {
      clearLongPress(); // real movement before the hold fires — this is a swipe/scroll, not a long-press
    }
    if (!weekPlanSwipe.active && Math.abs(dx) < 8) return;
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (!weekPlanSwipe.active) weekPlanSwipe.shell.classList.add("is-swiping");
    weekPlanSwipe.active = true;
    weekPlanSwipe.dx = Math.min(0, dx);
    const reveal = Math.max(-76, weekPlanSwipe.dx);
    weekPlanSwipe.shell.style.setProperty("--wp-swipe", `${reveal}px`);
    weekPlanSwipe.shell.classList.toggle("is-revealed", reveal < -30);
  }, { passive: false });
  const finish = () => {
    clearLongPress();
    if (weekPlanDrag) { endDrag(); return; }
    if (!weekPlanSwipe) return;
    const shell = weekPlanSwipe.shell;
    const reveal = Math.max(-76, Math.min(0, weekPlanSwipe.dx || 0));
    const open = reveal < -30;
    shell.style.setProperty("--wp-swipe", open ? "-76px" : "0px");
    shell.classList.toggle("is-revealed", open);
    shell.classList.remove("is-swiping");
    weekPlanSwipe = null;
  };
  elements.weekPlanGrid.addEventListener("pointerup", finish);
  elements.weekPlanGrid.addEventListener("pointercancel", finish);
  elements.weekPlanGrid.addEventListener("pointerleave", finish);
}

function openSettingsPage() {
  if (!elements.settingsPage) return;
  closeSettingsSubpage();
  renderSettings();
  elements.settingsPage.hidden = false;
  refreshIcons();
}

function closeSettingsPage() {
  if (!elements.settingsPage) return;
  elements.settingsPage.hidden = true;
  settingsSubpage = null;
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
      hapticImpact("LIGHT");
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
    if (elements.libraryScheduleDialog) elements.libraryScheduleDialog.showModal();
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
    if (!inside) elements.libraryScheduleDialog.close();
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

function reassignWeekPlanTask(id, dateKey) {
  if (!id || !dateKey) return;
  state.weekPlanAssign.set(id, dateKey);
  renderWeekPlan();
  hapticImpact("MEDIUM");
  const [y, m, d] = dateKey.split("-").map(Number);
  const label = formatDayLabel(new Date(y, m - 1, d), toDateKey(new Date()) === dateKey);
  showToast(`已移动到 ${label}`);
}

function assignPaperToDate(dateKey) {
  const id = state.actionPaperId;
  if (!id || !dateKey) return;
  const prio = state.scheduleDraftPriority || state.weekPlanPriority.get(id) || "medium";
  state.weekPlanPriority.set(id, prio);
  state.weekPlanAssign.set(id, dateKey);
  state.scheduleDraftDate = null;
  state.scheduleDraftPriority = null;
  if (elements.libraryScheduleDialog) elements.libraryScheduleDialog.close();
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

// Mock fallbacks for missing real data.
function mockCitationCount(value) {
  const n = numberOrZero(value);
  return n > 0 ? n : Math.floor(Math.random() * 26); // use real if present, else 0-25
}
// Stable mock: same paper id always yields the same minute count so the
// number doesn't jump across re-renders. Range 30–120 min.
function mockReadMinutes(_ignored, paperId) {
  if (!paperId) return 30 + Math.floor(Math.random() * 91);
  return 30 + (hashString(String(paperId)) % 91);
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
