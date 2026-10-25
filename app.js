/* Player_Tv - app.js */
window.APP_VERSION = "1.1.1";

const STORAGE = {
  sources: "player_tv_sources",
  channels: "player_tv_channels",
  settings: "player_tv_settings",
  version: "player_tv_version",
};
const UPDATE_URL = "https://raw.githubusercontent.com/belgra77/Player_Tv/main/index.html";

let sources = [];
let channels = [];
let settings = { autoUpdate: true };
let editingSourceId = null;

function loadState() {
  const v = localStorage.getItem(STORAGE.version);
  if (v && v !== window.APP_VERSION) {
    localStorage.removeItem(STORAGE.sources);
    localStorage.removeItem(STORAGE.channels);
    localStorage.setItem(STORAGE.version, window.APP_VERSION);
  }
  try { sources = JSON.parse(localStorage.getItem(STORAGE.sources) || "[]"); } catch (e) { sources = []; }
  try { channels = JSON.parse(localStorage.getItem(STORAGE.channels) || "[]"); } catch (e) { channels = []; }
  try { settings = Object.assign({ autoUpdate: true }, JSON.parse(localStorage.getItem(STORAGE.settings) || "{}")); } catch (e) { settings = { autoUpdate: true }; }
  if (!localStorage.getItem(STORAGE.version)) localStorage.setItem(STORAGE.version, window.APP_VERSION);
}
function saveState() {
  localStorage.setItem(STORAGE.sources, JSON.stringify(sources.map(x=>{const{content,...r}=x;return r;})));
  localStorage.setItem(STORAGE.channels, JSON.stringify(channels));
  localStorage.setItem(STORAGE.settings, JSON.stringify(settings));
}

// ---------- M3U parser ----------
function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF")) {
      current = { name: "", logo: "", group: "Sin grupo", tvgId: "", url: "" };
      const attrs = line.match(/([\w-]+)="([^"]*)"/g) || [];
      attrs.forEach(a => {
        const m = a.match(/^([\w-]+)="([^"]*)"$/);
        if (!m) return;
        const k = m[1].toLowerCase(), v = m[2];
        if (k === "tvg-id") current.tvgId = v;
        if (k === "tvg-name") current.name = v;
        if (k === "tvg-logo") current.logo = v;
        if (k === "group-title") current.group = v || "Sin grupo";
      });
      // name after comma
      const commaIdx = line.indexOf(",");
      if (commaIdx >= 0) {
        const n = line.substring(commaIdx + 1).trim();
        if (n && !current.name) current.name = n;
      }
      if (!current.name) current.name = "Canal sin nombre";
    } else if (line.startsWith("#")) {
      continue;
    } else {
      if (current) {
        current.url = line;
        out.push(current);
        current = null;
      } else {
        // bare url
        out.push({ name: "Canal", logo: "", group: "Sin grupo", tvgId: "", url: line });
      }
    }
  }
  return out;
}

// ---------- Navigation ----------
function switchTab(name) {
  document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));
  document.getElementById("tab-" + name).classList.add("active");
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  if (name === "settings") renderSettings();
}
document.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));

// ---------- Alerts ----------
function showAlert(title, message, buttons) {
  return new Promise(resolve => {
    const modal = document.getElementById("alert-modal");
    document.getElementById("alert-title").textContent = title;
    document.getElementById("alert-message").textContent = message;
    const actions = document.getElementById("alert-actions");
    actions.innerHTML = "";
    (buttons || [{ label: "Aceptar", value: true, primary: true }]).forEach(btn => {
      const b = document.createElement("button");
      b.textContent = btn.label;
      if (btn.primary) b.classList.add("primary");
      b.addEventListener("click", () => { modal.classList.add("hidden"); resolve(btn.value); });
      actions.appendChild(b);
    });
    modal.classList.remove("hidden");
  });
}
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ---------- Sources render ----------
function renderSources() {
  const container = document.getElementById("sources-list");
  container.innerHTML = "";
  if (sources.length === 0) {
    container.innerHTML = '<div class="empty">No hay fuentes. Pulsa + para añadir.</div>';
    return;
  }
  sources.forEach(src => {
    const cell = document.createElement("div");
    cell.className = "cell source-btn";
    cell.innerHTML = `
      <div class="icon">📋</div>
      <div class="content">
        <div class="title">${escapeHtml(src.name)}</div>
        <div class="subtitle">${src.channels.length} canales · ${src.type === "url" ? "URL" : "Texto"} · ${new Date(src.loadedAt).toLocaleDateString()}</div>
      </div>
      <div class="actions">
        <button class="action-btn edit">Editar</button>
        <button class="action-btn del">Eliminar</button>
      </div>
    `;
    cell.querySelector(".edit").addEventListener("click", e => { e.stopPropagation(); openSourceModal(src.id); });
    cell.querySelector(".del").addEventListener("click", e => { e.stopPropagation(); deleteSource(src.id); });
    container.appendChild(cell);
  });
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }

