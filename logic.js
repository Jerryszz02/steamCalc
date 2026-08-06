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
