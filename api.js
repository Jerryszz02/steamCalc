/* ===== IsThereAnyDeal API（主数据源，需要 key）===== */
const ITAD_BASE = 'https://api.isthereanydeal.com';
const STEAM_SHOP_ID = 61;

async function itadFetch(path, key, options = {}) {
  const sep = path.includes('?') ? '&' : '?';
  let res;
  try {
    res = await fetch(`${ITAD_BASE}${path}${sep}key=${encodeURIComponent(key)}`, options);
  } catch {
    // ITAD 的 4xx 错误响应不带 CORS 头，key 无效时浏览器会把 403 掩盖成
    // TypeError: Failed to fetch，走到这里最常见的其实就是 key 无效
    throw new ApiError('无法连接 ITAD：最常见的原因是 API key 无效或已过期（ITAD 的错误响应不允许浏览器读取，会显示为网络错误）；也可能是网络不通或被广告拦截插件拦截', 'auth');
  }
  if (res.status === 401 || res.status === 403) {
    throw new ApiError('ITAD key 无效或未授权，请检查 API Key 设置', 'auth');
  }
  if (res.status === 429) {
    throw new ApiError('请求太频繁，触发了 ITAD 限流，请稍后再试', 'rate');
  }
  if (!res.ok) {
    throw new ApiError(`ITAD 请求失败（HTTP ${res.status}）`, 'http');
  }
  return res.json();
}

// 按标题搜索游戏，返回 [{id, title, type, ...}]
async function itadSearch(title, key) {
  const path = `/games/search/v1?title=${encodeURIComponent(title)}&results=10`;
  return itadFetch(path, key);
}

// 批量查询 Steam 当前价 + 史低价，返回 [{id, historyLow, deals}]
async function itadSteamPrices(ids, key, country) {
  // 注意：不能带 Content-Type: application/json 头。
  // ITAD 的预检响应不包含 access-control-allow-headers，浏览器会因
  // content-type 非安全头部而拦截请求（Failed to fetch，与 key 无关）。
  // 不带该头时 fetch 默认 text/plain（安全头部，免预检），服务端实测照常解析 JSON body。
  return itadFetch(`/games/prices/v3?country=${country}&shops=${STEAM_SHOP_ID}`, key, {
    method: 'POST',
    body: JSON.stringify(ids),
  });
}

/* ===== CheapShark API（兜底，无需 key，仅美元）===== */
const CS_BASE = 'https://www.cheapshark.com/api/1.0';

async function csFetch(path) {
  let res;
  try {
    res = await fetch(`${CS_BASE}${path}`);
  } catch {
    throw new ApiError('无法连接 CheapShark，请检查网络或广告拦截插件', 'network');
  }
  if (!res.ok) {
    throw new ApiError(`CheapShark 请求失败（HTTP ${res.status}）`, 'http');
  }
  return res.json();
}

// 返回 [{gameID, external, thumb, cheapest}]
async function csSearch(title) {
  return csFetch(`/games?title=${encodeURIComponent(title)}&limit=10`);
}

// 返回 {info, cheapestPriceEver:{price,date}, deals:[{storeID, price, retailPrice, savings}]}
async function csGameDetail(gameID) {
  return csFetch(`/games?id=${encodeURIComponent(gameID)}`);
}

/* ===== 通用 ===== */
class ApiError extends Error {
  constructor(message, kind) {
    super(message);
    this.kind = kind;
  }
}

function formatPrice(amount, currency) {
  try {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function formatDate(iso) {
  if (!iso) return '未知';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '未知';
  return d.toLocaleDateString('zh-CN');
}