// ---------- Source modal ----------
function openSourceModal(id) {
  editingSourceId = id || null;
  const src = id ? sources.find(s => s.id === id) : null;
  document.getElementById("modal-title").textContent = src ? "Editar fuente" : "Nueva fuente";
  document.getElementById("src-name").value = src ? src.name : "";
  document.getElementById("src-type").value = src ? src.type : "url";
  document.getElementById("src-url").value = src && src.type === "url" ? src.url : "";
  document.getElementById("src-text").value = src && src.type === "text" ? src.content : "";
  toggleTypeFields();
  document.getElementById("source-modal").classList.remove("hidden");
}
function toggleTypeFields() {
  const t = document.getElementById("src-type").value;
  document.getElementById("src-url-wrap").classList.toggle("hidden", t !== "url");
  document.getElementById("src-text-wrap").classList.toggle("hidden", t !== "text");
}
document.getElementById("src-type").addEventListener("change", toggleTypeFields);
document.getElementById("add-source-btn").addEventListener("click", () => openSourceModal(null));
document.getElementById("modal-cancel").addEventListener("click", () => document.getElementById("source-modal").classList.add("hidden"));

document.getElementById("modal-save").addEventListener("click", async () => {
  const name = document.getElementById("src-name").value.trim() || "Fuente sin nombre";
  const type = document.getElementById("src-type").value;
  let parsed = [];
  let url = "", content = "";
  try {
    if (type === "url") {
      url = document.getElementById("src-url").value.trim();
      if (!url) throw new Error("URL vacía");
      let text = null, lastErr = null;
      const proxies = [
        (u) => u,
        (u) => "https://corsproxy.io/?" + encodeURIComponent(u),
        (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
      ];
      for (const makeUrl of proxies) {
        try {
          const res = await fetch(makeUrl(url));
          if (!res.ok) throw new Error("HTTP " + res.status);
          text = await res.text();
          if (text && text.length > 0) break;
        } catch (e) { lastErr = e; }
      }
      if (text === null) throw new Error("No se pudo obtener la lista (CORS). Prueba pegando el contenido M3U directamente.");
      parsed = parseM3U(text);
    } else {
      content = document.getElementById("src-text").value;
      parsed = parseM3U(content);
    }
  } catch (e) {
    await showAlert("Error", "No se pudo cargar la lista: " + e.message);
    return;
  }
  if (editingSourceId) {
    const src = sources.find(s => s.id === editingSourceId);
    // remove old channels
    channels = channels.filter(c => c.sourceId !== editingSourceId);
    src.name = name; src.type = type; src.url = url; src.content = ""; src.channels = parsed; src.loadedAt = Date.now();
    parsed.forEach(ch => channels.push({ ...ch, sourceId: src.id }));
  } else {
    const id = "src_" + Date.now();
    const src = { id, name, type, url, content: "", channels: parsed, loadedAt: Date.now() };
    sources.push(src);
    parsed.forEach(ch => channels.push({ ...ch, sourceId: id }));
  }
  saveState();
  document.getElementById("source-modal").classList.add("hidden");
  // collapse new source groups
  const srcName = name;
  collapsedGroups.add(srcName);
  parsed.forEach(ch => collapsedGroups.add(srcName + "::" + (ch.group || "Sin grupo")));
  renderSources();
  renderChannels();
});

async function deleteSource(id) {
  const ok = await showAlert("Eliminar fuente", "¿Eliminar esta fuente y todos sus canales?", [
    { label: "Cancelar", value: false },
    { label: "Eliminar", value: true, primary: true },
  ]);
  if (!ok) return;
  sources = sources.filter(s => s.id !== id);
  channels = channels.filter(c => c.sourceId !== id);
  saveState();
  renderSources();
  renderChannels();
}

// ---------- Channels render ----------
let collapsedGroups = new Set();
let initialCollapseDone = false;
function renderChannels() {
  const container = document.getElementById("channels-list");
  const q = document.getElementById("channel-search").value.toLowerCase();
  container.innerHTML = "";
  const filtered = channels.filter(c => c.name.toLowerCase().includes(q) || (c.group||"").toLowerCase().includes(q));
  // group by source first
  const bySource = {};
  filtered.forEach(c => {
    const src = sources.find(s => s.id === c.sourceId);
    const srcName = src ? src.name : "Fuente";
    (bySource[srcName] = bySource[srcName] || {})[c.group || "Sin grupo"] = (bySource[srcName][c.group || "Sin grupo"] || []);
    bySource[srcName][c.group || "Sin grupo"].push(c);
  });
  const sourceNames = Object.keys(bySource).sort();
  if (!initialCollapseDone && sourceNames.length > 0) {
    sourceNames.forEach(s => collapsedGroups.add(s));
    Object.keys(bySource).forEach(s => Object.keys(bySource[s]).forEach(g => collapsedGroups.add(s+"::"+g)));
    initialCollapseDone = true;
  }
  if (sourceNames.length === 0) {
    container.innerHTML = '<div class="empty">No hay canales.</div>';
    return;
  }
  sourceNames.forEach(srcName => {
    const srcHdr = document.createElement("div");
    srcHdr.className = "group-header" + (collapsedGroups.has(srcName) ? " collapsed" : "");
    const srcCount = Object.values(bySource[srcName]).reduce((a,b)=>a+b.length,0);
    srcHdr.innerHTML = `<span class="arrow">▼</span>${escapeHtml(srcName)} (${srcCount})`;
    const srcItems = document.createElement("div");
    srcItems.className = "group-items" + (collapsedGroups.has(srcName) ? " collapsed" : "");
    if (collapsedGroups.has(srcName)) srcItems.style.maxHeight = "0";
    Object.keys(bySource[srcName]).sort().forEach(g => {
      const key = srcName+"::"+g;
      const gHdr = document.createElement("div");
      gHdr.className = "group-header" + (collapsedGroups.has(key) ? " collapsed" : "");
      gHdr.style.paddingLeft = "32px";
      gHdr.innerHTML = `<span class="arrow">▼</span>${escapeHtml(g)} (${bySource[srcName][g].length})`;
      const gItems = document.createElement("div");
      gItems.className = "group-items" + (collapsedGroups.has(key) ? " collapsed" : "");
      if (collapsedGroups.has(key)) gItems.style.maxHeight = "0";
      else gItems.style.maxHeight = (bySource[srcName][g].length * 60 + 10) + "px";
      bySource[srcName][g].forEach(ch => {
        const cell = document.createElement("div");
        cell.className = "cell source-btn";
        cell.style.paddingLeft = "48px";
        cell.innerHTML = `
          <div class="icon">${ch.logo ? `<img src="${escapeHtml(ch.logo)}" onerror="this.parentElement.textContent='📺'" />` : "📺"}</div>
          <div class="content">
            <div class="title">${escapeHtml(ch.name)}</div>
            <div class="subtitle">${escapeHtml(ch.group || "")}</div>
          </div>
          <div class="chevron">›</div>
        `;
        cell.addEventListener("click", () => openPlayer(ch));
        gItems.appendChild(cell);
      });
      gHdr.addEventListener("click", () => {
        if (collapsedGroups.has(key)) collapsedGroups.delete(key); else collapsedGroups.add(key);
        renderChannels();
      });
      srcItems.appendChild(gHdr);
      srcItems.appendChild(gItems);
    });
    srcHdr.addEventListener("click", () => {
      if (collapsedGroups.has(srcName)) collapsedGroups.delete(srcName); else collapsedGroups.add(srcName);
      renderChannels();
    });
    container.appendChild(srcHdr);
    container.appendChild(srcItems);
  });
}
document.getElementById("channel-search").addEventListener("input", renderChannels);

// ---------- Player ----------
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let hlsInstance = null;
function openPlayer(ch) {
  document.getElementById("player-title").textContent = ch.name;
  const video = document.getElementById("player-video");
  // cleanup
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  video.src = "";
  document.getElementById("player-view").classList.remove("hidden");
  if (isIOS) {
    video.src = ch.url;
    video.play().catch(()=>{});
  } else {
    // load hls.js from CDN if needed
    if (window.Hls && window.Hls.isSupported()) {
      hlsInstance = new window.Hls();
      hlsInstance.loadSource(ch.url);
      hlsInstance.attachMedia(video);
      hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, () => video.play().catch(()=>{}));
    } else {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
      script.onload = () => {
        if (window.Hls && window.Hls.isSupported()) {
          hlsInstance = new window.Hls();
          hlsInstance.loadSource(ch.url);
          hlsInstance.attachMedia(video);
          hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, () => video.play().catch(()=>{}));
        } else {
          video.src = ch.url;
        }
      };
      document.head.appendChild(script);
    }
  }
}
document.getElementById("player-close").addEventListener("click", () => {
  const video = document.getElementById("player-video");
  video.pause();
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  video.src = "";
  document.getElementById("player-view").classList.add("hidden");
});

