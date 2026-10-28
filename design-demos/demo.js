import {
  THEMES, REGIONS, GAMES, searchGames, formatRegionalPrice, getVerdict, getTrackPositions,
} from './demo-data.js';

const params = new URLSearchParams(window.location.search);
const state = {
  theme: THEMES[params.get('theme')] ? params.get('theme') : 'aurora',
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

function icon(name) {
  const paths = {
    search: '<circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path>',
    settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"></path><circle cx="16" cy="7" r="2"></circle><circle cx="8" cy="17" r="2"></circle>',
    plus: '<path d="M12 5v14M5 12h14"></path>',
    check: '<path d="m5 12 4 4L19 6"></path>',
    refresh: '<path d="M20 7v5h-5"></path><path d="M19 12a7 7 0 1 1-2-5"></path>',
    close: '<path d="m6 6 12 12M18 6 6 18"></path>',
    arrow: '<path d="M5 12h14M14 7l5 5-5 5"></path>',
    import: '<path d="M12 3v12M7 10l5 5 5-5"></path><path d="M5 20h14"></path>',
    chevron: '<path d="m8 10 4 4 4-4"></path>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
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

function regionControl(extraClass = '') {
  return `<label class="region-control ${extraClass}">
    <span>价格区域</span>
    <select id="region-select" aria-label="价格区域">
      ${Object.entries(REGIONS).map(([code, region]) =>
        `<option value="${code}" ${code === state.region ? 'selected' : ''}>${region.label} · ${region.currency}</option>`).join('')}
    </select>
    ${icon('chevron')}
  </label>`;
}

function settingsControl(extraClass = '') {
  return `<button class="icon-button ${extraClass}" type="button" data-action="settings" aria-label="API Key 设置">
    ${icon('settings')}<span class="control-label">API Key 设置</span>
  </button>`;
}

function searchControl(theme) {
  const buttonText = theme === 'ledger' ? '查询价格' : theme === 'cartridge' ? '找游戏' : '查询';
  return `<div class="search-area ${theme}-search-area">
    <form id="search-form" class="search-form ${theme}-search-form" role="search">
      ${icon('search')}
      <input id="search-input" type="search" placeholder="输入游戏名，试试 Hades" aria-label="搜索游戏" aria-controls="search-results" aria-expanded="false" autocomplete="off">
      <button class="search-submit ${theme}-search-submit" type="submit">${buttonText}${icon('arrow')}</button>
    </form>
    <div id="search-results" class="search-results ${theme}-search-results" hidden></div>
  </div>`;
}

function priceTrack(game, extraClass = '') {
  const positions = getTrackPositions(game);
  return `<div class="price-track ${extraClass}" aria-label="当前价 ${price(game.current)}，历史最低 ${price(game.low)}，原价 ${price(game.regular)}">
    <div class="price-track-line">
      <span class="price-track-fill" style="--fill: ${positions.current}%"></span>
      <span class="price-track-low" style="--low: ${positions.low}%"></span>
    </div>
    <div class="price-track-labels"><span>免费</span><span>史低位置</span><span>原价 ${price(game.regular)}</span></div>
  </div>`;
}

function addButton(game, extraClass = '') {
  const added = state.wishlist.includes(game.id);
  return `<button class="primary-action ${extraClass}" type="button" data-action="add" ${added ? 'disabled' : ''}>
    ${icon(added ? 'check' : 'plus')}<span>${added ? '已在愿望单' : '加入愿望单'}</span>
  </button>`;
}

function wishlistActions(extraClass = '') {
  return `<div class="section-actions ${extraClass}">
    <button class="secondary-action" type="button" data-action="import">${icon('import')}<span>导入 Steam</span></button>
    <button class="secondary-action refresh-action ${state.refreshing ? 'is-refreshing' : ''}" type="button" data-action="refresh" ${state.refreshing ? 'disabled' : ''}>
      ${icon('refresh')}<span>${state.refreshing ? '刷新中' : '刷新价格'}</span>
    </button>
  </div>`;
}

function emptyWishlist() {
  return '<div class="empty-wishlist">愿望单还是空的。搜索一款游戏，把它加入价格跟踪。</div>';
}

function demoFooter(extraClass = '') {
  return `<footer class="demo-footer ${extraClass}">
    <p>UI DESIGN PROTOTYPE · 所有价格均为示例，非实时数据</p>
    <p>正式版数据源：IsThereAnyDeal / CheapShark</p>
  </footer>`;
}

function auroraDetail(game) {
  const verdict = getVerdict(game);
  return `<article id="game-detail" class="aurora-deal">
    <div class="aurora-deal-art">
      <img src="${game.hero}" alt="${esc(game.title)} 游戏宣传图">
      <div class="aurora-art-top"><span>STEAM / ${state.region}</span><strong>−${discount(game)}%</strong></div>
      <span class="aurora-art-caption">FEATURED PRICE SIGNAL</span>
    </div>
    <div class="aurora-deal-body">
      <div class="aurora-title-row">
        <div><p>${esc(game.genre)}</p><h2>${esc(game.title)}</h2></div>
        <span class="status-badge ${verdict.cls}">${verdict.short}</span>
      </div>
      <div class="aurora-current-row">
        <div><span>当前价格</span><strong class="price-figure">${price(game.current)}</strong></div>
        <span class="aurora-regular">原价 <s>${price(game.regular)}</s></span>
      </div>
      <p class="aurora-verdict-copy">${verdict.text}</p>
      ${priceTrack(game, 'aurora-price-track')}
      <dl class="aurora-stats">
        <div><dt>Steam 史低</dt><dd>${price(game.low)}</dd><small>${game.lowDate}</small></div>
        <div><dt>全商店史低</dt><dd>${price(game.allLow)}</dd><small>含第三方商店</small></div>
        <div><dt>当前折扣</dt><dd>−${discount(game)}%</dd><small>Steam 商店</small></div>
      </dl>
      <div class="aurora-deal-actions">${addButton(game)}<span>加入后可持续跟踪价格变化</span></div>
    </div>
  </article>`;
}

function auroraWishlist() {
  const games = wishlistGames();
  const goodCount = games.filter((game) => getVerdict(game).cls === 'good').length;
  return `<section class="aurora-wishlist" aria-labelledby="aurora-wishlist-title">
    <div class="section-heading">
      <div><p>WATCHLIST / ${String(games.length).padStart(2, '0')}</p><h2 id="aurora-wishlist-title">你的价格雷达</h2></div>
      ${wishlistActions()}
    </div>
    <div class="aurora-watch-summary"><span><i></i>${goodCount} 款已达史低</span><span>本地愿望单 · 仅保存在当前浏览器</span></div>
    <div class="aurora-watch-list">
      ${games.length ? games.map((game) => {
        const verdict = getVerdict(game);
        return `<div class="aurora-watch-row">
          <button class="aurora-watch-game" type="button" data-game-id="${game.id}">
            <img src="${game.image}" alt="">
            <span><strong>${esc(game.title)}</strong><small>${esc(game.chineseTitle)}</small></span>
          </button>
          <span class="status-badge ${verdict.cls}">${verdict.short}</span>
          <div class="aurora-watch-price"><strong class="price-figure">${price(game.current)}</strong><s>${price(game.regular)}</s></div>
          <div class="aurora-watch-low"><span>史低</span><strong>${price(game.low)}</strong></div>
          <button class="remove-game" type="button" data-action="remove" data-id="${game.id}" aria-label="从愿望单移除 ${esc(game.title)}">${icon('close')}</button>
        </div>`;
      }).join('') : emptyWishlist()}
    </div>
  </section>`;
}

function auroraTemplate() {
  const game = selectedGame();
  return `<div class="aurora-page">
    <header class="product-nav aurora-nav">
      <div class="product-brand"><span class="aurora-logo" aria-hidden="true"><i></i><i></i></span><span>steamcalc<span class="aurora-brand-dot">.</span></span></div>
      <div class="product-controls">${regionControl('aurora-region')}${settingsControl('aurora-settings')}</div>
    </header>
    <section class="aurora-hero">
      <div class="aurora-intro">
        <p class="aurora-eyebrow"><span></span>PRICE SIGNAL / 价格雷达</p>
        <h1>好游戏，<br><em>也值得好价格。</em></h1>
        <p class="aurora-lead">查当前价，对比 Steam 与全商店历史最低。<br>不用记价格，也知道现在值不值得入手。</p>
        ${searchControl('aurora')}
        <div class="aurora-quick"><span>快速查看</span>${GAMES.slice(1, 4).map((item) => `<button type="button" data-game-id="${item.id}">${esc(item.chineseTitle)}</button>`).join('')}</div>
        <div class="aurora-live-note"><span class="aurora-pulse"></span><span>多区价格 · 史低判断 · 愿望单跟踪</span></div>
      </div>
      ${auroraDetail(game)}
    </section>
    ${auroraWishlist()}
    ${demoFooter('aurora-footer')}
  </div>`;
}

function ledgerDetail(game) {
  const verdict = getVerdict(game);
  return `<article id="game-detail" class="ledger-detail">
    <div class="ledger-detail-heading">
      <button class="ledger-game-identity" type="button" data-action="scroll-search">
        <img src="${game.image}" alt="${esc(game.title)} 游戏封面">
        <span><small>当前查询 / ${esc(game.genre)}</small><strong>${esc(game.title)}</strong><em>${esc(game.chineseTitle)}</em></span>
      </button>
      <span class="status-badge ${verdict.cls}">${verdict.short}</span>
    </div>
    <div class="ledger-price-layout">
      <div class="ledger-current">
        <span>当前价格 / ${state.region}</span>
        <div><strong class="price-figure">${price(game.current)}</strong><b>−${discount(game)}%</b></div>
        <p>${verdict.text}</p>
      </div>
      <dl class="ledger-comparison">
        <div><dt>商店原价</dt><dd>${price(game.regular)}</dd><small>STEAM REGULAR</small></div>
        <div><dt>Steam 史低</dt><dd>${price(game.low)}</dd><small>${game.lowDate}</small></div>
        <div><dt>全商店史低</dt><dd>${price(game.allLow)}</dd><small>ALL STORES</small></div>
      </dl>
      <div class="ledger-detail-action">${addButton(game)}<span>加入本地愿望单</span></div>
    </div>
    ${priceTrack(game, 'ledger-price-track')}
  </article>`;
}

function ledgerWishlist() {
  const games = wishlistGames();
  return `<section class="ledger-wishlist" aria-labelledby="ledger-wishlist-title">
    <div class="section-heading">
      <div><p>LOCAL COLLECTION</p><h2 id="ledger-wishlist-title">本地愿望单 <sup>${games.length}</sup></h2></div>
      ${wishlistActions()}
    </div>
    <div class="ledger-table" role="table" aria-label="本地愿望单价格">
      <div class="ledger-table-head" role="row"><span>游戏</span><span>判断</span><span>当前价</span><span>史低</span><span></span></div>
      ${games.length ? games.map((game) => {
        const verdict = getVerdict(game);
        return `<div class="ledger-table-row" role="row">
          <button class="ledger-table-game" type="button" data-game-id="${game.id}"><img src="${game.image}" alt=""><span><strong>${esc(game.title)}</strong><small>${esc(game.chineseTitle)}</small></span></button>
          <span class="status-badge ${verdict.cls}">${verdict.short}</span>
          <div class="ledger-table-price"><strong>${price(game.current)}</strong><s>${price(game.regular)}</s></div>
          <span class="ledger-table-low">${price(game.low)}</span>
          <button class="remove-game" type="button" data-action="remove" data-id="${game.id}" aria-label="从愿望单移除 ${esc(game.title)}">${icon('close')}</button>
        </div>`;
      }).join('') : emptyWishlist()}
    </div>
  </section>`;
}

function ledgerTemplate() {
  const game = selectedGame();
  return `<div class="ledger-page">
    <header class="product-nav ledger-nav">
      <div class="product-brand"><span class="ledger-logo" aria-hidden="true">S/</span><span>SteamCalc <small>价格档案</small></span></div>
      <div class="product-controls">${regionControl('ledger-region')}${settingsControl('ledger-settings')}</div>
    </header>
    <section class="ledger-intro">
      <div><p class="ledger-kicker">STEAM PRICE INDEX — 价格决策工具</p><h1>史低判断，<br><em>一眼见底。</em></h1></div>
      <div class="ledger-search-column"><p>把原价、现价与历史最低放在同一把尺上。<br>价格来自哪里，为什么值得买，都清楚可见。</p>${searchControl('ledger')}<div class="ledger-search-meta"><span>支持 8 个价格区域</span><span>ITAD + CHEAPSHARK</span></div></div>
    </section>
    ${ledgerDetail(game)}
    <div class="ledger-lower">
      ${ledgerWishlist()}
      <aside class="ledger-guide">
        <p>READING GUIDE</p><h2>如何判断好价</h2>
        <dl><div><dt><i class="good"></i>已达史低</dt><dd>现价不高于历史最低</dd></div><div><dt><i class="warn"></i>接近史低</dt><dd>现价比史低高 10% 以内</dd></div><div><dt><i class="bad"></i>再等等</dt><dd>现价高出史低 10% 以上</dd></div></dl>
        <p class="ledger-guide-note">切换区域后，详情与愿望单会一起换算。这里的数值仅用于演示界面。</p>
      </aside>
    </div>
    ${demoFooter('ledger-footer')}
  </div>`;
}

function cartridgeDetail(game) {
  const verdict = getVerdict(game);
  return `<article id="game-detail" class="cartridge-deal">
    <div class="cartridge-ridges" aria-hidden="true">${'<i></i>'.repeat(9)}</div>
    <div class="cartridge-label">
      <div class="cartridge-art"><img src="${game.image}" alt="${esc(game.title)} 游戏封面"><span>−${discount(game)}%</span><small>STEAM CALC SELECT</small></div>
      <div class="cartridge-title"><div><p>${esc(game.genre)}</p><h2>${esc(game.title)}</h2></div><span class="status-badge ${verdict.cls}">${verdict.short}</span></div>
      <div class="cartridge-price"><span>NOW / ${state.region}</span><strong class="price-figure">${price(game.current)}</strong><s>${price(game.regular)}</s></div>
      <p class="cartridge-verdict">${verdict.text}</p>
      ${priceTrack(game, 'cartridge-price-track')}
    </div>
    <div class="cartridge-bottom"><div><span>STEAM LOW</span><strong>${price(game.low)}</strong></div>${addButton(game)}</div>
    <span class="cartridge-notch" aria-hidden="true"></span>
  </article>`;
}

function cartridgeWishlist() {
  const games = wishlistGames();
  return `<section class="cartridge-shelf" aria-labelledby="cartridge-shelf-title">
    <div class="section-heading">
      <div><p>YOUR GAME SHELF</p><h2 id="cartridge-shelf-title">想玩收藏架 <span>${String(games.length).padStart(2, '0')}</span></h2></div>
      ${wishlistActions()}
    </div>
    <div class="shelf-grid">
      ${games.length ? games.map((game) => {
        const verdict = getVerdict(game);
        return `<article class="shelf-card">
          <button class="shelf-select" type="button" data-game-id="${game.id}" aria-label="查看 ${esc(game.title)} 的价格">
            <div class="shelf-art"><img src="${game.image}" alt=""><span>−${discount(game)}%</span></div>
            <div class="shelf-copy"><small>${esc(game.chineseTitle)}</small><strong>${esc(game.title)}</strong></div>
          </button>
          <div class="shelf-price"><span class="status-badge ${verdict.cls}">${verdict.short}</span><div><strong>${price(game.current)}</strong><small>史低 ${price(game.low)}</small></div><button class="remove-game" type="button" data-action="remove" data-id="${game.id}" aria-label="从愿望单移除 ${esc(game.title)}">${icon('close')}</button></div>
        </article>`;
      }).join('') : emptyWishlist()}
    </div>
    <div class="shelf-base" aria-hidden="true"></div>
  </section>`;
}

function cartridgeTemplate() {
  const game = selectedGame();
  return `<div class="cartridge-page">
    <header class="product-nav cartridge-nav">
      <div class="product-brand"><span class="cartridge-logo" aria-hidden="true">✦</span><span>BACKLOG<span>club</span></span><small>by SteamCalc</small></div>
      <div class="product-controls">${regionControl('cartridge-region')}${settingsControl('cartridge-settings')}</div>
    </header>
    <section class="cartridge-hero">
      <div class="cartridge-intro">
        <p class="cartridge-eyebrow"><span>PLAY IT LATER</span> / PAY LESS</p>
        <h1>想玩的游戏，<br><em>等到好价再入手。</em></h1>
        <p class="cartridge-lead">把想玩的游戏放上收藏架。<br>当前价离史低有多远，一眼就知道。</p>
        ${searchControl('cartridge')}
        <div class="cartridge-quick"><span>试试这些：</span>${GAMES.slice(1, 4).map((item) => `<button type="button" data-game-id="${item.id}">${esc(item.chineseTitle)}</button>`).join('')}</div>
        <div class="cartridge-feature-list"><span><b>CN</b>多区价格</span><span><b>↓</b>史低提醒</span><span><b>＋</b>本地收藏</span></div>
      </div>
      <div class="cartridge-stage"><span class="cartridge-stage-note">TODAY'S PICK ↘</span>${cartridgeDetail(game)}<span class="cartridge-stage-shadow" aria-hidden="true"></span></div>
    </section>
    ${cartridgeWishlist()}
    ${demoFooter('cartridge-footer')}
  </div>`;
}

function renderApp() {
  document.body.className = `theme-${state.theme}`;
  document.body.dataset.theme = state.theme;
  document.title = `${THEMES[state.theme].name} · SteamCalc UI 设计对比`;
  document.querySelectorAll('[data-theme-target]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeTarget === state.theme));
  });
  const templates = { aurora: auroraTemplate, ledger: ledgerTemplate, cartridge: cartridgeTemplate };
  root.innerHTML = templates[state.theme]();
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
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2800);
}

function renderSearchResults(matches) {
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  if (!input || !results) return;
  results.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  results.innerHTML = matches.length ? matches.map((game) => `<button class="search-result" type="button" data-game-id="${game.id}">
    <img src="${game.image}" alt="">
    <span class="search-result-title"><strong>${esc(game.title)}</strong><small>${esc(game.chineseTitle)}</small></span>
    <span class="search-result-price">${price(game.current)}</span>
  </button>`).join('') : '<div class="search-empty">没有找到相关游戏，试试 Stardew、Hades 或「小丑牌」。</div>';
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
  if (window.innerWidth < 760) {
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
    showToast('愿望单价格已刷新 · 演示数据没有变化');
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
      showToast(`${selectedGame().chineseTitle}已加入愿望单`);
    }
    if (action === 'remove') {
      const removed = GAMES.find((game) => game.id === actionButton.dataset.id);
      state.wishlist = state.wishlist.filter((id) => id !== actionButton.dataset.id);
      renderApp();
      showToast(`${removed ? removed.chineseTitle : '游戏'}已从愿望单移除`);
    }
    if (action === 'scroll-search') document.getElementById('search-input')?.focus();
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
  if (event.target.id === 'settings-form') {
    showToast('UI 演示模式：API Key 未保存');
  }
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
  showToast(`已切换至${REGIONS[state.region].label} · 显示示例价格`);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeSearchResults();
});

document.addEventListener('error', (event) => {
  if (event.target instanceof HTMLImageElement) {
    event.target.hidden = true;
    event.target.parentElement?.classList.add('image-unavailable');
  }
}, true);

document.getElementById('clear-key-btn').addEventListener('click', () => {
  document.getElementById('api-key-input').value = '';
});

document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
});

renderApp();
