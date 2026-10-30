import {
  THEMES, REGIONS, GAMES, searchGames, formatRegionalPrice, getVerdict,
} from './demo-data.js';

const params = new URLSearchParams(window.location.search);
const state = {
  theme: THEMES[params.get('theme')] ? params.get('theme') : 'focus',
  region: 'CN',
  selectedId: 'stardew-valley',
  wishlist: ['hades', 'hollow-knight', 'dave-the-diver'],
  refreshing: false,
};

const root = document.getElementById('demo-root');
const toast = document.getElementById('demo-toast');
let toastTimer;
let refreshTimer;

function esc(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function selectedGame() {
  return GAMES.find((game) => game.id === state.selectedId) || GAMES[0];
}

function wishlistGames() {
  return state.wishlist.map((id) => GAMES.find((game) => game.id === id)).filter(Boolean);
}

function price(amount) {
  return formatRegionalPrice(amount, state.region);
}

function discount(game) {
  return Math.max(0, Math.round((1 - game.current / game.regular) * 100));
}

function appHeader() {
  return `<header class="app-header">
    <div class="app-brand">SteamCalc</div>
    <div class="app-controls">
      <label class="region-control"><span>区域</span><select id="region-select" aria-label="价格区域">
        ${Object.entries(REGIONS).map(([code, region]) => `<option value="${code}" ${code === state.region ? 'selected' : ''}>${region.label} · ${region.currency}</option>`).join('')}
      </select></label>
      <button class="text-button settings-button" type="button" data-action="settings">API Key 设置</button>
    </div>
  </header>`;
}

function searchPanel() {
  return `<section class="search-area" aria-label="搜索游戏">
    <form id="search-form" class="search-form" role="search">
      <label for="search-input">查一款游戏</label>
      <div class="search-line">
        <input id="search-input" type="search" placeholder="例如 Stardew Valley" aria-controls="search-results" aria-expanded="false" autocomplete="off">
        <button class="search-submit" type="submit">查价格</button>
      </div>
    </form>
    <div id="search-results" class="search-results" hidden></div>
  </section>`;
}

function detailPanel(game) {
  const verdict = getVerdict(game);
  const added = state.wishlist.includes(game.id);
  return `<article id="game-detail" class="price-panel" aria-labelledby="game-title">
    <h2 id="game-title" class="game-title">${esc(game.title)}</h2>
    <p class="price-verdict ${verdict.cls}">${verdict.text}</p>
    <div class="current-price-row">
      <div><span class="current-label">当前价</span><strong class="current-price">${price(game.current)}</strong></div>
      <p class="regular-price">原价 <s>${price(game.regular)}</s> · 优惠 ${discount(game)}%</p>
    </div>
    <dl class="price-comparison">
      <div><dt>Steam 史低</dt><dd>${price(game.low)}</dd></div>
      <div><dt>全商店史低</dt><dd>${price(game.allLow)}</dd></div>
    </dl>
    <button class="add-wishlist" type="button" data-action="add" ${added ? 'disabled' : ''}>${added ? '已加入愿望单' : '加入愿望单'}</button>
  </article>`;
}

function wishlistPanel() {
  const games = wishlistGames();
  return `<section class="wishlist-section" aria-labelledby="wishlist-title">
    <div class="wishlist-header">
      <h2 id="wishlist-title">愿望单</h2>
      <div class="wishlist-actions">
        <button class="text-button" type="button" data-action="import">导入 Steam 愿望单</button>
        <button class="text-button" type="button" data-action="refresh" ${state.refreshing ? 'disabled' : ''}>${state.refreshing ? '刷新中…' : '刷新价格'}</button>
      </div>
    </div>
    <div class="wishlist-list">
      ${games.length ? games.map((game) => {
        const verdict = getVerdict(game);
        return `<div class="wishlist-row">
          <button class="wishlist-game" type="button" data-game-id="${game.id}">${esc(game.title)}</button>
          <span class="wishlist-verdict ${verdict.cls}">${verdict.short}</span>
          <button class="wishlist-remove" type="button" data-action="remove" data-id="${game.id}" aria-label="从愿望单移除 ${esc(game.title)}">移除</button>
          <div class="wishlist-prices"><span>现价<strong>${price(game.current)}</strong></span><span>史低<strong>${price(game.low)}</strong></span></div>
        </div>`;
      }).join('') : '<div class="empty-wishlist">还没有游戏。搜索后加入愿望单。</div>'}
    </div>
  </section>`;
}

function focusTemplate() {
  return `<div class="minimal-page focus-page">${appHeader()}${searchPanel()}${detailPanel(selectedGame())}${wishlistPanel()}</div>`;
}

function splitTemplate() {
  return `<div class="minimal-page split-page">${appHeader()}${searchPanel()}<div class="workspace">${detailPanel(selectedGame())}${wishlistPanel()}</div></div>`;
}

function renderApp() {
  document.body.className = `theme-${state.theme}`;
  document.body.dataset.theme = state.theme;
  document.title = `${THEMES[state.theme].name} · SteamCalc 极简 UI`;
  document.querySelectorAll('[data-theme-target]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeTarget === state.theme));
  });
  root.innerHTML = state.theme === 'split' ? splitTemplate() : focusTemplate();
}