// ---------- Settings render ----------
function renderSettings() {
  const container = document.getElementById("settings-list");
  container.innerHTML = "";
  const groups = [
    { title: "Información", rows: [
      { label: "Versión", value: window.APP_VERSION },
    ]},
    { title: "Actualizaciones", rows: [
      { type: "toggle", label: "Auto-actualizar al iniciar", key: "autoUpdate", value: settings.autoUpdate },
      { type: "button", label: "Buscar actualizaciones ahora", action: checkUpdatesManual },
    ]},
    { title: "Datos", rows: [
      { type: "button", label: "Borrar caché de la app", action: clearCache, danger: false },
      { type: "button", label: "Eliminar todas las listas", action: deleteAll, danger: true },
      { type: "button", label: "Cargar listas precargadas", action: async () => { try { sources = sources.filter(s => !["src_default","src_free","src_iptvorg","src_vk","src_coderfast","src_jromero","src_plutoes","src_freeglobal","src_iptvorg_global"].includes(s.id)); channels = channels.filter(c => !["src_default","src_free","src_iptvorg","src_vk","src_coderfast","src_jromero","src_plutoes","src_freeglobal","src_iptvorg_global"].includes(c.sourceId)); saveState(); await loadDefaults(); toast("Listas cargadas"); } catch (e) { await showAlert("Error", e.message); } }, danger: false },
    ]},
    { title: "Acerca de", rows: [
      { label: "Nombre", value: "Player_Tv" },
      { label: "Desarrollador", value: "BelGra_77_Soft" },
    ]},
  ];
  groups.forEach(g => {
    const t = document.createElement("div");
    t.className = "section-title";
    t.textContent = g.title;
    container.appendChild(t);
    const box = document.createElement("div");
    box.className = "grouped-list";
    g.rows.forEach(r => {
      if (r.type === "toggle") {
        const row = document.createElement("div");
        row.className = "toggle-row";
        row.innerHTML = `<span class="label">${escapeHtml(r.label)}</span>
          <label class="toggle"><input type="checkbox" ${r.value ? "checked" : ""}/><span class="slider"></span></label>`;
        row.querySelector("input").addEventListener("change", e => {
          settings.autoUpdate = e.target.checked;
          saveState();
        });
        box.appendChild(row);
      } else if (r.type === "button") {
        const btn = document.createElement("button");
        btn.className = "setting-btn" + (r.danger ? " danger" : "");
        btn.textContent = r.label;
        btn.addEventListener("click", r.action);
        box.appendChild(btn);
      } else {
        const row = document.createElement("div");
        row.className = "cell";
        row.innerHTML = `<div class="content"><div class="title">${escapeHtml(r.label)}</div></div><div class="subtitle" style="max-width:60%;text-align:right;word-break:break-all">${escapeHtml(r.value)}</div>`;
        box.appendChild(row);
      }
    });
    container.appendChild(box);
  });
}

