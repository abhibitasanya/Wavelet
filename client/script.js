console.log("Wavelet — UI Auth + per-user likes/playlists ✅");

const API_BASE = "https://wavelet-backend-1cdr.onrender.com";
const TOKEN_KEY = "wavelet_token";

/* =======================
   STATE
======================= */
let songs = [];
let likes = new Set();
let playlists = [];
let meUser = null;

let currentSongIndex = 0;
let currentView = "home"; // home | liked | playlist
let currentPlaylistId = null;

let isPlaying = false;

let isShuffle = false;
let repeatMode = "off"; // off | all | one
let queue = [];

const RECENT_KEY = "wavelet_recent";
let recent = [];
const RECENT_LIMIT = 10;

const CONTINUE_KEY = "wavelet_continue";
let continueMap = {};

const PLAYCOUNT_KEY = "wavelet_playcount";
let playCount = {};

let playCountArmed = false;
let playCountMarked = false;

const audio = new Audio();

/* =======================
   ELEMENTS
======================= */
const playBtn = document.getElementById("playBtn");
const playIcon = document.getElementById("playIcon");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const shuffleBtn = document.getElementById("shuffleBtn");
const repeatBtn = document.getElementById("repeatBtn");
const queueBtn = document.getElementById("queueBtn");

const songTitle = document.getElementById("songTitle");
const songArtist = document.getElementById("songArtist");
const albumArt = document.getElementById("albumArt");
const albumWrapper = document.querySelector(".albumWrapper");

const songListEl = document.getElementById("songList");

const progressBar = document.getElementById("progressBar");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");

const volumeBar = document.getElementById("volumeBar");
const muteBtn = document.getElementById("muteBtn");
const muteIcon = document.getElementById("muteIcon");

const searchInput = document.getElementById("searchInput");

const homeTab = document.getElementById("homeTab");
const searchTab = document.getElementById("searchTab");
const libraryTab = document.getElementById("libraryTab");

const likedSongsBtn = document.getElementById("likedSongsBtn");
const playlistListEl = document.getElementById("playlistList");
const playlistSelect = document.getElementById("playlistSelect");

const newPlaylistName = document.getElementById("newPlaylistName");
const createPlaylistBtn = document.getElementById("createPlaylistBtn");

const renamePlaylistInput = document.getElementById("renamePlaylistInput");
const renamePlaylistBtn = document.getElementById("renamePlaylistBtn");

const addToPlaylistBtn = document.getElementById("addToPlaylistBtn");
const removeFromPlaylistBtn = document.getElementById("removeFromPlaylistBtn");
const deletePlaylistBtn = document.getElementById("deletePlaylistBtn");

const queuePanel = document.getElementById("queuePanel");
const queueList = document.getElementById("queueList");
const closeQueueBtn = document.getElementById("closeQueueBtn");


const playlistsGrid = document.getElementById("playlistsGrid");


/* Home sections (optional; if not in HTML, code safely ignores) */
const recentSection = document.getElementById("recentSection");
const recentList = document.getElementById("recentList");
const continueSection = document.getElementById("continueSection");
const continueList = document.getElementById("continueList");
const mostSection = document.getElementById("mostSection");
const mostList = document.getElementById("mostList");
const recSection = document.getElementById("recSection");
const recList = document.getElementById("recList");

/* Header (added earlier) */
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");

/* Step 6: Library cards */
const libraryGrid = document.getElementById("libraryGrid");
const likedCard = document.getElementById("likedCard");
const playlistsCard = document.getElementById("playlistsCard");
const listTitle = document.getElementById("listTitle");

/* Auth UI */
const authModal = document.getElementById("authModal");
const closeAuth = document.getElementById("closeAuth");
const loginTabBtn = document.getElementById("loginTabBtn");
const registerTabBtn = document.getElementById("registerTabBtn");
const authUsername = document.getElementById("authUsername");
const authPassword = document.getElementById("authPassword");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authMsg = document.getElementById("authMsg");

const userLabel = document.getElementById("userLabel");
const logoutBtn = document.getElementById("logoutBtn");

let authMode = "login"; // login | register

