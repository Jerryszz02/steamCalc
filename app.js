import {
  itadSearch, itadSteamPrices, itadLookupAppid, csSearch, csGameDetail,
  steamWishlist, formatPrice, formatDate,
} from './api.js';
import {
  computeVerdict, summarizeItad, formatWishlistPriceLine, parseSteamInput,
} from './logic.js';

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
    box.innerHTML = '<div class="loading">没有找到相关游戏</div>';
    return;
  }
  box.innerHTML = lastResults.map((r, i) => {
    if (r.source === 'itad') {
      return `<button class="result-row" data-idx="${i}" type="button">
        <span>${esc(r.data.title)}</span>
        <span class="type-tag">${esc(r.data.type || 'game')}</span>
      </button>`;
    }
    const img = r.data.thumb ? `<img src="${esc(r.data.thumb)}" alt="">` : '';
    return `<button class="result-row" data-idx="${i}" type="button">
      ${img}<span>${esc(r.data.external)}</span>
      <span class="type-tag">$${esc(r.data.cheapest)}</span>
    </button>`;
  }).join('');
  box.querySelectorAll('.result-row').forEach((btn) => {
    btn.addEventListener('click', () => showDetail(Number(btn.dataset.idx)));
  });
}

/* ===== 详情 ===== */
async function showDetail(idx) {
  const r = lastResults[idx];
  const box = $('detail');
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
  } catch (err) {
    showError(box, err);
  }
}

function renderItadDetail(box, title, entry) {
  const s = entry && summarizeItad(entry);
  if (!s) {
    box.innerHTML = `<div class="card"><h2>${esc(title)}</h2>
      <p class="empty-note">该游戏在当前区域（${esc(country)}）的 Steam 暂无价格数据。</p></div>`;
    return;
  }
  const cur = formatPrice(s.current, s.currency);
  const lowText = s.low != null ? formatPrice(s.low, s.currency) : '无数据';
  const hlAll = s.historyLowAll != null ? formatPrice(s.historyLowAll, s.currency) : '无数据';
  box.innerHTML = `<div class="card">
    <h2>${esc(title)}</h2>
    <div class="sub">区域：${esc(country)} · 商店：Steam · 数据：IsThereAnyDeal</div>
    ${s.verdict ? `<div><span class="verdict ${s.verdict.cls}">${esc(s.verdict.text)}</span></div>` : ''}
    <div class="price-grid">
      <div class="price-box">
        <div class="label">原价</div>
        <div class="value">${esc(formatPrice(s.regular, s.currency))}</div>
      </div>
      <div class="price-box">
        <div class="label">当前价${s.cut > 0 ? `<span class="cut-badge">-${s.cut}%</span>` : ''}</div>
        <div class="value">${esc(cur)}</div>
      </div>
      <div class="price-box">
        <div class="label">Steam 史低</div>
        <div class="value">${esc(lowText)}</div>
        <div class="extra">${esc(formatDate(s.lowDate))}</div>
      </div>
      <div class="price-box">
        <div class="label">全商店史低</div>
        <div class="value">${esc(hlAll)}</div>
        <div class="extra">含第三方商店</div>
      </div>
    </div>
    <button id="add-wish-btn" class="btn btn-primary" type="button">加入愿望单</button>
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
  const lowDate = detail.cheapestPriceEver
    ? new Date(detail.cheapestPriceEver.date * 1000).toISOString() : null;
  const verdict = computeVerdict(current, low);
  box.innerHTML = `<div class="card">
    <h2>${esc(detail.info.title)}</h2>
    <div class="sub">数据：CheapShark（仅美元）· ${steamDeal ? 'Steam 价格' : '全网最低价（非 Steam）'}</div>
    ${verdict ? `<div><span class="verdict ${verdict.cls}">${esc(verdict.text)}</span></div>` : ''}
    <div class="price-grid">
      <div class="price-box">
        <div class="label">原价</div>
        <div class="value">${shown ? '$' + Number(shown.retailPrice).toFixed(2) : '无数据'}</div>
      </div>
      <div class="price-box">
        <div class="label">当前价${cut > 0 ? `<span class="cut-badge">-${cut}%</span>` : ''}</div>
        <div class="value">${current != null ? '$' + current.toFixed(2) : '无数据'}</div>
      </div>
      <div class="price-box">
        <div class="label">历史最低</div>
        <div class="value">${low != null ? '$' + low.toFixed(2) : '无数据'}</div>
        <div class="extra">${esc(formatDate(lowDate))}</div>
      </div>
    </div>
    <button id="add-wish-btn" class="btn btn-primary" type="button">加入愿望单</button>
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
  refreshWishlistPrices();
}

function removeFromWishlist(source, id) {
  wishlist = wishlist.filter((w) => !(w.source === source && w.id === id));
  saveWishlist();
  renderWishlist();
}

async function refreshWishlistPrices() {
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
  }
  renderWishlist(false, null, summaries);
}

function renderWishlist(loading = false, error = null, summaries = {}) {
  const box = $('wishlist');
  if (!wishlist.length) {
    box.innerHTML = '<p class="empty-note">愿望单是空的。搜索游戏后点「加入愿望单」即可跟踪史低。</p>';
    return;
  }
  if (error) {
    showError(box, error);
    return;
  }
  box.innerHTML = wishlist.map((w) => {
    const s = summaries[`${w.source}:${w.id}`];
    let info = '<span class="price-info">—</span>';
    let chip = '';
    if (loading) {
      info = '<span class="price-info">加载中…</span>';
    } else if (s) {
      info = `<span class="price-info">${esc(formatWishlistPriceLine(s))}</span>`;
      if (s.verdict) chip = `<span class="chip ${s.verdict.cls}">${esc(s.verdict.text)}</span>`;
    }
    return `<div class="wish-row">
      <span class="title">${esc(w.title)}</span>
      ${chip}${info}
      <button class="remove-btn" data-source="${w.source}" data-id="${esc(w.id)}" title="移除">✕</button>
    </div>`;
  }).join('');
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
    const queue = [...items];
    // 并发 5 个 worker 逐个查 ITAD 映射，单个失败不阻塞整体导入
    const worker = async () => {
      while (queue.length) {
        const { appid } = queue.shift();
        done += 1;
        status.textContent = `正在匹配游戏信息 ${done}/${items.length}…`;
        let r;
        try {
          r = await itadLookupAppid(appid, apiKey);
        } catch {
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
    await Promise.all(Array.from({ length: 5 }, worker));
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
    hint.textContent = '数据源：IsThereAnyDeal · 支持多区价格与 Steam 史低';
    regionSelect.disabled = false;
  } else {
    hint.textContent = '数据源：CheapShark（仅美元）。设置 ITAD API key 可查国区等多区价格。';
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

  updateSourceHint();
  renderWishlist();
}

init();
