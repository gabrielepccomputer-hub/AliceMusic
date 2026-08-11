// ============================================
// AliceMusic — app.js (Versione Mobile Definitiva)
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  const els = {
    input: document.getElementById('searchInput'),
    clear: document.getElementById('clearBtn'),
    tags: document.getElementById('tagRow'),
    typeFilter: document.getElementById('typeFilter'),
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
    searchForm: document.getElementById('searchForm'),
    fsPlayer: document.getElementById('fullscreenPlayer'),
    fsClose: document.getElementById('fsCloseBtn'),
    fsCover: document.getElementById('fsCover'),
    fsTitle: document.getElementById('fsTitle'),
    fsArtist: document.getElementById('fsArtist'),
    fsProgressBar: document.getElementById('fsProgressBar'),
    fsProgressFill: document.getElementById('fsProgressFill'),
    fsTimeCurrent: document.getElementById('fsTimeCurrent'),
    fsTimeDuration: document.getElementById('fsTimeDuration'),
    fsPrevBtn: document.getElementById('fsPrevBtn'),
    fsPlayBtn: document.getElementById('fsPlayBtn'),
    fsNextBtn: document.getElementById('fsNextBtn'),
    ytHost: document.getElementById('yt-player-host')
  };

  const HISTORY_KEY = 'aliceMusic_cronologia';
  const HISTORY_MAX = 60;
  const DOUBLE_TAP_MS = 300;
  const SERVER_URL = 'https://server-music-alice-music.vercel.app';

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
  let currentPlayingId = null;
  let ytPlayer = null;
  let ytReady = false;
  let isPlaying = false;
  let progressTimer = null;
  let searchDebounce = null;
  let currentQuery = '';
  let currentSearchType = 'song';
  let lastTapId = null;
  let lastTapTime = 0;
  let tapTimeout = null;
  let hasInteracted = false;

  // Sblocca l'audio sui browser mobile al primo tocco
  document.body.addEventListener('click', () => {
    hasInteracted = true;
    if (ytPlayer && ytPlayer.isMuted && ytPlayer.isMuted()) {
      ytPlayer.unMute();
    }
  }, { once: true });

  function showToast(msg, ms = 2200){
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => els.toast.classList.remove('show'), ms);
  }

  function formatTime(seconds){
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

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
    els.historyResults.innerHTML = hist.map((tr, i) => trackRowHtml(tr, i, true)).join('');

    els.historyResults.querySelectorAll('.track').forEach(row => {
      row.addEventListener('click', () => {
        handleTrackTap(parseInt(row.dataset.i, 10), getHistory());
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

  if (els.typeFilter) {
    els.typeFilter.addEventListener('click', (e) => {
      const btn = e.target.closest('.type-btn');
      if (!btn) return;
      currentSearchType = btn.dataset.type;
      els.typeFilter.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b === btn));
      const q = els.input ? els.input.value.trim() : '';
      if (q) searchMusic(q);
    });
  }

  function normalizeSearchResponse(data){
    if (!data) return [];
    if (Array.isArray(data.tracks)) {
      return data.tracks.map(tr => ({
        id: tr.id,
        title: tr.title || 'Senza titolo',
        artist: tr.artist || 'Sconosciuto',
        thumb: tr.thumb || (tr.id ? `https://i.ytimg.com/vi/${tr.id}/mqdefault.jpg` : ''),
        album: tr.album || null,
        duration: tr.duration || null,
        kind: tr.kind || 'song'
      }));
    }
    return [];
  }

  async function searchMusic(query) {
    currentQuery = query;
    showLoading();

    try {
      const typeParam = currentSearchType && currentSearchType !== 'all'
        ? `&type=${encodeURIComponent(currentSearchType)}`
        : '';
      
      const res = await fetch(`${SERVER_URL}/api/search?q=${encodeURIComponent(query)}${typeParam}`);
      if (!res.ok) throw new Error('Errore di connessione al server');

      const data = await res.json();
      const tracks = normalizeSearchResponse(data);

      if (query !== currentQuery) return;

      if (!tracks.length) {
        showEmptyState();
        showToast('Nessun risultato trovato 🔍');
        return;
      }

      currentList = tracks;
      renderResults();
    } catch (e) {
      console.error(e);
      showEmptyState();
      showToast('Il server non risponde, riprova tra poco 🐇');
    }
  }

  function showEmptyState(){
    currentList = [];
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

  function trackActionIcon(tr){
    if (tr.kind === 'artist' || tr.kind === 'playlist' || tr.kind === 'album') {
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
    }
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  }

  function trackRowHtml(tr, i, isHistory){
    const subtitle = isHistory
      ? `<div class="a">${escapeHtml(tr.artist)}</div><div class="hist-time">${timeAgo(tr.playedAt)}</div>`
      : `<div class="a">${escapeHtml(tr.artist)}${tr.album ? ' · ' + escapeHtml(tr.album) : ''}</div>`;
    return `
      <div class="track${isHistory ? ' hist-track' : ''}" data-i="${i}" style="animation-delay:${(i % 12) * 20}ms; touch-action: manipulation;">
        <div class="thumb-wrap">
          <img src="${tr.thumb}" alt="" loading="lazy">
          <div class="eq"><i></i><i></i><i></i></div>
        </div>
        <div class="track-info">
          <div class="t">${escapeHtml(tr.title)}</div>
          ${subtitle}
        </div>
        ${!isHistory && tr.duration ? `<span class="hist-time" style="margin-top:0;">${escapeHtml(tr.duration)}</span>` : ''}
        <button class="track-play" data-i="${i}" aria-label="Azione">
          ${trackActionIcon(tr)}
        </button>
      </div>
    `;
  }

  function renderResults(){
    if (!els.results || !els.state) return;
    els.state.style.display = 'none';
    els.results.innerHTML = currentList.map((tr, i) => trackRowHtml(tr, i, false)).join('');
    markPlayingRow();
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  if (els.searchForm) {
    els.searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = els.input ? els.input.value.trim() : '';
      if (q) searchMusic(q);
      return false;
    });
  }

  if (els.input) {
    els.input.addEventListener('input', () => {
      if (els.clear) els.clear.classList.toggle('show', els.input.value.length > 0);
      clearTimeout(searchDebounce);
      const q = els.input.value.trim();
      if (!q){ showEmptyState(); return; }
      searchDebounce = setTimeout(() => searchMusic(q), 500);
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
      searchMusic(t.dataset.q);
    });
  }

  if (els.results) {
    els.results.addEventListener('click', (e) => {
      const row = e.target.closest('.track');
      if (!row) return;
      handleTrackTap(parseInt(row.dataset.i, 10), currentList);
    });
  }

  async function handleTrackTap(i, list){
    const tr = list[i];
    if (!tr) return;

    if (tr.kind === 'artist') {
      openArtistModal(tr.id, tr.title);
      return;
    }

    if (tr.kind === 'playlist' || tr.kind === 'album') {
      showToast(`Caricamento ${tr.title}... 🎶`);
      try {
        const res = await fetch(`${SERVER_URL}/api/playlist?id=${encodeURIComponent(tr.id)}`);
        const data = await res.json();
        if (data.tracks && data.tracks.length > 0) {
          currentList = data.tracks;
          renderResults();
          showToast(`Playlist caricata! ✨`);
        } else {
          showToast(`Nessun brano trovato nella playlist`);
        }
      } catch(e) {
        showToast(`Errore nel caricamento della playlist`);
      }
      return;
    }

    const now = Date.now();
    const isDouble = lastTapId === tr.id && (now - lastTapTime) < DOUBLE_TAP_MS;

    if (isDouble) {
      clearTimeout(tapTimeout);
      playFromList(list, i);
      openFullscreenPlayer();
      lastTapId = null;
      lastTapTime = 0;
    } else {
      lastTapId = tr.id;
      lastTapTime = now;
      tapTimeout = setTimeout(() => {
        playFromList(list, i);
      }, DOUBLE_TAP_MS);
    }
  }

  async function openArtistModal(artistId, artistName) {
    const modal = document.getElementById('artistModal');
    const titleEl = document.getElementById('artistModalName');
    const contentEl = document.getElementById('artistModalContent');
    
    if (!modal) return;
    titleEl.textContent = artistName;
    contentEl.innerHTML = `<p style="color:#aaa; text-align:center;">Caricamento brani di ${artistName}...</p>`;
    modal.style.display = 'block';

    try {
      const res = await fetch(`${SERVER_URL}/api/artist?id=${encodeURIComponent(artistId)}`);
      const data = await res.json();
      
      if (!data.tracks || data.tracks.length === 0) {
        contentEl.innerHTML = `<p style="color:#aaa; text-align:center;">Nessun brano trovato per questo artista.</p>`;
        return;
      }

      contentEl.innerHTML = data.tracks.map((tr, i) => trackRowHtml(tr, i, false)).join('');

      contentEl.querySelectorAll('.track').forEach(row => {
        row.addEventListener('click', () => {
          modal.style.display = 'none';
          handleTrackTap(parseInt(row.dataset.i, 10), data.tracks);
        });
      });
    } catch(e) {
      contentEl.innerHTML = `<p style="color:#ff5555; text-align:center;">Errore di caricamento.</p>`;
    }
  }

  const closeArtistBtn = document.getElementById('closeArtistModal');
  if (closeArtistBtn) {
    closeArtistBtn.addEventListener('click', () => {
      const modal = document.getElementById('artistModal');
      if (modal) modal.style.display = 'none';
    });
  }

  window.onYouTubeIframeAPIReady = function(){
    try {
      ytPlayer = new YT.Player('yt-player-host', {
        height: '1',
        width: '1',
        playerVars: { playsinline: 1, controls: 0, disablekb: 1, rel: 0 },
        events: {
          onReady: () => { ytReady = true; },
          onStateChange: onPlayerStateChange,
          onError: onPlayerError,
        }
      });
    } catch(e){}
  };

  function onPlayerStateChange(e){
    if (e.data === YT.PlayerState.PLAYING){
      isPlaying = true; 
      updatePlayUI(); 
      startProgressLoop();
      if (ytPlayer.isMuted && ytPlayer.isMuted() && hasInteracted) {
        ytPlayer.unMute();
      }
    } else if (e.data === YT.PlayerState.PAUSED){
      isPlaying = false; 
      updatePlayUI(); 
      stopProgressLoop();
    } else if (e.data === YT.PlayerState.ENDED){
      playNext();
    }
  }

  function onPlayerError(e){
    const msg = (e.data === 101 || e.data === 150) 
      ? 'Questo brano ha restrizioni di copyright, salto al prossimo ⏭️'
      : 'Brano non riproducibile, salto al prossimo 🐇';
    showToast(msg);
    setTimeout(playNext, 700);
  }

  function playTrack(i){
    playFromList(currentList, i);
  }

  function playFromList(list, i){
    if (i < 0 || i >= list.length) return;
    const tr = list[i];
    if (!tr || tr.kind === 'artist' || tr.kind === 'playlist' || tr.kind === 'album') return;

    const sameTrack = tr.id === currentPlayingId && currentIndex === i && currentList === list;
    currentList = list;
    currentIndex = i;

    if (!ytReady || !ytPlayer){
      showToast('Inizializzazione lettore...');
      setTimeout(() => playFromList(list, i), 600);
      return;
    }

    if (!sameTrack) {
      currentPlayingId = tr.id;
      ytPlayer.cueVideoById(tr.id);
    }
    ytPlayer.playVideo();

    if (els.playerTitle) els.playerTitle.textContent = tr.title;
    if (els.playerArtist) els.playerArtist.textContent = tr.artist;
    const vinylImg = els.vinyl ? els.vinyl.querySelector('img') : null;
    if (vinylImg) vinylImg.src = tr.thumb;

    updateFullscreenMeta(tr);

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
    if (els.fsCover) els.fsCover.classList.toggle('spin', isPlaying);
    const playIconPath = isPlaying
      ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
    if (els.playBtn) {
      els.playBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">${playIconPath}</svg>`;
    }
    if (els.fsPlayBtn) {
      els.fsPlayBtn.innerHTML = `<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">${playIconPath}</svg>`;
    }
    markPlayingRow();
  }

  function togglePlayPause(){
    if (!ytPlayer || currentIndex === -1) return;
    if (isPlaying) ytPlayer.pauseVideo(); else ytPlayer.playVideo();
  }
  if (els.playBtn) els.playBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlayPause(); });
  if (els.fsPlayBtn) els.fsPlayBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlayPause(); });

  function playNext(){
    if (!currentList.length) return;
    playTrack((currentIndex + 1) % currentList.length);
  }
  function playPrev(){
    if (!currentList.length) return;
    playTrack((currentIndex - 1 + currentList.length) % currentList.length);
  }
  if (els.nextBtn) els.nextBtn.addEventListener('click', (e) => { e.stopPropagation(); playNext(); });
  if (els.prevBtn) els.prevBtn.addEventListener('click', (e) => { e.stopPropagation(); playPrev(); });
  if (els.fsNextBtn) els.fsNextBtn.addEventListener('click', (e) => { e.stopPropagation(); playNext(); });
  if (els.fsPrevBtn) els.fsPrevBtn.addEventListener('click', (e) => { e.stopPropagation(); playPrev(); });

  function startProgressLoop(){
    stopProgressLoop();
    progressTimer = setInterval(() => {
      if (!ytPlayer || !ytPlayer.getDuration) return;
      const dur = ytPlayer.getDuration();
      const cur = ytPlayer.getCurrentTime();
      if (dur > 0) {
        const pct = (cur / dur * 100) + '%';
        if (els.progressFill) els.progressFill.style.width = pct;
        if (els.fsProgressFill) els.fsProgressFill.style.width = pct;
        if (els.fsTimeCurrent) els.fsTimeCurrent.textContent = formatTime(cur);
        if (els.fsTimeDuration) els.fsTimeDuration.textContent = formatTime(dur);
      }
    }, 400);
  }
  function stopProgressLoop(){ clearInterval(progressTimer); }

  function seekFromBar(bar, e){
    if (!ytPlayer || !ytPlayer.getDuration) return;
    const rect = bar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    ytPlayer.seekTo(ytPlayer.getDuration() * ratio, true);
  }
  if (els.progressBar) els.progressBar.addEventListener('click', (e) => { e.stopPropagation(); seekFromBar(els.progressBar, e); });
  if (els.fsProgressBar) els.fsProgressBar.addEventListener('click', (e) => { e.stopPropagation(); seekFromBar(els.fsProgressBar, e); });

  function updateFullscreenMeta(tr){
    if (els.fsTitle) els.fsTitle.textContent = tr.title;
    if (els.fsArtist) els.fsArtist.textContent = tr.artist;
    const img = els.fsCover ? els.fsCover.querySelector('img') : null;
    if (img) img.src = tr.thumb;
  }

  function openFullscreenPlayer(){
    if (!els.fsPlayer || currentIndex === -1) return;
    els.fsPlayer.classList.add('show');
  }
  function closeFullscreenPlayer(){
    if (!els.fsPlayer) return;
    els.fsPlayer.classList.remove('show');
  }
  if (els.fsClose) els.fsClose.addEventListener('click', (e) => { e.stopPropagation(); closeFullscreenPlayer(); });

  if (els.player) {
    els.player.addEventListener('click', (e) => {
      if (e.target.closest('.controls') || e.target.closest('.progress')) return;
      openFullscreenPlayer();
    });
  }

  showEmptyState();
});