/* =======================
   HEADER
======================= */
function setHeader(title, subtitle = "") {
  if (!pageTitle || !pageSubtitle) return;
  pageTitle.textContent = title;
  pageSubtitle.textContent = subtitle;
}

/* =======================
   STEP 6: LIBRARY UI
======================= */
function updateLibraryUI() {
  if (!libraryGrid || !listTitle) return;

  const showGrid = currentView === "liked" || currentView === "playlist";
  libraryGrid.style.display = showGrid ? "grid" : "none";

  if (currentView === "liked") listTitle.textContent = "Liked Songs";
  else if (currentView === "playlist") listTitle.textContent = "Playlist";
  else listTitle.textContent = "Playlist";
}

/* =======================
   AUTH HELPERS
======================= */
function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}
function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch(path, opts = {}) {
  const token = getToken();
  const headers = opts.headers ? { ...opts.headers } : {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  if (opts.json) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.json);
    delete opts.json;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = data && data.error ? data.error : `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function showAuthModal(show = true) {
  if (!authModal) return;
  authModal.classList.toggle("hidden", !show);
  if (authMsg) authMsg.textContent = "";
  if (authPassword) authPassword.value = "";
}


function renderPlaylistsGrid() {
  if (!playlistsGrid) return;

  const show = currentView === "liked" || currentView === "playlist";
  playlistsGrid.style.display = show ? "grid" : "none";

  playlistsGrid.innerHTML = "";

  if (!playlists.length) {
    playlistsGrid.innerHTML = `
      <div style="color:#aaa;font-size:13px;">
        No playlists yet. Create one from the sidebar.
      </div>
    `;
    return;
  }

  playlists.forEach((pl) => {
    const card = document.createElement("div");
    card.className = "libCard";
    card.innerHTML = `
      <div class="libIcon"><i class="fa-solid fa-music"></i></div>
      <div class="libMeta">
        <div class="t">${pl.name}</div>
        <div class="s">${pl.tracks.length} songs</div>
      </div>
    `;
    card.onclick = () => {
      currentView = "playlist";
      currentPlaylistId = String(pl.id);
      if (renamePlaylistInput) renamePlaylistInput.value = pl.name;
      if (searchInput) searchInput.value = "";
      setActiveTab("library");
      setHeader(pl.name, "Playlist");
      renderCurrentView();
    };
    playlistsGrid.appendChild(card);
  });
}




function setAuthTab(mode) {
  authMode = mode;
  if (loginTabBtn) loginTabBtn.classList.toggle("active", mode === "login");
  if (registerTabBtn) registerTabBtn.classList.toggle("active", mode === "register");
  if (authSubmitBtn) authSubmitBtn.textContent = mode === "login" ? "Login" : "Register";
}

/* =======================
   STORAGE
======================= */
function loadRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = JSON.parse(raw || "[]");
    recent = Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    recent = [];
  }
}
function saveRecent() {
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, RECENT_LIMIT)));
}
function addToRecent(id) {
  id = String(id);
  recent = recent.filter((x) => x !== id);
  recent.unshift(id);
  recent = recent.slice(0, RECENT_LIMIT);
  saveRecent();
}

function loadContinue() {
  try {
    continueMap = JSON.parse(localStorage.getItem(CONTINUE_KEY) || "{}");
  } catch {
    continueMap = {};
  }
}
function saveContinue() {
  localStorage.setItem(CONTINUE_KEY, JSON.stringify(continueMap));
}

function loadPlayCount() {
  try {
    playCount = JSON.parse(localStorage.getItem(PLAYCOUNT_KEY) || "{}");
  } catch {
    playCount = {};
  }
}
function savePlayCount() {
  localStorage.setItem(PLAYCOUNT_KEY, JSON.stringify(playCount));
}
function bumpPlayCount(id) {
  if (!id) return;
  id = String(id);
  playCount[id] = (playCount[id] || 0) + 1;
  savePlayCount();
}

/* =======================
   FETCH
======================= */
async function fetchSongs() {
  songs = await apiFetch(`/api/songs?limit=30`);
  songs = songs.map((s) => ({
    id: String(s.id),
    title: s.title || "Unknown Title",
    artist: s.artist || "Unknown Artist",
    src: s.audio_url,
    cover: s.cover_url || "",
  }));
}

async function fetchLikes() {
  try {
    const arr = await apiFetch(`/api/likes`);
    likes = new Set(arr.map(String));
  } catch (e) {
    likes = new Set();
    if (e.status === 401) showAuthModal(true);
  }
}

async function fetchPlaylists() {
  try {
    playlists = await apiFetch(`/api/playlists`);
  } catch (e) {
    playlists = [];
    if (e.status === 401) showAuthModal(true);
  }
}

async function fetchMe() {
  const token = getToken();
  if (!token) return null;
  try {
    const out = await apiFetch(`/api/auth/me`);
    return out.user || null;
  } catch {
    clearToken();
    return null;
  }
}

/* =======================
   PLAYER
======================= */
function loadSongById(id, addRecentFlag = true) {
  const idx = songs.findIndex((s) => s.id === String(id));
  if (idx === -1) return;

  currentSongIndex = idx;
  const song = songs[idx];

  audio.src = song.src;
  if (songTitle) songTitle.innerText = song.title;
  if (songArtist) songArtist.innerText = song.artist;
  if (albumArt) albumArt.src = song.cover || "";

  playCountArmed = false;
  playCountMarked = false;

  const saved = continueMap[song.id];
  if (saved && saved.time && saved.duration && saved.time < saved.duration - 2) {
    try {
      audio.currentTime = saved.time;
    } catch {}
  }

  if (addRecentFlag) addToRecent(song.id);

  updateActiveSong();
  renderContinue();
  renderRecent();
  renderMostPlayed();
  renderRecommended();
}

function playSong() {
  audio.play();
  isPlaying = true;
  if (playIcon) playIcon.className = "fa-solid fa-pause";
  albumWrapper?.classList.add("playing");

  playCountArmed = true;
  playCountMarked = false;
}

function pauseSong() {
  audio.pause();
  isPlaying = false;
  if (playIcon) playIcon.className = "fa-solid fa-play";
  albumWrapper?.classList.remove("playing");
}

function togglePlay() {
  isPlaying ? pauseSong() : playSong();
}

/* =======================
   QUEUE / SHUFFLE / REPEAT
======================= */
function addToQueue(id) {
  queue.push(String(id));
  renderQueue();
}

function changeSong(dir) {
  if (queue.length > 0) {
    const nextId = queue.shift();
    loadSongById(nextId);
    playSong();
    renderQueue();
    return;
  }

  if (isShuffle) {
    let n;
    do {
      n = Math.floor(Math.random() * songs.length);
    } while (n === currentSongIndex && songs.length > 1);
    currentSongIndex = n;
  } else {
    currentSongIndex = (currentSongIndex + dir + songs.length) % songs.length;
  }

  loadSongById(songs[currentSongIndex].id);
  playSong();
}

/* =======================
   LIKES
======================= */
async function toggleLike(id) {
  id = String(id);
  const liked = likes.has(id);

  try {
    await apiFetch(`/api/likes/${id}`, { method: liked ? "DELETE" : "POST" });
    liked ? likes.delete(id) : likes.add(id);
    renderCurrentView();
  } catch (e) {
    if (e.status === 401) showAuthModal(true);
    else alert(e.message);
  }
}

/* =======================
   HELPERS
======================= */
function getLikedSongs() {
  return songs.filter((s) => likes.has(s.id));
}

function getPlaylistById(pid) {
  return playlists.find((p) => String(p.id) === String(pid));
}

function getCurrentList() {
  const q = (searchInput?.value || "").toLowerCase();

  let base = songs;
  if (currentView === "liked") base = getLikedSongs();

  if (currentView === "playlist") {
    const pl = getPlaylistById(currentPlaylistId);
    base = pl ? songs.filter((s) => pl.tracks.includes(s.id)) : [];
  }

  return base.filter(
    (s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
  );
}

/* =======================
   RENDER SONG LIST
======================= */
function renderSongList(list) {
  if (!songListEl) return;
  songListEl.innerHTML = "";

  if (currentView === "liked" && list.length === 0) {
    songListEl.innerHTML = `
      <div style="color:#aaa;font-size:13px;padding:12px 2px;">
        No liked songs yet. Tap ❤️ on any song to add it here.
      </div>
    `;
    return;
  }

  list.forEach((song) => {
    const row = document.createElement("div");
    row.className = "songItem";

    const left = document.createElement("span");
    left.textContent = song.title;

    const right = document.createElement("div");
    right.className = "songRight";

    const artist = document.createElement("span");
    artist.textContent = song.artist;

    const likeBtn = document.createElement("button");
    likeBtn.className = "likeBtn" + (likes.has(song.id) ? " liked" : "");
    likeBtn.innerHTML = `<i class="fa-solid fa-heart"></i>`;
    likeBtn.onclick = (e) => {
      e.stopPropagation();
      toggleLike(song.id);
    };

    right.appendChild(artist);
    right.appendChild(likeBtn);

    row.appendChild(left);
    row.appendChild(right);

    row.onclick = () => {
      loadSongById(song.id);
      playSong();
    };

    // right-click to add to queue
    row.oncontextmenu = (e) => {
      e.preventDefault();
      addToQueue(song.id);
      queuePanel?.classList.remove("hidden");
    };

    songListEl.appendChild(row);
  });

  updateActiveSong();
}

function updateActiveSong() {
  document.querySelectorAll(".songItem").forEach((el) => el.classList.remove("active"));
  const title = songs[currentSongIndex]?.title;
  document.querySelectorAll(".songItem").forEach((el) => {
    if (el.querySelector("span")?.innerText === title) el.classList.add("active");
  });
}

/* =======================
   SIDEBAR PLAYLISTS
======================= */
function renderPlaylistsSidebar() {
  if (!playlistListEl || !playlistSelect || !likedSongsBtn) return;

  playlistListEl.innerHTML = "";
  likedSongsBtn.classList.toggle("active", currentView === "liked");

  playlists.forEach((pl) => {
    const btn = document.createElement("button");
    btn.className = "playlistBtn";
    if (currentView === "playlist" && String(currentPlaylistId) === String(pl.id)) {
      btn.classList.add("active");
    }
    btn.innerText = pl.name;

    btn.onclick = () => {
      currentView = "playlist";
      currentPlaylistId = String(pl.id);
      if (renamePlaylistInput) renamePlaylistInput.value = pl.name;
      if (searchInput) searchInput.value = "";
      setActiveTab("home");
      setHeader(pl.name, "Playlist");
      renderCurrentView();
    };

    playlistListEl.appendChild(btn);
  });

  playlistSelect.innerHTML = "";
  if (!playlists.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Create playlist first";
    playlistSelect.appendChild(opt);
    playlistSelect.disabled = true;
    return;
  }

  playlists.forEach((pl) => {
    const opt = document.createElement("option");
    opt.value = String(pl.id);
    opt.textContent = pl.name;
    playlistSelect.appendChild(opt);
  });

  playlistSelect.disabled = false;

  if (currentView === "playlist" && currentPlaylistId) {
    playlistSelect.value = String(currentPlaylistId);
  }
}

/* =======================
   QUEUE UI
======================= */
function renderQueue() {
  if (!queueList) return;
  queueList.innerHTML = "";

  if (!queue.length) {
    queueList.innerHTML = `<div style="color:#aaa;font-size:13px;">Queue is empty</div>`;
    return;
  }

  queue.forEach((id, i) => {
    const s = songs.find((x) => x.id === id);
    if (!s) return;

    const item = document.createElement("div");
    item.className = "queueItem";

    item.innerHTML = `
      <div class="queueLeft">
        <div class="qt">${s.title}</div>
        <div class="qa">${s.artist}</div>
      </div>
      <button class="queueRemoveBtn"><i class="fa-solid fa-xmark"></i></button>
    `;

    item.onclick = () => {
      queue.splice(i, 1);
      loadSongById(s.id);
      playSong();
      renderQueue();
    };

    item.querySelector("button").onclick = (e) => {
      e.stopPropagation();
      queue.splice(i, 1);
      renderQueue();
    };

    queueList.appendChild(item);
  });
}

/* =======================
   HOME SECTIONS
======================= */
function renderMostPlayed() {
  if (!mostSection || !mostList) return;
  mostSection.style.display = currentView === "home" ? "block" : "none";
  mostList.innerHTML = "";

  const ranked = songs
    .map((s) => ({ song: s, c: playCount[s.id] || 0 }))
    .filter((x) => x.c > 0)
    .sort((a, b) => b.c - a.c)
    .slice(0, 8);

  if (ranked.length === 0) {
    mostList.innerHTML = `<div style="color:#aaa;font-size:13px;">Play songs to build your Most Played.</div>`;
    return;
  }

  ranked.forEach(({ song, c }) => {
    const card = document.createElement("div");
    card.className = "homeCard";
    card.innerHTML = `
      <div class="homeTop">
        <img class="homeImg" src="${song.cover || ""}" />
        <div class="homeMeta">
          <div class="ht">${song.title}</div>
          <div class="ha">${song.artist}</div>
        </div>
      </div>
      <div class="badgeLine">Played ${c} times</div>
    `;
    card.onclick = () => {
      loadSongById(song.id);
      playSong();
    };
    mostList.appendChild(card);
  });
}

function renderRecommended() {
  if (!recSection || !recList) return;
  recSection.style.display = currentView === "home" ? "block" : "none";
  recList.innerHTML = "";

  let favArtist = null;
  let best = 0;
  songs.forEach((s) => {
    const c = playCount[s.id] || 0;
    if (c > best) {
      best = c;
      favArtist = s.artist;
    }
  });

  if (!favArtist || best === 0) {
    recList.innerHTML = `<div style="color:#aaa;font-size:13px;">Listen more to unlock recommendations.</div>`;
    return;
  }

  const recs = songs.filter((s) => s.artist === favArtist).slice(0, 8);

  recs.forEach((song) => {
    const card = document.createElement("div");
    card.className = "homeCard";
    card.innerHTML = `
      <div class="homeTop">
        <img class="homeImg" src="${song.cover || ""}" />
        <div class="homeMeta">
          <div class="ht">${song.title}</div>
          <div class="ha">${song.artist}</div>
        </div>
      </div>
      <div class="badgeLine">Because you like ${favArtist}</div>
    `;
    card.onclick = () => {
      loadSongById(song.id);
      playSong();
    };
    recList.appendChild(card);
  });
}

function renderRecent() {
  if (!recentSection || !recentList) return;
  recentSection.style.display = currentView === "home" ? "block" : "none";
  recentList.innerHTML = "";

  const valid = recent.map((id) => songs.find((s) => s.id === id)).filter(Boolean);

  if (valid.length === 0) {
    recentList.innerHTML = `
      <div style="color:#aaa;font-size:13px;padding:10px 2px;">
        Play some songs and your recent tracks will appear here.
      </div>
    `;
    return;
  }

  valid.forEach((s) => {
    const card = document.createElement("div");
    card.className = "recentCard";
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <img class="recentImg" src="${s.cover || ""}" />
        <div style="display:flex;flex-direction:column;gap:2px;">
          <div style="font-weight:800;font-size:13px;">${s.title}</div>
          <div style="font-size:12px;color:#aaa;">${s.artist}</div>
        </div>
      </div>
    `;
    card.onclick = () => {
      loadSongById(s.id);
      playSong();
    };
    recentList.appendChild(card);
  });
}

