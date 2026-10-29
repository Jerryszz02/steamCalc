import {
  itadSearch, itadSteamPrices, itadLookupAppid, csSearch, csGameDetail,
  steamWishlist, formatPrice,
} from './api.js';
import {
  computeVerdict, summarizeItad, getVerdictShort, parseSteamInput,
} from './logic.js?v=5';

/* ===== 状态与存储 ===== */
const LS_KEY = 'steamcalc_itad_key';
const LS_COUNTRY = 'steamcalc_country';
const LS_WISHLIST = 'steamcalc_wishlist';
const LS_STEAM_ID = 'steamcalc_steam_id';
const LS_STEAM_KEY = 'steamcalc_steam_key';

const REGIONS = [
  ['CN', '国区 (CNY)'],
  ['US', '美区 (USD)'],
  ['HK', '香港 (HKD)'],
  ['TW', '台湾 (TWD)'],
  ['JP', '日本 (JPY)'],
  ['GB', '英国 (GBP)'],
  ['DE', '德国 (EUR)'],
  ['BR', '巴西 (BRL)'],
];

let apiKey = localStorage.getItem(LS_KEY) || '';
let country = localStorage.getItem(LS_COUNTRY) || 'CN';
let wishlist = JSON.parse(localStorage.getItem(LS_WISHLIST) || '[]');
let steamId = localStorage.getItem(LS_STEAM_ID) || '';
let steamKey = localStorage.getItem(LS_STEAM_KEY) || '';
let importing = false;
let lastResults = [];
let currentGame = null; // {source, id, title}

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function saveWishlist() {
  localStorage.setItem(LS_WISHLIST, JSON.stringify(wishlist));
}

/* ===== 搜索 ===== */
async function doSearch(title) {
  const box = $('search-results');
  box.classList.remove('hidden');
  box.innerHTML = '<div class="loading">搜索中…</div>';
  try {
    if (apiKey) {
      lastResults = (await itadSearch(title, apiKey)).map((g) => ({ source: 'itad', data: g }));
    } else {
      lastResults = (await csSearch(title)).map((g) => ({ source: 'cs', data: g }));
    }
    renderResults();
  } catch (err) {
    showError(box, err);
  }
}

function renderResults() {
  const box = $('search-results');
  if (!lastResults.length) {
    box.innerHTML = '<div class="loading">没有找到相关游戏，换个名称试试。</div>';
    return;
  }
  box.innerHTML = lastResults.map((r, i) => {
    const title = r.source === 'itad' ? r.data.title : r.data.external;
    const priceText = r.source === 'cs' ? `$${r.data.cheapest}` : '';
    return `<button class="result-row" data-idx="${i}" type="button">
      <span class="result-title">${esc(title)}</span>
      ${priceText ? `<span class="result-price">${esc(priceText)}</span>` : ''}
    </button>`;
  }).join('');
  box.querySelectorAll('.result-row').forEach((btn) => {
    btn.addEventListener('click', () => showDetail(Number(btn.dataset.idx)));
  });
}

/* ===== 详情 ===== */
async function loadDetail(r) {
  if (!r) return;
  const box = $('detail');
  $('search-results').classList.add('hidden');
  box.classList.remove('hidden');
  box.innerHTML = '<div class="loading">加载价格中…</div>';
  try {
    if (r.source === 'itad') {
      const entries = await itadSteamPrices([r.data.id], apiKey, country);
      currentGame = { source: 'itad', id: r.data.id, title: r.data.title };
      renderItadDetail(box, r.data.title, entries[0]);
    } else {
      const detail = await csGameDetail(r.data.gameID);
      currentGame = { source: 'cs', id: r.data.gameID, title: detail.info.title };
      renderCsDetail(box, detail);
    }
    if (window.innerWidth <= 800) box.scrollIntoView({ block: 'start' });
  } catch (err) {
    showError(box, err);
  }
}

function showDetail(idx) {
  loadDetail(lastResults[idx]);
}

function showWishlistDetail(source, id) {
  const item = wishlist.find((w) => w.source === source && w.id === id);
  if (!item) return;
  loadDetail(item.source === 'itad'
    ? { source: 'itad', data: { id: item.id, title: item.title } }
    : { source: 'cs', data: { gameID: item.id } });
}

function addWishButtonHtml() {
  const added = currentGame && wishlist.some((w) => w.source === currentGame.source && w.id === currentGame.id);
  return `<button id="add-wish-btn" class="add-wishlist" type="button" ${added ? 'disabled' : ''}>${added ? '已加入愿望单' : '加入愿望单'}</button>`;
}

