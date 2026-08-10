// ============================================
// AliceMusic — app.js (Ottimizzato per Android & Background)
// ============================================

const els = {
  input: document.getElementById('searchInput'),
  clear: document.getElementById('clearBtn'),
  tags: document.getElementById('tagRow'),
  state: document.getElementById('state'),
  results: document.getElementById('results'),
  player: document.getElementById('player'),
  vinyl: document.getElementById('vinyl'),
  playerTitle: document.getElementById('playerTitle'),
  playerArtist: document.getElementById('playerArtist'),
  playBtn: document.getElementById('playBtn'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  progressBar: document.getElementById('progressBar'),
  progressFill: document.getElementById('progressFill'),
  toast: document.getElementById('toast'),
  tabSearchBtn: document.getElementById('tabSearchBtn'),
  tabHistoryBtn: document.getElementById('tabHistoryBtn'),
  searchView: document.getElementById('searchView'),
  historyView: document.getElementById('historyView'),
  historyState: document.getElementById('historyState'),
  historyResults: document.getElementById('historyResults'),
  clearHistBtn: document.getElementById('clearHistBtn'),
};

const HISTORY_KEY = 'aliceMusic_cronologia';
const HISTORY_MAX = 60;

const MAGIC_CIRCLE_SVG = `
<svg class="magic-circle" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g class="ring-out">
    <circle cx="100" cy="100" r="86" fill="none" stroke="var(--gold-deep)" stroke-width="2" stroke-dasharray="4 10"/>
    <circle cx="100" cy="100" r="70" fill="none" stroke="var(--gold)" stroke-width="1.4" stroke-dasharray="1 7"/>
  </g>
  <g class="ring-in">
    <polygon points="100,42 128,100 100,158 72,100" fill="none" stroke="var(--gold-pale)" stroke-width="1.4" opacity=".7"/>
    <circle cx="100" cy="100" r="54" fill="none" stroke="var(--maroon)" stroke-width="1.6" stroke-dasharray="2 5"/>
  </g>
  <g class="spark">
    <circle cx="100" cy="20" r="3" fill="var(--gold-pale)"/>
    <circle cx="180" cy="100" r="3" fill="var(--gold-pale)"/>
    <circle cx="100" cy="180" r="3" fill="var(--gold-pale)"/>
    <circle cx="20" cy="100" r="3" fill="var(--gold-pale)"/>
  </g>
  <circle class="core" cx="100" cy="100" r="16" fill="var(--gold)"/>
</svg>`;

let currentList = [];
let currentIndex = -1;
let ytPlayer = null;
let ytReady = false;
let isPlaying = false;
let progressTimer = null;
let searchDebounce = null;

// ---------- toast ----------
function showToast(msg, ms = 2200){
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.remove('show'), ms);
}

// ---------- cronologia ----------
function getHistory(){
  try{
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch(e){ return []; }
}
function saveToHistory(track){
  let hist = getHistory();
  hist = hist.filter(h => h.id !== track.id);
  hist.unshift({ ...track, playedAt: Date.now() });
  if (hist.length > HISTORY_MAX) hist = hist.slice(0, HISTORY_MAX);
  try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(hist)); } catch(e){}
}
function clearHistory(){
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
}
function timeAgo(ts){
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'adesso';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' min fa';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' h fa';
  const d = Math.floor(h / 24);
  if (d < 7) return d + ' g fa';
  return new Date(ts).toLocaleDateString('it-IT');
}

function renderHistory(){
  const hist = getHistory();
  if (!hist.length){
    els.historyResults.innerHTML = '';
    els.clearHistBtn.hidden = true;
    els.historyState.style.display = 'flex';
    els.historyState.innerHTML = `
      ${MAGIC_CIRCLE_SVG}
      <h3>Nessun ricordo ancora</h3>
      <p>Le canzoni che ascolti resteranno qui, come pagine di un vecchio libro d'incantesimi.</p>
    `;
    return;
  }
  els.clearHistBtn.hidden = false;
  els.historyState.style.display = 'none';
  els.historyResults.innerHTML = hist.map((tr, i) => `
    <div class="track hist-track" data-i="${i}" style="animation-delay:${i * 30}ms">
      <div class="thumb-wrap">
        <img src="${tr.thumb}" alt="" loading="lazy">
        <div class="eq"><i></i><i></i><i></i></div>
      </div>
      <div class="track-info">
        <div class="t">${escapeHtml(tr.title)}</div>
        <div class="a">${escapeHtml(tr.artist)}</div>
        <div class="hist-time">${timeAgo(tr.playedAt)}</div>
      </div>
    </div>
  `).join('');
  els.historyResults.querySelectorAll('.hist-track').forEach(row => {
    row.addEventListener('click', () => {
      const i = parseInt(row.dataset.i, 10);
      const list = getHistory();
      playFromList(list, i);
    });
  });
}