async function clearCache() {
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  toast("Caché borrada");
}
async function deleteAll() {
  const ok = await showAlert("Eliminar todo", "¿Eliminar todas las listas y canales?", [
    { label: "Cancelar", value: false },
    { label: "Eliminar", value: true, primary: true },
  ]);
  if (!ok) return;
  sources = []; channels = [];
  saveState();
  renderSources(); renderChannels();
  toast("Datos eliminados");
}

// ---------- Version check ----------
function compareVersions(a, b) {
  const pa = String(a).split(".").map(n => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}
async function fetchRemoteVersion() {
  const res = await fetch(UPDATE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const html = await res.text();
  // try meta name version
  let m = html.match(/<meta[^>]*name=["']version["'][^>]*content=["']([^"']+)["']/i);
  if (!m) m = html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']version["']/i);
  if (m) return m[1].trim();
  // fallback window.APP_VERSION
  m = html.match(/window\.APP_VERSION\s*=\s*["']([^"']+)["']/);
  if (m) return m[1].trim();
  throw new Error("Versión no encontrada");
}

async function checkUpdates(isManual) {
  try {
    const remote = await fetchRemoteVersion();
    const local = localStorage.getItem(STORAGE.version) || window.APP_VERSION;
    if (compareVersions(remote, local) > 0) {
      const ok = await showAlert("Actualización disponible", `Nueva versión de Player_Tv disponible (v${remote}). ¿Actualizar ahora?`, [
        { label: "Cancelar", value: false },
        { label: "Actualizar", value: true, primary: true },
      ]);
      if (ok) {
        localStorage.setItem(STORAGE.version, remote);
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
        window.location.reload(true);
      }
    } else {
      if (isManual) await showAlert("Player_Tv", "Ya tienes la última versión de Player_Tv");
    }
  } catch (e) {
    if (isManual) await showAlert("Error", "No se pudo verificar actualizaciones: " + e.message);
  }
}
async function checkUpdatesManual() { await checkUpdates(true); }

// ---------- Init ----------
loadState();
renderSources();
renderChannels();
renderSettings();

// Auto-load / weekly update default lists (background)
async function loadDefaults() {
  const lists = [
    { id: "src_default", file: "https://raw.githubusercontent.com/belgra77/Player_Tv/main/default.m3u", name: "TDT_ES" },
    { id: "src_free", file: "https://raw.githubusercontent.com/belgra77/Player_Tv/main/default_es_free.m3u", name: "Free-TV España" },
    { id: "src_iptvorg", file: "https://raw.githubusercontent.com/belgra77/Player_Tv/main/default_iptvorg.m3u", name: "iptv-org España" },
    { id: "src_vk", file: "https://raw.githubusercontent.com/belgra77/Player_Tv/main/default_vk.m3u", name: "vk496 España" },
    { id: "src_coderfast", file: "https://raw.githubusercontent.com/belgra77/Player_Tv/main/default_coderfast.m3u", name: "coderfast España" },
    { id: "src_jromero", file: "https://raw.githubusercontent.com/belgra77/Player_Tv/main/default_jromero.m3u", name: "jromero88 España" },
    { id: "src_plutoes", file: "https://raw.githubusercontent.com/belgra77/Player_Tv/main/default_plutoes.m3u", name: "Pluto TV España" },
    { id: "src_freeglobal", file: "https://raw.githubusercontent.com/belgra77/Player_Tv/main/default_free_global.m3u", name: "Free-TV Global" },
    { id: "src_iptvorg_global", file: "https://raw.githubusercontent.com/belgra77/Player_Tv/main/default_iptvorg_global.m3u", name: "iptv-org Global" },
  ];
  const now = Date.now();
  const week = 7*24*60*60*1000;
  let changed = false;
  for (const L of lists) {
    const def = sources.find(s => s.id === L.id);
    if (!def || !def.lastUpdate || (now - def.lastUpdate) > week) {
      try {
        const res = await fetch(L.file);
        if (res.ok) {
          const text = await res.text();
          const parsed = parseM3U(text);
          if (def) {
            channels = channels.filter(c => c.sourceId !== L.id);
            def.channels = parsed; def.loadedAt = now; def.lastUpdate = now; def.name = L.name;
            parsed.forEach(ch => channels.push({ ...ch, sourceId: L.id }));
          } else {
            sources.push({ id: L.id, name: L.name, type: "text", url: "", channels: parsed, loadedAt: now, lastUpdate: now });
            parsed.forEach(ch => channels.push({ ...ch, sourceId: L.id }));
          }
          collapsedGroups.add(L.name);
          parsed.forEach(ch => collapsedGroups.add(L.name + "::" + (ch.group || "Sin grupo")));
          changed = true;
        }
      } catch (e) {}
    }
  }
  if (changed) { saveState(); renderSources(); renderChannels(); }
}
loadDefaults();

// register SW
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(err => console.warn("SW register failed", err));
}

// auto update on load
window.addEventListener("DOMContentLoaded", () => {
  if (settings.autoUpdate) {
    checkUpdates(false);
  }
});
// also run now in case DOMContentLoaded already fired
if (document.readyState === "loading") {
  // wait
} else {
  if (settings.autoUpdate) checkUpdates(false);
}
