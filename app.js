const SHARED_PASSWORD = "1234";
const STORAGE_KEY = "ns-multistream-streamers";

const state = {
  streamers: [],
  activeStreams: [],
  search: "",
  focusId: null,
};

const embedParent = window.location.hostname || "localhost";

const elements = {
  loaderScreen: document.getElementById("loaderScreen"),
  authScreen: document.getElementById("authScreen"),
  appScreen: document.getElementById("appScreen"),
  loginForm: document.getElementById("loginForm"),
  passwordInput: document.getElementById("passwordInput"),
  authError: document.getElementById("authError"),
  toggleSidebarButton: document.getElementById("toggleSidebarButton"),
  workspace: document.querySelector(".workspace"),
  sidebar: document.getElementById("sidebar"),
  streamerList: document.getElementById("streamerList"),
  searchInput: document.getElementById("searchInput"),
  openAddModalButton: document.getElementById("openAddModalButton"),
  closeAddModalButton: document.getElementById("closeAddModalButton"),
  addStreamerModal: document.getElementById("addStreamerModal"),
  addStreamerForm: document.getElementById("addStreamerForm"),
  formError: document.getElementById("formError"),
  streamGrid: document.getElementById("streamGrid"),
  emptyState: document.getElementById("emptyState"),
  streamStage: document.getElementById("streamStage"),
};

function createDefaultStreamers() {
  return [
    {
      id: crypto.randomUUID(),
      name: "Twitch Exemple",
      logo: "./assets/logo-ns.png",
      url: "https://www.twitch.tv/riotgames",
    },
    {
      id: crypto.randomUUID(),
      name: "YouTube Exemple",
      logo: "./assets/logo-ns.png",
      url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    },
  ];
}

function loadStreamers() {
  const saved = window.localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    state.streamers = createDefaultStreamers();
    persistStreamers();
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    state.streamers = Array.isArray(parsed) ? parsed : createDefaultStreamers();
  } catch {
    state.streamers = createDefaultStreamers();
    persistStreamers();
  }
}

function persistStreamers() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.streamers));
}

function showScreen(screen) {
  for (const view of [elements.loaderScreen, elements.authScreen, elements.appScreen]) {
    view.classList.add("hidden");
  }

  screen.classList.remove("hidden");
}

function bootSequence() {
  showScreen(elements.loaderScreen);

  window.setTimeout(() => {
    showScreen(elements.authScreen);
    elements.passwordInput.focus();
  }, 2400);
}

function normalizeUrl(value) {
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function parsePlatform(url) {
  try {
    const value = new URL(url);
    const host = value.hostname.replace("www.", "");

    if (host.includes("twitch.tv")) {
      const segments = value.pathname.split("/").filter(Boolean);
      if (segments[0] === "videos" || segments[0] === "directory") {
        return null;
      }

      return {
        platform: "twitch",
        channel: segments[0],
        embed: `https://player.twitch.tv/?channel=${segments[0]}&parent=${embedParent}`,
        liveLabel: "Verification embed Twitch",
      };
    }

    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      const videoId =
        value.searchParams.get("v") ||
        (host === "youtu.be" ? value.pathname.split("/").filter(Boolean)[0] : null) ||
        value.pathname.split("/").filter(Boolean)[1];

      if (!videoId) {
        return null;
      }

      return {
        platform: "youtube",
        channel: videoId,
        embed: `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`,
        liveLabel: "Flux YouTube charge",
      };
    }

    return {
      platform: "custom",
      channel: url,
      embed: url,
      liveLabel: "Lien externe",
    };
  } catch {
    return null;
  }
}

function getFilteredStreamers() {
  const search = state.search.trim().toLowerCase();

  if (!search) {
    return state.streamers;
  }

  return state.streamers.filter((streamer) =>
    streamer.name.toLowerCase().includes(search)
  );
}

function isActive(streamerId) {
  return state.activeStreams.some((stream) => stream.id === streamerId);
}

function renderStreamerList() {
  const filtered = getFilteredStreamers();

  if (!filtered.length) {
    elements.streamerList.innerHTML =
      '<div class="streamer-list-item"><div></div><div><h4>Aucun resultat</h4><p>Aucun profil ne correspond a la recherche.</p></div></div>';
    return;
  }

  elements.streamerList.innerHTML = filtered
    .map((streamer) => {
      const active = isActive(streamer.id);

      return `
        <button class="streamer-list-item" type="button" data-streamer-id="${streamer.id}">
          <img src="${streamer.logo}" alt="${escapeHtml(streamer.name)}" />
          <div>
            <h4>${escapeHtml(streamer.name)}</h4>
            <p>${active ? "Deja ouvert" : "Cliquer pour afficher le live"}</p>
          </div>
          <small class="status-pill ${active ? "" : "offline"}">${active ? "Actif" : "Pret"}</small>
        </button>
      `;
    })
    .join("");
}