function renderContinue() {
  if (!continueSection || !continueList) return;
  continueSection.style.display = currentView === "home" ? "block" : "none";
  continueList.innerHTML = "";

  const items = Object.entries(continueMap)
    .map(([id, meta]) => {
      const song = songs.find((s) => s.id === id);
      if (!song || !meta || !meta.duration) return null;
      if (meta.time < 5) return null;
      if (meta.time > meta.duration - 5) return null;
      return { song, meta };
    })
    .filter(Boolean)
    .sort((a, b) => b.meta.updatedAt - a.meta.updatedAt)
    .slice(0, 8);

  if (items.length === 0) {
    continueSection.style.display = "none";
    return;
  }

  items.forEach(({ song, meta }) => {
    const pct = Math.min(100, Math.floor((meta.time / meta.duration) * 100));
    const card = document.createElement("div");
    card.className = "continueCard";
    card.innerHTML = `
      <div class="continueTop">
        <img class="continueImg" src="${song.cover || ""}" />
        <div class="continueMeta">
          <div class="ct">${song.title}</div>
          <div class="ca">${song.artist}</div>
        </div>
      </div>
      <div class="continueProgress">
        <div class="continueBar" style="width:${pct}%"></div>
      </div>
    `;
    card.onclick = () => {
      loadSongById(song.id);
      playSong();
    };
    continueList.appendChild(card);
  });
}