function syncAddButton() {
  const button = $('add-wish-btn');
  if (!button || !currentGame) return;
  const added = wishlist.some((w) => w.source === currentGame.source && w.id === currentGame.id);
  button.disabled = added;
  button.textContent = added ? '已加入愿望单' : '加入愿望单';
}

function renderItadDetail(box, title, entry) {
  const s = entry && summarizeItad(entry);
  if (!s) {
    box.innerHTML = `<div class="price-panel"><h2 class="game-title">${esc(title)}</h2>
      <p class="empty-note">当前区域暂无 Steam 价格。</p></div>`;
    return;
  }
  const cur = formatPrice(s.current, s.currency);
  const lowText = s.low != null ? formatPrice(s.low, s.currency) : '无数据';
  const hlAll = s.historyLowAll != null ? formatPrice(s.historyLowAll, s.currency) : '无数据';
  box.innerHTML = `<div class="price-panel">
    <h2 class="game-title">${esc(title)}</h2>
    ${s.verdict ? `<p class="price-verdict ${s.verdict.cls}">${esc(s.verdict.text)}</p>` : ''}
    <div class="current-price-row">
      <div><span class="current-label">当前价</span><strong class="current-price">${esc(cur)}</strong></div>
      <p class="regular-price">原价 <s>${esc(formatPrice(s.regular, s.currency))}</s> · 优惠 ${s.cut}%</p>
    </div>
    <dl class="price-comparison">
      <div><dt>Steam 史低</dt><dd>${esc(lowText)}</dd></div>
      <div><dt>全商店史低</dt><dd>${esc(hlAll)}</dd></div>
    </dl>
    ${addWishButtonHtml()}
  </div>`;
  $('add-wish-btn').addEventListener('click', addCurrentToWishlist);
}

function renderCsDetail(box, detail) {
  const steamDeal = detail.deals.find((d) => d.storeID === '1');
  const bestDeal = detail.deals.reduce((a, b) =>
    (a == null || Number(b.price) < Number(a.price) ? b : a), null);
  const shown = steamDeal || bestDeal;
  const current = shown ? Number(shown.price) : null;
  const cut = shown ? Math.round(Number(shown.savings)) : 0;
  const low = detail.cheapestPriceEver ? Number(detail.cheapestPriceEver.price) : null;
  const verdict = computeVerdict(current, low);
  box.innerHTML = `<div class="price-panel">
    <h2 class="game-title">${esc(detail.info.title)}</h2>
    ${verdict ? `<p class="price-verdict ${verdict.cls}">${esc(verdict.text)}</p>` : ''}
    <div class="current-price-row">
      <div><span class="current-label">当前价</span><strong class="current-price">${current != null ? esc(formatPrice(current, 'USD')) : '无数据'}</strong></div>
      <p class="regular-price">原价 <s>${shown ? esc(formatPrice(Number(shown.retailPrice), 'USD')) : '无数据'}</s> · 优惠 ${cut}%</p>
    </div>
    <dl class="price-comparison">
      <div><dt>历史最低</dt><dd>${low != null ? esc(formatPrice(low, 'USD')) : '无数据'}</dd></div>
    </dl>
    ${addWishButtonHtml()}
  </div>`;
  $('add-wish-btn').addEventListener('click', addCurrentToWishlist);
}

/* ===== 愿望单 ===== */
function addCurrentToWishlist() {
  if (!currentGame) return;
  if (wishlist.some((w) => w.source === currentGame.source && w.id === currentGame.id)) {
    renderWishlist();
    return;
  }
  wishlist.push({ ...currentGame });
  saveWishlist();
  syncAddButton();
  refreshWishlistPrices();
}

function removeFromWishlist(source, id) {
  wishlist = wishlist.filter((w) => !(w.source === source && w.id === id));
  saveWishlist();
  renderWishlist();
  syncAddButton();
}

