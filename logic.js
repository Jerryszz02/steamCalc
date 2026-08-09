import { formatPrice } from './api.js';

/* ===== 史低判定（纯函数，不碰 DOM 与网络，可独立测试）===== */
export function computeVerdict(currentAmount, lowAmount) {
  if (currentAmount == null || lowAmount == null) return null;
  if (lowAmount === 0) {
    return currentAmount === 0
      ? { cls: 'good', text: '现在免费，已是史低' }
      : { cls: 'bad', text: '史低是免费白嫖，现在原价，建议再等等' };
  }
  if (currentAmount < lowAmount) {
    return { cls: 'good', text: '新史低！比历史最低还便宜' };
  }
  if (currentAmount === lowAmount) {
    return { cls: 'good', text: '已达史低，可以入手' };
  }
  const diffPct = ((currentAmount - lowAmount) / lowAmount) * 100;
  if (diffPct <= 10) {
    return { cls: 'warn', text: `接近史低（仅高 ${diffPct.toFixed(0)}%）` };
  }
  return { cls: 'bad', text: `高于史低 ${diffPct.toFixed(0)}%，建议再等等` };
}

// 从 ITAD prices/v3 的单个条目中提取摘要
export function summarizeItad(entry) {
  const deal = entry.deals && entry.deals[0];
  if (!deal) return null;
  const current = deal.price.amount;
  const currency = deal.price.currency;
  const cut = deal.cut;
  const low = deal.storeLow ? deal.storeLow.amount : null;
  const lowDate = deal.storeLow ? deal.storeLow.timestamp : null;
  const historyLowAll = entry.historyLow && entry.historyLow.all
    ? entry.historyLow.all.amount : null;
  return {
    current, currency, cut,
    regular: deal.regular.amount,
    low, lowDate, historyLowAll,
    verdict: computeVerdict(current, low != null ? low : historyLowAll),
  };
}

// 愿望单行的价格文案：现价 / 原价（有数据时）/ 史低
export function formatWishlistPriceLine(s) {
  const cur = s.current != null ? formatPrice(s.current, s.currency) : '无数据';
  const low = s.low != null ? formatPrice(s.low, s.currency) : '—';
  const reg = s.regular != null ? formatPrice(s.regular, s.currency) : null;
  return `现价 ${cur}${reg ? ` / 原价 ${reg}` : ''} / 史低 ${low}`;
}

/* ===== Steam 愿望单导入（纯函数）===== */

// 解析用户输入的 Steam 标识：17 位 steamID64、profiles/id 链接或裸 vanity
// 返回 { type: 'steamid' | 'vanity', value }，无法识别返回 null
export function parseSteamInput(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/(profiles|id)\/([^/?#]+)/i);
  if (m) {
    const kind = m[1].toLowerCase();
    const value = m[2];
    if (kind === 'profiles' && /^\d{17}$/.test(value)) return { type: 'steamid', value };
    if (kind === 'id' && /^[a-z0-9_-]{2,32}$/i.test(value)) return { type: 'vanity', value };
    return null;
  }
  if (/^\d{17}$/.test(s)) return { type: 'steamid', value: s };
  if (/^[a-z0-9_-]{2,32}$/i.test(s)) return { type: 'vanity', value: s };
  return null;
}

// 从 IWishlistService/GetWishlist 的响应中提取 [{appid, added}]，容错返回 []
export function extractWishlistItems(data) {
  const items = data && data.response && Array.isArray(data.response.items)
    ? data.response.items : [];
  return items
    .filter((it) => it && typeof it.appid === 'number')
    .map((it) => ({ appid: it.appid, added: typeof it.date_added === 'number' ? it.date_added : null }));
}