/* =======================
   VIEW
======================= */
function renderCurrentView() {
  updateLibraryUI(); // STEP 6: show/hide cards + set list heading
  renderPlaylistsGrid();
  renderSongList(getCurrentList());
  renderPlaylistsSidebar();
  renderMostPlayed();
  renderRecommended();
  renderContinue();
  renderRecent();
}

/* =======================
   PLAYLIST ACTIONS
======================= */
if (createPlaylistBtn) {
  createPlaylistBtn.onclick = async () => {
    const name = newPlaylistName?.value.trim();
    if (!name) return alert("Enter playlist name");

    try {
      await apiFetch(`/api/playlists`, { method: "POST", json: { name } });
      if (newPlaylistName) newPlaylistName.value = "";
      await fetchPlaylists();
      renderCurrentView();
    } catch (e) {
      if (e.status === 401) showAuthModal(true);
      else alert(e.message);
    }
  };
}

if (renamePlaylistBtn) {
  renamePlaylistBtn.onclick = async () => {
    if (!currentPlaylistId) return alert("Open a playlist first.");
    const name = renamePlaylistInput?.value.trim();
    if (!name) return alert("Enter new name");

    try {
      await apiFetch(`/api/playlists/${currentPlaylistId}`, { method: "PATCH", json: { name } });
      await fetchPlaylists();
      renderCurrentView();
    } catch (e) {
      if (e.status === 401) showAuthModal(true);
      else alert(e.message);
    }
  };
}