function switchTab(tab){
  const searching = tab === 'search';
  els.tabSearchBtn.classList.toggle('active', searching);
  els.tabHistoryBtn.classList.toggle('active', !searching);
  els.searchView.hidden = !searching;
  els.historyView.hidden = searching;
  if (!searching) renderHistory();
}
els.tabSearchBtn.addEventListener('click', () => switchTab('search'));
els.tabHistoryBtn.addEventListener('click', () => switchTab('history'));
els.clearHistBtn.addEventListener('click', () => {
  clearHistory();
  showToast('Cronologia svuotata 📜');
});

// ---------- pulviscolo dorato ----------
(function dust(){
  const wrap = document.getElementById('dust');
  const n = 22;
  for (let i = 0; i < n; i++){
    const s = document.createElement('span');
    const size = 3 + Math.random() * 5;
    s.style.width = size + 'px';
    s.style.height = size + 'px';
    s.style.left = Math.random() * 100 + '%';
    s.style.animationDuration = (10 + Math.random() * 14) + 's';
    s.style.animationDelay = (Math.random() * 12) + 's';
    wrap.appendChild(s);
  }
})();

// ---------- YouTube IFrame API ----------
window.onYouTubeIframeAPIReady = function(){
  try{
    ytPlayer = new YT.Player('yt-player-host', {
      height: '90', width: '160',
      playerVars: { playsinline: 1, controls: 0, disablekb: 1, rel: 0 },
      events: {
        onReady: () => { ytReady = true; },
        onStateChange: onPlayerStateChange,
        onError: onPlayerError,
      }
    });
  } catch(e){}
};

setTimeout(() => {
  if (!ytReady && typeof YT === 'undefined'){
    showToast('YouTube non risponde: controlla la connessione e ricarica', 4500);
  }
}, 8000);

function onPlayerStateChange(e){
  if (e.data === YT.PlayerState.PLAYING){
    isPlaying = true;
    updatePlayUI();
    startProgressLoop();
  } else if (e.data === YT.PlayerState.PAUSED){
    isPlaying = false;
    updatePlayUI();
    stopProgressLoop();
  } else if (e.data === YT.PlayerState.ENDED){
    playNext();
  }
}

function onPlayerError(e){
  const code = e && e.data;
  if (code === 101 || code === 150 || code === 100){
    showToast('Video non riproducibile, salto al prossimo 🐇');
    setTimeout(playNext, 700);
  }
}

// ---------- ricerca ----------
els.input.addEventListener('input', () => {
  els.clear.classList.toggle('show', els.input.value.length > 0);
  clearTimeout(searchDebounce);
  const q = els.input.value.trim();
  if (!q){ showEmptyState(); return; }
  searchDebounce = setTimeout(() => search(q), 420);
});

els.clear.addEventListener('click', () => {
  els.input.value = '';
  els.clear.classList.remove('show');
  showEmptyState();
  els.input.focus();
});

els.tags.addEventListener('click', (e) => {
  const t = e.target.closest('.tag');
  if (!t) return;
  els.input.value = t.dataset.q;
  els.clear.classList.add('show');
  search(t.dataset.q);
});

document.getElementById('searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  clearTimeout(searchDebounce);
  const q = els.input.value.trim();
  if (q) search(q);
});

function showEmptyState(){
  els.results.innerHTML = '';
  els.state.innerHTML = `
    ${MAGIC_CIRCLE_SVG}
    <h3>Pronuncia l'incantesimo</h3>
    <p>Cerca una canzone, un artista o un album e lascia che la magia inizi ✨🎶</p>
  `;
  els.state.style.display = 'flex';
}

function showLoading(){
  els.state.style.display = 'none';
  els.results.innerHTML = Array.from({length: 6}).map(() => `
    <div class="skel">
      <div class="thumb-wrap"></div>
      <div class="lines">
        <div class="line w60"></div>
        <div class="line w40"></div>
      </div>
    </div>
  `).join('');
}

async function search(query){
  showLoading();
  const key = ALICE_CONFIG.YOUTUBE_API_KEY;
  const max = ALICE_CONFIG.MAX_RESULTS;
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&videoEmbeddable=true&maxResults=${max}&q=${encodeURIComponent(query)}&key=${key}`;

  try{
    const res = await fetch(url);
    const data = await res.json();

    if (data.error){
      els.results.innerHTML = '';
      els.state.style.display = 'flex';
      els.state.innerHTML = `${MAGIC_CIRCLE_SVG}<h3>Errore</h3><p>${data.error.message}</p>`;
      return;
    }

    const items = (data.items || []).filter(it => it.id && it.id.videoId);
    if (!items.length){
      els.results.innerHTML = '';
      els.state.style.display = 'flex';
      els.state.innerHTML = `${MAGIC_CIRCLE_SVG}<h3>Nessun risultato</h3><p>Prova con un'altra ricerca.</p>`;
      return;
    }

    currentList = items.map(it => ({
      id: it.id.videoId,
      title: decodeHtml(it.snippet.title),
      artist: decodeHtml(it.snippet.channelTitle),
      thumb: it.snippet.thumbnails?.medium?.url || it.snippet.thumbnails?.default?.url,
    }));

    renderResults();
  } catch(err){
    els.results.innerHTML = '';
    els.state.style.display = 'flex';
    els.state.innerHTML = `${MAGIC_CIRCLE_SVG}<h3>Errore di rete</h3><p>Controlla la connessione.</p>`;
  }
}