function renderStreams() {
  const count = state.activeStreams.length;
  elements.emptyState.classList.toggle("hidden", count > 0);
  elements.streamGrid.className = `stream-grid ${count ? `layout-${Math.min(count, 6)}` : ""}`;

  if (!count) {
    elements.streamGrid.innerHTML = "";
    removeFocusExitButton();
    return;
  }

  elements.streamGrid.innerHTML = state.activeStreams
    .map((streamer) => {
      const focused = state.focusId === streamer.id;
      const embedData = parsePlatform(streamer.url);
      const statusText = embedData?.platform === "twitch" ? "Canal connecte" : "Flux charge";

      return `
        <article class="stream-card ${focused ? "focus-mode" : ""}" data-stream-id="${streamer.id}">
          <iframe
            src="${embedData ? embedData.embed : streamer.url}"
            allowfullscreen
            allow="autoplay; fullscreen; picture-in-picture"
            referrerpolicy="origin"
            title="${escapeHtml(streamer.name)}"
          ></iframe>
          <div class="stream-overlay">
            <div class="stream-overlay-top">
              <div class="streamer-meta">
                <img src="${streamer.logo}" alt="${escapeHtml(streamer.name)}" />
                <div>
                  <p class="stream-label">En lecture</p>
                  <h4>${escapeHtml(streamer.name)}</h4>
                </div>
              </div>
              <span class="status-pill">${statusText}</span>
            </div>
            <div class="stream-overlay-bottom">
              <span class="stream-label">Survol pour les controles</span>
              <div class="stream-actions">
                <button class="stream-control" type="button" data-action="focus" data-stream-id="${streamer.id}" aria-label="Mettre en grand ecran">
                  ⛶
                </button>
                <button class="stream-control danger" type="button" data-action="remove" data-stream-id="${streamer.id}" aria-label="Supprimer le live">
                  ↪
                </button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  renderFocusExitButton();
}

function renderFocusExitButton() {
  removeFocusExitButton();

  if (!state.focusId) {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.id = "focusExitButton";
  button.className = "focus-exit";
  button.textContent = "←";
  button.setAttribute("aria-label", "Quitter le grand ecran");
  button.addEventListener("click", () => {
    state.focusId = null;
    renderStreams();
  });

  elements.streamStage.appendChild(button);
}

function removeFocusExitButton() {
  const existing = document.getElementById("focusExitButton");
  if (existing) {
    existing.remove();
  }
}

function openStream(streamerId) {
  const streamer = state.streamers.find((item) => item.id === streamerId);
  if (!streamer || isActive(streamerId)) {
    return;
  }

  state.activeStreams = [...state.activeStreams, streamer].slice(0, 6);
  renderStreamerList();
  renderStreams();
}

function removeStream(streamerId) {
  state.activeStreams = state.activeStreams.filter((stream) => stream.id !== streamerId);
  if (state.focusId === streamerId) {
    state.focusId = null;
  }

  renderStreamerList();
  renderStreams();
}

function toggleSidebar() {
  elements.workspace.classList.toggle("sidebar-open");
}

function openModal() {
  elements.addStreamerModal.classList.remove("hidden");
  elements.addStreamerModal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  elements.addStreamerModal.classList.add("hidden");
  elements.addStreamerModal.setAttribute("aria-hidden", "true");
  elements.addStreamerForm.reset();
  elements.formError.textContent = "";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function addStreamer(event) {
  event.preventDefault();
  elements.formError.textContent = "";

  const formData = new FormData(elements.addStreamerForm);
  const logo = normalizeUrl(String(formData.get("logo") || "").trim());
  const name = String(formData.get("name") || "").trim();
  const url = normalizeUrl(String(formData.get("url") || "").trim());

  if (!logo || !url || !name) {
    elements.formError.textContent = "Tous les champs doivent etre valides.";
    return;
  }

  const embedData = parsePlatform(url);
  if (!embedData) {
    elements.formError.textContent =
      "Le lien n'est pas compatible. Utilisez Twitch, YouTube ou un lien d'embed direct.";
    return;
  }

  state.streamers.unshift({
    id: crypto.randomUUID(),
    name,
    logo,
    url,
  });

  persistStreamers();
  renderStreamerList();
  closeModal();
}

function handleLogin(event) {
  event.preventDefault();
  const password = elements.passwordInput.value.trim();

  if (password !== SHARED_PASSWORD) {
    elements.authError.textContent = "Mot de passe incorrect.";
    return;
  }

  elements.authError.textContent = "";
  showScreen(elements.appScreen);
  renderStreamerList();
  renderStreams();
}

function handleStreamerListClick(event) {
  const button = event.target.closest("[data-streamer-id]");
  if (!button) {
    return;
  }

  openStream(button.dataset.streamerId);
}

function handleStreamGridClick(event) {
  const action = event.target.closest("[data-action]");
  if (!action) {
    return;
  }

  const { action: actionName, streamId } = action.dataset;

  if (actionName === "remove") {
    removeStream(streamId);
    return;
  }

  if (actionName === "focus") {
    state.focusId = streamId;
    renderStreams();
  }
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.toggleSidebarButton.addEventListener("click", toggleSidebar);
  elements.openAddModalButton.addEventListener("click", openModal);
  elements.closeAddModalButton.addEventListener("click", closeModal);
  elements.addStreamerForm.addEventListener("submit", addStreamer);
  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderStreamerList();
  });
  elements.streamerList.addEventListener("click", handleStreamerListClick);
  elements.streamGrid.addEventListener("click", handleStreamGridClick);
  elements.addStreamerModal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeModal === "true") {
      closeModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!elements.addStreamerModal.classList.contains("hidden")) {
        closeModal();
        return;
      }

      if (state.focusId) {
        state.focusId = null;
        renderStreams();
      }
    }
  });
}

loadStreamers();
bindEvents();
bootSequence();