if (addToPlaylistBtn) {
  addToPlaylistBtn.onclick = async () => {
    const pid = playlistSelect?.value;
    const trackId = songs[currentSongIndex]?.id;
    if (!pid || !trackId) return alert("Select a playlist first");

    try {
      await apiFetch(`/api/playlists/${pid}/tracks/${trackId}`, { method: "POST" });
      await fetchPlaylists();
      renderCurrentView();
    } catch (e) {
      if (e.status === 401) showAuthModal(true);
      else alert(e.message);
    }
  };
}

if (removeFromPlaylistBtn) {
  removeFromPlaylistBtn.onclick = async () => {
    if (currentView !== "playlist") return alert("Open a playlist first.");
    const trackId = songs[currentSongIndex]?.id;
    if (!trackId) return;

    try {
      await apiFetch(`/api/playlists/${currentPlaylistId}/tracks/${trackId}`, { method: "DELETE" });
      await fetchPlaylists();
      renderCurrentView();
    } catch (e) {
      if (e.status === 401) showAuthModal(true);
      else alert(e.message);
    }
  };
}

if (deletePlaylistBtn) {
  deletePlaylistBtn.onclick = async () => {
    if (!currentPlaylistId) return alert("Open a playlist first.");
    const ok = confirm("Delete this playlist?");
    if (!ok) return;

    try {
      await apiFetch(`/api/playlists/${currentPlaylistId}`, { method: "DELETE" });
      currentView = "home";
      currentPlaylistId = null;
      if (renamePlaylistInput) renamePlaylistInput.value = "";
      if (searchInput) searchInput.value = "";
      setActiveTab("home");
      setHeader("Home", "Welcome to Wavelet");
      await fetchPlaylists();
      renderCurrentView();
    } catch (e) {
      if (e.status === 401) showAuthModal(true);
      else alert(e.message);
    }
  };
}