async function refreshWishlistPrices() {
  const refreshButton = $('refresh-wishlist');
  refreshButton.disabled = true;
  refreshButton.textContent = '刷新中…';
  renderWishlist(true);
  const summaries = {};
  try {
    const itadItems = wishlist.filter((w) => w.source === 'itad');
    if (itadItems.length && apiKey) {
      const entries = await itadSteamPrices(itadItems.map((w) => w.id), apiKey, country);
      entries.forEach((entry) => {
        summaries[`itad:${entry.id}`] = summarizeItad(entry);
      });
    }
    for (const w of wishlist.filter((x) => x.source === 'cs')) {
      const detail = await csGameDetail(w.id);
      const steamDeal = detail.deals.find((d) => d.storeID === '1');
      const bestDeal = detail.deals.reduce((a, b) =>
        (a == null || Number(b.price) < Number(a.price) ? b : a), null);
      const shown = steamDeal || bestDeal;
      const current = shown ? Number(shown.price) : null;
      const low = detail.cheapestPriceEver ? Number(detail.cheapestPriceEver.price) : null;
      summaries[`cs:${w.id}`] = {
        current, currency: 'USD', low,
        regular: shown ? Number(shown.retailPrice) : null,
        verdict: computeVerdict(current, low),
      };
    }
  } catch (err) {
    renderWishlist(false, err);
    return;
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = '刷新价格';
  }
  renderWishlist(false, null, summaries);
}

function renderWishlist(loading = false, error = null, summaries = {}) {
  const box = $('wishlist');
  if (!wishlist.length) {
    box.innerHTML = '<p class="empty-note">还没有游戏。搜索后加入愿望单。</p>';
    return;
  }
  if (error) {
    showError(box, error);
    return;
  }
  box.innerHTML = wishlist.map((w) => {
    const s = summaries[`${w.source}:${w.id}`];
    let current = '—';
    let low = '—';
    let verdict = '';
    if (loading) {
      current = '…';
      low = '…';
    } else if (s) {
      current = s.current != null ? formatPrice(s.current, s.currency) : '无数据';
      low = s.low != null ? formatPrice(s.low, s.currency) : '—';
      verdict = getVerdictShort(s.verdict);
    }
    return `<div class="wish-row">
      <button class="wishlist-game" type="button" data-source="${esc(w.source)}" data-id="${esc(w.id)}">${esc(w.title)}</button>
      <span class="wishlist-verdict ${s && s.verdict ? s.verdict.cls : ''}">${esc(verdict)}</span>
      <button class="remove-btn" type="button" data-source="${esc(w.source)}" data-id="${esc(w.id)}" aria-label="从愿望单移除 ${esc(w.title)}">移除</button>
      <div class="wishlist-prices"><span>现价<strong>${esc(current)}</strong></span><span>史低<strong>${esc(low)}</strong></span></div>
    </div>`;
  }).join('');
  box.querySelectorAll('.wishlist-game').forEach((btn) => {
    btn.addEventListener('click', () => showWishlistDetail(btn.dataset.source, btn.dataset.id));
  });
  box.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => removeFromWishlist(btn.dataset.source, btn.dataset.id));
  });
}

/* ===== Steam 愿望单导入 ===== */
async function importSteamWishlist() {
  const status = $('steam-import-status');
  const input = $('steam-id-input').value.trim();
  const sKey = $('steam-key-input').value.trim();
  if (importing) return;
  if (!apiKey) {
    status.textContent = '请先在「API Key 设置」里填 ITAD key，导入时需要用它把 Steam 游戏映射到价格数据。';
    return;
  }
  const parsed = parseSteamInput(input);
  if (!parsed) {
    status.textContent = 'Steam ID 格式不正确：支持 17 位数字 ID、steamcommunity.com/id/xxx 或 /profiles/xxx 链接。';
    return;
  }
  if (!sKey) {
    status.textContent = '请填写 Steam Web API key。';
    return;
  }
  steamId = input;
  steamKey = sKey;
  localStorage.setItem(LS_STEAM_ID, steamId);
  localStorage.setItem(LS_STEAM_KEY, steamKey);

  importing = true;
  try {
    status.textContent = '正在读取 Steam 愿望单…';
    const items = await steamWishlist(parsed.value, steamKey);
    if (!items.length) {
      status.textContent = '愿望单是空的，没有可导入的游戏。';
      return;
    }
    let added = 0;
    let existed = 0;
    let missing = 0;
    let failed = 0;
    let done = 0;
    let aborted = false;
    const queue = [...items];
    // 并发 5 个 worker 逐个查 ITAD 映射，单个失败不阻塞整体导入
    const worker = async () => {
      while (queue.length && !aborted) {
        const { appid } = queue.shift();
        done += 1;
        status.textContent = `正在匹配游戏信息 ${done}/${items.length}…`;
        let r;
        try {
          r = await itadLookupAppid(appid, apiKey);
        } catch (err) {
          // key 无效（auth）或限流（rate）是共享性错误：剩余请求注定同样失败，
          // 置中断标记让所有 worker 收工，避免白白打几百个请求还报误导性的「匹配失败」
          if (err && (err.kind === 'auth' || err.kind === 'rate')) {
            aborted = true;
            throw err;
          }
          failed += 1;
          continue;
        }
        if (!r || !r.found || !r.game) {
          missing += 1;
          continue;
        }
        if (wishlist.some((w) => w.source === 'itad' && w.id === r.game.id)) {
          existed += 1;
        } else {
          wishlist.push({ source: 'itad', id: r.game.id, title: r.game.title });
          added += 1;
        }
      }
    };
    // allSettled 等所有 worker 收工后再统一处理，避免中断时仍有在途请求造成状态不一致
    const settled = await Promise.allSettled(Array.from({ length: 5 }, worker));
    const sharedErr = settled.find((s) => s.status === 'rejected');
    if (sharedErr) {
      if (added > 0) {
        saveWishlist();
        refreshWishlistPrices();
        sharedErr.reason.message += `（已保留本次成功导入的 ${added} 个，修复问题后重新导入即可跳过它们）`;
      }
      throw sharedErr.reason;
    }
    saveWishlist();
    status.textContent = `导入完成：新增 ${added} 个，已存在 ${existed} 个，ITAD 未收录 ${missing} 个`
      + (failed ? `，匹配失败 ${failed} 个（可重新导入重试）` : '');
    refreshWishlistPrices();
  } catch (err) {
    status.textContent = err && err.message ? err.message : '导入失败，请稍后再试';
  } finally {
    importing = false;
  }
}