function selectTheme(theme) {
  if (!THEMES[theme] || theme === state.theme) return;
  state.theme = theme;
  const url = new URL(window.location.href);
  url.searchParams.set('theme', theme);
  window.history.replaceState({}, '', url);
  renderApp();
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2600);
}

function renderSearchResults(matches) {
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  if (!input || !results) return;
  results.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  results.innerHTML = matches.length ? matches.map((game) => `<button class="search-result" type="button" data-game-id="${game.id}">
    <span class="search-result-title">${esc(game.title)}</span><span class="search-result-price">${price(game.current)}</span>
  </button>`).join('') : '<div class="search-empty">没有找到相关游戏，换个名称试试。</div>';
}

function closeSearchResults() {
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  if (results) results.hidden = true;
  if (input) input.setAttribute('aria-expanded', 'false');
}

function selectGame(id) {
  if (!GAMES.some((game) => game.id === id)) return;
  state.selectedId = id;
  renderApp();
  if (window.innerWidth < 800) {
    document.getElementById('game-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function refreshWishlist() {
  if (state.refreshing) return;
  state.refreshing = true;
  renderApp();
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    state.refreshing = false;
    renderApp();
    showToast('愿望单价格已刷新');
  }, 700);
}

document.addEventListener('click', (event) => {
  const themeButton = event.target.closest('[data-theme-target]');
  if (themeButton) {
    selectTheme(themeButton.dataset.themeTarget);
    return;
  }
  const gameButton = event.target.closest('[data-game-id]');
  if (gameButton) {
    selectGame(gameButton.dataset.gameId);
    return;
  }
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) {
    const { action } = actionButton.dataset;
    if (action === 'settings') document.getElementById('settings-dialog').showModal();
    if (action === 'import') document.getElementById('steam-dialog').showModal();
    if (action === 'refresh') refreshWishlist();
    if (action === 'add' && !state.wishlist.includes(state.selectedId)) {
      state.wishlist.push(state.selectedId);
      renderApp();
      showToast('已加入愿望单');
    }
    if (action === 'remove') {
      state.wishlist = state.wishlist.filter((id) => id !== actionButton.dataset.id);
      renderApp();
      showToast('已从愿望单移除');
    }
    return;
  }
  const closeButton = event.target.closest('[data-close-dialog]');
  if (closeButton) {
    closeButton.closest('dialog')?.close();
    return;
  }
  if (!event.target.closest('.search-area')) closeSearchResults();
});

document.addEventListener('input', (event) => {
  if (event.target.id !== 'search-input') return;
  const query = event.target.value.trim();
  if (query) renderSearchResults(searchGames(query));
  else closeSearchResults();
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'search-form') {
    event.preventDefault();
    const query = document.getElementById('search-input').value.trim();
    if (query) renderSearchResults(searchGames(query));
    else document.getElementById('search-input').focus();
  }
  if (event.target.id === 'settings-form') showToast('演示模式：API Key 未保存');
  if (event.target.id === 'steam-form') {
    if (!state.wishlist.includes('balatro')) state.wishlist.push('balatro');
    renderApp();
    showToast('演示导入完成：新增「小丑牌」');
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id !== 'region-select') return;
  state.region = event.target.value;
  renderApp();
  showToast(`已切换到${REGIONS[state.region].label}示例价格`);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeSearchResults();
});

document.getElementById('clear-key-btn').addEventListener('click', () => {
  document.getElementById('api-key-input').value = '';
});

document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
});

renderApp();