/* =======================
   NAV
======================= */
function setActiveTab(which) {
  if (homeTab) homeTab.classList.toggle("active", which === "home");
  if (searchTab) searchTab.classList.toggle("active", which === "search");
  if (libraryTab) libraryTab.classList.toggle("active", which === "library");
}

if (homeTab) {
  homeTab.onclick = () => {
    currentView = "home";
    currentPlaylistId = null;
    if (searchInput) searchInput.value = "";
    setActiveTab("home");
    setHeader("Home", "Welcome to Wavelet");
    renderCurrentView();
  };
}

if (searchTab) {
  searchTab.onclick = () => {
    currentView = "home";
    currentPlaylistId = null;
    setActiveTab("search");
    setHeader("Search", "Find songs by title or artist");
    renderCurrentView();
    searchInput?.focus();
  };
}

if (libraryTab) {
  libraryTab.onclick = async () => {
    currentView = "liked";
    currentPlaylistId = null;
    if (searchInput) searchInput.value = "";
    setActiveTab("library");
    setHeader("Library", "Your liked songs and playlists");
    await fetchLikes();
    renderCurrentView();
  };
}

if (likedSongsBtn) {
  likedSongsBtn.onclick = async () => {
    currentView = "liked";
    currentPlaylistId = null;
    if (searchInput) searchInput.value = "";
    setActiveTab("library");
    setHeader("Liked Songs", "Your favorites in one place");
    await fetchLikes();
    renderCurrentView();
  };
}