/* ===== 设置与初始化 ===== */
function showError(box, err) {
  const msg = err && err.message ? err.message : '请求失败，请稍后再试';
  const tip = err && err.kind === 'auth' ? '（点右上角「API Key 设置」检查 key）' : '';
  box.innerHTML = `<div class="error-box">${esc(msg)}${tip}</div>`;
}

function updateSourceHint() {
  const hint = $('source-hint');
  const regionSelect = $('region-select');
  if (apiKey) {
    hint.textContent = 'IsThereAnyDeal · 支持多区价格与 Steam 史低';
    regionSelect.disabled = false;
  } else {
    hint.textContent = '当前使用 CheapShark，仅显示美元价格。';
    regionSelect.disabled = true;
    regionSelect.value = 'US';
  }
}

function init() {
  const regionSelect = $('region-select');
  REGIONS.forEach(([code, label]) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = label;
    regionSelect.appendChild(opt);
  });
  regionSelect.value = country;
  regionSelect.addEventListener('change', () => {
    country = regionSelect.value;
    localStorage.setItem(LS_COUNTRY, country);
    $('detail').classList.add('hidden');
    refreshWishlistPrices();
  });

  $('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('search-input').value.trim();
    if (title) doSearch(title);
  });

  $('refresh-wishlist').addEventListener('click', refreshWishlistPrices);

  const dialog = $('settings-dialog');
  $('settings-btn').addEventListener('click', () => {
    $('api-key-input').value = apiKey;
    dialog.showModal();
  });
  $('settings-close-btn').addEventListener('click', () => {
    dialog.close();
  });
  $('settings-form').addEventListener('submit', () => {
    apiKey = $('api-key-input').value.trim();
    if (apiKey) {
      localStorage.setItem(LS_KEY, apiKey);
    } else {
      localStorage.removeItem(LS_KEY);
    }
    if (!apiKey) country = 'US';
    $('region-select').value = country;
    updateSourceHint();
    $('detail').classList.add('hidden');
    renderWishlist();
  });
  $('clear-key-btn').addEventListener('click', () => {
    $('api-key-input').value = '';
  });

  const steamDialog = $('steam-dialog');
  $('import-steam-btn').addEventListener('click', () => {
    $('steam-id-input').value = steamId;
    $('steam-key-input').value = steamKey;
    $('steam-import-status').textContent = '';
    steamDialog.showModal();
  });
  $('steam-form').addEventListener('submit', (e) => {
    // 导入期间保持弹层打开以展示进度，故阻止 method="dialog" 的默认关闭行为
    e.preventDefault();
    importSteamWishlist();
  });
  $('steam-close-btn').addEventListener('click', () => {
    steamDialog.close();
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search-area')) $('search-results').classList.add('hidden');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') $('search-results').classList.add('hidden');
  });

  updateSourceHint();
  renderWishlist();
}

init();
