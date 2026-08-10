// ============================================
// AliceMusic — app.js (Versione Sicura e Definitiva)
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  const els = {
    input: document.getElementById('searchInput'),
    clear: document.getElementById('clearBtn'),
    tags: document.getElementById('tagRow'),
    state: document.getElementById('state'),
    results: document.getElementById('results'),
    infiniteLoader: document.getElementById('infiniteLoader'),
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

  let currentQuery = '';
  let emulatedNextPageToken = '';
  let isFetchingMore = false;

  // ---------- toast ----------
  function showToast(msg, ms = 2200){
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => els.toast.classList.remove('show'), ms);
  }

  // ---------- cronologia ----------
  function getHistory(){
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch(e){ return []; }
  }
  function saveToHistory(track){
    try {
      let hist = getHistory();
      hist = hist.filter(h => h.id !== track.id);
      hist.unshift({ ...track, playedAt: Date.now() });
      if (hist.length > HISTORY_MAX) hist = hist.slice(0, HISTORY_MAX);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    } catch(e){}
  }
  function clearHistory(){
    try {
      localStorage.removeItem(HISTORY_KEY);
      renderHistory();
    } catch(e){}
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
    if (!els.historyResults || !els.historyState) return;
    const hist = getHistory();
    if (!hist.length){
      els.historyResults.innerHTML = '';
      if (els.clearHistBtn) els.clearHistBtn.hidden = true;
      els.historyState.style.display = 'flex';
      els.historyState.innerHTML = `
        ${MAGIC_CIRCLE_SVG}
        <h3>Nessun ricordo ancora</h3>
        <p>Le canzoni che ascolti resteranno qui, come pagine di un vecchio libro d'incantesimi.</p>
      `;
      return;
    }
    if (els.clearHistBtn) els.clearHistBtn.hidden = false;
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
        playFromList(getHistory(), parseInt(row.dataset.i, 10));
      });
    });
  }

  function switchTab(tab){
    const searching = tab === 'search';
    if (els.tabSearchBtn) els.tabSearchBtn.classList.toggle('active', searching);
    if (els.tabHistoryBtn) els.tabHistoryBtn.classList.toggle('active', !searching);
    if (els.searchView) els.searchView.hidden = !searching;
    if (els.historyView) els.historyView.hidden = searching;
    if (!searching) renderHistory();
  }

  if (els.tabSearchBtn) els.tabSearchBtn.addEventListener('click', () => switchTab('search'));
  if (els.tabHistoryBtn) els.tabHistoryBtn.addEventListener('click', () => switchTab('history'));
  if (els.clearHistBtn) els.clearHistBtn.addEventListener('click', () => {
    clearHistory();
    showToast('Cronologia svuotata 📜');
  });

  // ---------- polvere dorata ----------
  (function dust(){
    const wrap = document.getElementById('dust');
    if (!wrap) return;
    for (let i = 0; i < 22; i++){
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
    console.log("[DEBUG] YouTube IFrame API pronta.");
    try {
      ytPlayer = new YT.Player('yt-player-host', {
        height: '90', width: '160',
        playerVars: { playsinline: 1, controls: 0, disablekb: 1, rel: 0 },
        events: {
          onReady: () => { ytReady = true; console.log("[DEBUG] ytPlayer pronto."); },
          onStateChange: onPlayerStateChange,
          onError: onPlayerError,
        }
      });
    } catch(e){
      console.error("[ERROR] ytPlayer init:", e);
    }
  };

  function onPlayerStateChange(e){
    if (e.data === YT.PlayerState.PLAYING){
      isPlaying = true; updatePlayUI(); startProgressLoop();
    } else if (e.data === YT.PlayerState.PAUSED){
      isPlaying = false; updatePlayUI(); stopProgressLoop();
    } else if (e.data === YT.PlayerState.ENDED){
      playNext();
    }
  }

  function onPlayerError(e){
    const code = e && e.data;
    if (code === 101 || code === 150 || code === 100){
      showToast('Brano non riproducibile, salto al prossimo 🐇');
      setTimeout(playNext, 700);
    }
  }

  // ---------- GESTIONE INPUT E RICERCA ----------
  if (els.input) {
    els.input.addEventListener('input', () => {
      if (els.clear) els.clear.classList.toggle('show', els.input.value.length > 0);
      clearTimeout(searchDebounce);
      const q = els.input.value.trim();
      if (!q){ showEmptyState(); return; }
      searchDebounce = setTimeout(() => requestEmulatedYouTubeAPI(q, true), 400);
    });
  }

  if (els.clear) {
    els.clear.addEventListener('click', () => {
      els.input.value = '';
      els.clear.classList.remove('show');
      showEmptyState();
      els.input.focus();
    });
  }

  if (els.tags) {
    els.tags.addEventListener('click', (e) => {
      const t = e.target.closest('.tag');
      if (!t) return;
      els.input.value = t.dataset.q;
      if (els.clear) els.clear.classList.add('show');
      requestEmulatedYouTubeAPI(t.dataset.q, true);
    });
  }

  const searchForm = document.getElementById('searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearTimeout(searchDebounce);
      const q = els.input.value.trim();
      if (q) requestEmulatedYouTubeAPI(q, true);
    });
  }

  function showEmptyState(){
    currentList = [];
    emulatedNextPageToken = '';
    if (els.results) els.results.innerHTML = '';
    if (els.infiniteLoader) els.infiniteLoader.style.display = 'none';
    if (els.state) {
      els.state.innerHTML = `
        ${MAGIC_CIRCLE_SVG}
        <h3>Pronuncia l'incantesimo</h3>
        <p>Cerca una canzone, un artista o un album ✨🎶</p>
      `;
      els.state.style.display = 'flex';
    }
  }

  function showLoading(){
    if (els.state) els.state.style.display = 'none';
    if (els.results) {
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
  }

  // =========================================================================
  // EMULATORE API
  // =========================================================================
  async function requestEmulatedYouTubeAPI(query, isNewSearch = false) {
    console.log(`[EMULATOR] Ricerca: "${query}", Nuova: ${isNewSearch}`);
    
    if (isNewSearch) {
      currentQuery = query;
      emulatedNextPageToken = 'CAUQAA';
      currentList = [];
      showLoading();
    } else {
      if (isFetchingMore || !emulatedNextPageToken) return;
      isFetchingMore = true;
      if (els.infiniteLoader) els.infiniteLoader.style.display = 'block';
    }

    await new Promise(resolve => setTimeout(resolve, 300));

    const mockResponse = generateMockGooglePayload(currentQuery, emulatedNextPageToken);

    const fetchedTracks = mockResponse.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      thumb: item.snippet.thumbnails.medium.url,
    }));

    emulatedNextPageToken = mockResponse.nextPageToken || '';

    currentList = isNewSearch ? fetchedTracks : currentList.concat(fetchedTracks);
    isFetchingMore = false;
    if (els.infiniteLoader) els.infiniteLoader.style.display = 'none';

    renderResults();
  }

  function generateMockGooglePayload(query, pageToken) {
    const items = [];
    const baseIdList = ['jfKfPfyJRdk', 'L_LUpnjgPso', '5qap5aO4i9A', '9bZkp7q19f0', 'kJQP7kiw5Fk'];
    
    for (let i = 1; i <= 12; i++) {
      const randomId = baseIdList[Math.floor(Math.random() * baseIdList.length)];
      items.push({
        kind: "youtube#searchResult",
        id: { kind: "youtube#video", videoId: randomId },
        snippet: {
          publishedAt: new Date().toISOString(),
          title: `${query.charAt(0).toUpperCase() + query.slice(1)} - Traccia Emulata ${i}`,
          thumbnails: { medium: { url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=320&auto=format&fit=crop&q=80' } },
          channelTitle: `Canale Ufficiale ${query}`
        }
      });
    }

    return {
      kind: "youtube#searchListResponse",
      nextPageToken: pageToken ? "CB4QAA_next" : "",
      items: items
    };
  }

  function renderResults(){
    if (!els.results || !els.state) return;
    els.state.style.display = 'none';
    els.results.innerHTML = currentList.map((tr, i) => `
      <div class="track" data-i="${i}" style="animation-delay:${(i % 12) * 20}ms">
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

  function escapeHtml(str){
    return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // ---------- SCROLL INFINITO ----------
  window.addEventListener('scroll', () => {
    if (els.searchView && els.searchView.hidden) return;
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight >= scrollHeight - 250) {
      if (currentQuery && !isFetchingMore && emulatedNextPageToken) {
        requestEmulatedYouTubeAPI(currentQuery, false);
      }
    }
  });

  if (els.results) {
    els.results.addEventListener('click', (e) => {
      const row = e.target.closest('.track');
      if (!row) return;
      playTrack(parseInt(row.dataset.i, 10));
    });
  }

  // ---------- RIPRODUZIONE AUDIO ----------
  function playTrack(i){
    playFromList(currentList, i);
  }

  function playFromList(list, i){
    if (i < 0 || i >= list.length) return;
    currentList = list;
    currentIndex = i;
    const tr = currentList[i];

    if (!ytReady || !ytPlayer){
      showToast('Inizializzazione lettore...');
      setTimeout(() => playFromList(list, i), 600);
      return;
    }

    ytPlayer.loadVideoById(tr.id);
    ytPlayer.playVideo();
    if (els.playerTitle) els.playerTitle.textContent = tr.title;
    if (els.playerArtist) els.playerArtist.textContent = tr.artist;
    const vinylImg = els.vinyl ? els.vinyl.querySelector('img') : null;
    if (vinylImg) vinylImg.src = tr.thumb;
    if (els.player) els.player.classList.add('show');
    markPlayingRow();
    saveToHistory(tr);
    if (els.historyView && !els.historyView.hidden) renderHistory();
  }

  function markPlayingRow(){
    document.querySelectorAll('#results .track, #historyResults .track').forEach(el => {
      el.classList.toggle('playing', parseInt(el.dataset.i, 10) === currentIndex);
    });
  }

  function updatePlayUI(){
    if (els.vinyl) els.vinyl.classList.toggle('spin', isPlaying);
    if (els.playBtn) {
      els.playBtn.innerHTML = isPlaying
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    }
    markPlayingRow();
  }

  if (els.playBtn) {
    els.playBtn.addEventListener('click', () => {
      if (!ytPlayer || currentIndex === -1) return;
      if (isPlaying) ytPlayer.pauseVideo(); else ytPlayer.playVideo();
    });
  }

  function playNext(){
    if (!currentList.length) return;
    playTrack((currentIndex + 1) % currentList.length);
  }
  function playPrev(){
    if (!currentList.length) return;
    playTrack((currentIndex - 1 + currentList.length) % currentList.length);
  }
  if (els.nextBtn) els.nextBtn.addEventListener('click', playNext);
  if (els.prevBtn) els.prevBtn.addEventListener('click', playPrev);

  function startProgressLoop(){
    stopProgressLoop();
    progressTimer = setInterval(() => {
      if (!ytPlayer || !ytPlayer.getDuration) return;
      const dur = ytPlayer.getDuration();
      const cur = ytPlayer.getCurrentTime();
      if (dur > 0 && els.progressFill) els.progressFill.style.width = (cur / dur * 100) + '%';
    }, 400);
  }
  function stopProgressLoop(){ clearInterval(progressTimer); }

  if (els.progressBar) {
    els.progressBar.addEventListener('click', (e) => {
      if (!ytPlayer || !ytPlayer.getDuration) return;
      const rect = els.progressBar.getBoundingClientRect();
      ytPlayer.seekTo(ytPlayer.getDuration() * ((e.clientX - rect.left) / rect.width), true);
    });
  }

  showEmptyState();
});