/* Step 6: card clicks */
if (likedCard) likedCard.onclick = () => likedSongsBtn?.click();

if (playlistsCard) {
  playlistsCard.onclick = async () => {
    if (!getToken()) return showAuthModal(true);

    // ensure playlists loaded
    if (!playlists.length) await fetchPlaylists();

    if (playlists.length) {
      currentView = "playlist";
      currentPlaylistId = String(playlists[0].id);
      setActiveTab("library");
      setHeader(playlists[0].name, "Playlist");
      renderCurrentView();
    } else {
      alert("No playlists yet. Create one from the sidebar.");
    }
  };
}

if (searchInput) searchInput.oninput = renderCurrentView;

/* =======================
   BUTTONS
======================= */
if (playBtn) playBtn.onclick = togglePlay;
if (nextBtn) nextBtn.onclick = () => changeSong(1);
if (prevBtn) prevBtn.onclick = () => changeSong(-1);

if (shuffleBtn) {
  shuffleBtn.onclick = () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle("active", isShuffle);
  };
}

if (repeatBtn) {
  repeatBtn.onclick = () => {
    if (repeatMode === "off") {
      repeatMode = "all";
      repeatBtn.classList.add("active");
      repeatBtn.innerHTML = `<i class="fa-solid fa-repeat"></i>`;
    } else if (repeatMode === "all") {
      repeatMode = "one";
      repeatBtn.classList.add("active");
      repeatBtn.innerHTML = `<i class="fa-solid fa-repeat-1"></i>`;
    } else {
      repeatMode = "off";
      repeatBtn.classList.remove("active");
      repeatBtn.innerHTML = `<i class="fa-solid fa-repeat"></i>`;
    }
  };
}

if (queueBtn) {
  queueBtn.onclick = () => {
    queuePanel?.classList.toggle("hidden");
    renderQueue();
  };
}

if (closeQueueBtn) {
  closeQueueBtn.onclick = () => {
    queuePanel?.classList.add("hidden");
  };
}

/* =======================
   AUDIO EVENTS
======================= */
audio.onended = () => {
  const finishedId = songs[currentSongIndex]?.id;
  if (finishedId && continueMap[finishedId]) {
    delete continueMap[finishedId];
    saveContinue();
  }

  if (repeatMode === "one") {
    audio.currentTime = 0;
    playSong();
    return;
  }

  if (repeatMode === "all" || currentSongIndex < songs.length - 1) {
    changeSong(1);
  } else {
    pauseSong();
  }
};