function decodeHtml(str){
  const t = document.createElement('textarea');
  t.innerHTML = str;
  return t.value;
}

function renderResults(){
  els.state.style.display = 'none';
  els.results.innerHTML = currentList.map((tr, i) => `
    <div class="track" data-i="${i}" style="animation-delay:${i * 40}ms">
      <div class="thumb-wrap">
        <img src="${tr.thumb}" alt="" loading="lazy">
        <div class="eq"><i></i><i></i><i></i></div>
      </div>
      <div class="track-info">
        <div class="t">${escapeHtml(tr.title)}</div>
        <div class="a">${escapeHtml(tr.artist)}</div>
      </div>
      <button class="track-play" data-i="${i}" aria-label="Riproduci">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </button>
    </div>
  `).join('');
  markPlayingRow();
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

els.results.addEventListener('click', (e) => {
  const row = e.target.closest('.track');
  if (!row) return;
  const i = parseInt(row.dataset.i, 10);
  playTrack(i);
});

// ---------- riproduzione e Media Session ----------
function playTrack(i){
  playFromList(currentList, i);
}

function playFromList(list, i){
  if (i < 0 || i >= list.length) return;
  currentList = list;
  currentIndex = i;
  const tr = currentList[i];

  if (!ytReady || !ytPlayer){
    showToast('Caricamento lettore in corso...');
    setTimeout(() => playFromList(list, i), 600);
    return;
  }

  ytPlayer.loadVideoById(tr.id);
  ytPlayer.playVideo();
  els.playerTitle.textContent = tr.title;
  els.playerArtist.textContent = tr.artist;
  els.vinyl.querySelector('img').src = tr.thumb;
  els.player.classList.add('show');
  markPlayingRow();
  saveToHistory(tr);
  if (!els.historyView.hidden) renderHistory();

  // Media Session API per lockscreen e notifiche Android[cite: 6]
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: tr.title,
      artist: tr.artist,
      album: 'AliceMusic ✨',
      artwork: [
        { src: tr.thumb, sizes: '96x96', type: 'image/jpeg' },
        { src: tr.thumb, sizes: '128x128', type: 'image/jpeg' },
        { src: tr.thumb, sizes: '192x192', type: 'image/jpeg' },
        { src: tr.thumb, sizes: '512x512', type: 'image/jpeg' },
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => { ytPlayer.playVideo(); });
    navigator.mediaSession.setActionHandler('pause', () => { ytPlayer.pauseVideo(); });
    navigator.mediaSession.setActionHandler('previoustrack', playPrev);
    navigator.mediaSession.setActionHandler('nexttrack', playNext);
  }

  clearTimeout(playFromList._autoplayCheck);
  playFromList._autoplayCheck = setTimeout(() => {
    if (currentIndex === i && !isPlaying){
      showToast('Autoplay bloccato: tocca ▶️ per avviare', 3200);
    }
  }, 1100);
}

function markPlayingRow(){
  document.querySelectorAll('#results .track, #historyResults .track').forEach(el => {
    el.classList.toggle('playing', parseInt(el.dataset.i, 10) === currentIndex);
  });
}

function updatePlayUI(){
  els.vinyl.classList.toggle('spin', isPlaying);
  els.playBtn.innerHTML = isPlaying
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  markPlayingRow();
}

els.playBtn.addEventListener('click', () => {
  if (!ytPlayer || currentIndex === -1) return;
  if (isPlaying) ytPlayer.pauseVideo(); else ytPlayer.playVideo();
});

function playNext(){
  if (!currentList.length) return;
  const next = (currentIndex + 1) % currentList.length;
  playTrack(next);
}
function playPrev(){
  if (!currentList.length) return;
  const prev = (currentIndex - 1 + currentList.length) % currentList.length;
  playTrack(prev);
}
els.nextBtn.addEventListener('click', playNext);
els.prevBtn.addEventListener('click', playPrev);

// ---------- barra di avanzamento ----------
function startProgressLoop(){
  stopProgressLoop();
  progressTimer = setInterval(() => {
    if (!ytPlayer || !ytPlayer.getDuration) return;
    const dur = ytPlayer.getDuration();
    const cur = ytPlayer.getCurrentTime();
    if (dur > 0) els.progressFill.style.width = (cur / dur * 100) + '%';
  }, 400);
}
function stopProgressLoop(){
  clearInterval(progressTimer);
}
els.progressBar.addEventListener('click', (e) => {
  if (!ytPlayer || !ytPlayer.getDuration) return;
  const rect = els.progressBar.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  const dur = ytPlayer.getDuration();
  ytPlayer.seekTo(dur * pct, true);
});

// ---------- TRUCCO ANDROID: MANTIENI ATTIVO IN BACKGROUND ----------
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    setTimeout(() => {
      if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
        ytPlayer.playVideo();
      }
    }, 600);
  }
});

showEmptyState();