audio.ontimeupdate = () => {
  if (progressBar) progressBar.value = (audio.currentTime / audio.duration) * 100 || 0;
  if (currentTimeEl) currentTimeEl.innerText = formatTime(audio.currentTime);
  if (durationEl) durationEl.innerText = formatTime(audio.duration);

  if (!playCountMarked && playCountArmed && audio.duration) {
    const id = songs[currentSongIndex]?.id;
    const threshold = Math.min(30, audio.duration * 0.5);
    if (id && audio.currentTime >= threshold) {
      bumpPlayCount(id);
      playCountMarked = true;
      renderMostPlayed();
      renderRecommended();
    }
  }

  if (!audio.paused && audio.duration && songs[currentSongIndex]) {
    const id = songs[currentSongIndex].id;
    continueMap[id] = { time: audio.currentTime, duration: audio.duration, updatedAt: Date.now() };
    saveContinue();
  }
};

if (progressBar) {
  progressBar.oninput = () => {
    audio.currentTime = (progressBar.value / 100) * audio.duration;
  };
}

if (volumeBar) {
  volumeBar.oninput = () => {
    audio.volume = volumeBar.value;
    audio.muted = false;
    if (muteIcon) muteIcon.className = "fa-solid fa-volume-high";
  };
}

if (muteBtn) {
  muteBtn.onclick = () => {
    audio.muted = !audio.muted;
    if (muteIcon) {
      muteIcon.className = audio.muted ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high";
    }
  };
}

/* Spacebar controls: ignore when typing */
document.addEventListener("keydown", (e) => {
  const active = document.activeElement;
  if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;

  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  }
  if (e.code === "ArrowRight") changeSong(1);
  if (e.code === "ArrowLeft") changeSong(-1);
});

/* =======================
   UTIL
======================= */
function formatTime(t) {
  if (isNaN(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/* =======================
   AUTH UI EVENTS
======================= */
if (closeAuth) closeAuth.onclick = () => showAuthModal(false);
if (loginTabBtn) loginTabBtn.onclick = () => setAuthTab("login");
if (registerTabBtn) registerTabBtn.onclick = () => setAuthTab("register");

if (authSubmitBtn) {
  authSubmitBtn.onclick = async () => {
    const username = (authUsername?.value || "").trim().toLowerCase();
    const password = (authPassword?.value || "").trim();

    if (username.length < 3) return (authMsg.textContent = "Username must be at least 3 chars");
    if (password.length < 6) return (authMsg.textContent = "Password must be at least 6 chars");

    if (authMsg) authMsg.textContent = "Working...";

    try {
      const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const out = await apiFetch(path, { method: "POST", json: { username, password } });

      setToken(out.token);
      meUser = out.user;
      if (userLabel) userLabel.textContent = `@${meUser.username}`;
      showAuthModal(false);

      await fetchLikes();
      await fetchPlaylists();
      renderCurrentView();
    } catch (e) {
      if (authMsg) authMsg.textContent = e.message || "Auth failed";
    }
  };
}

if (logoutBtn) {
  logoutBtn.onclick = () => {
    clearToken();
    meUser = null;
    if (userLabel) userLabel.textContent = "Not logged in";
    likes = new Set();
    playlists = [];
    currentView = "home";
    currentPlaylistId = null;
    setHeader("Home", "Welcome to Wavelet");
    renderCurrentView();
    showAuthModal(true);
  };
}

/* =======================
   INIT
======================= */
(async function init() {
  loadRecent();
  loadContinue();
  loadPlayCount();

  setActiveTab("home");
  setAuthTab("login");
  setHeader("Home", "Welcome to Wavelet");

  if (songTitle) songTitle.innerText = "Loading songs...";
  if (songArtist) songArtist.innerText = "";

  await fetchSongs();

  if (songs.length) loadSongById(songs[0].id, false);

  meUser = await fetchMe();
  if (meUser) {
    if (userLabel) userLabel.textContent = `@${meUser.username}`;
    showAuthModal(false);
    await fetchLikes();
    await fetchPlaylists();
  } else {
    if (userLabel) userLabel.textContent = "Not logged in";
    showAuthModal(true);
  }

  renderCurrentView();
  renderQueue();
})();
