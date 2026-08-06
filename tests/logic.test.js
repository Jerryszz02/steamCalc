import { describe, it, expect } from 'vitest';
import { computeVerdict, summarizeItad } from '../logic.js';

describe('computeVerdict 史低判定', () => {
  it('输入缺任一侧价格时返回 null（不展示结论）', () => {
    expect(computeVerdict(null, 50)).toBeNull();
    expect(computeVerdict(50, null)).toBeNull();
    expect(computeVerdict(undefined, undefined)).toBeNull();
  });

  it('史低为 0 且当前免费：现在免费，已是史低', () => {
    expect(computeVerdict(0, 0)).toEqual({ cls: 'good', text: '现在免费，已是史低' });
  });

  it('史低为 0 但当前收费：提示白嫖史低，建议再等等', () => {
    const v = computeVerdict(10, 0);
    expect(v.cls).toBe('bad');
    expect(v.text).toContain('免费白嫖');
  });

  it('当前价低于史低：新史低', () => {
    expect(computeVerdict(40, 50)).toEqual({ cls: 'good', text: '新史低！比历史最低还便宜' });
  });

  it('当前价等于史低：已达史低', () => {
    expect(computeVerdict(50, 50)).toEqual({ cls: 'good', text: '已达史低，可以入手' });
  });

  it('高出史低恰好 10%：仍算接近史低（边界）', () => {
    expect(computeVerdict(55, 50)).toEqual({ cls: 'warn', text: '接近史低（仅高 10%）' });
  });

  it('高出史低超过 10%：建议再等等', () => {
    expect(computeVerdict(60, 50)).toEqual({ cls: 'bad', text: '高于史低 20%，建议再等等' });
  });
});

describe('summarizeItad 提取 ITAD 价格摘要', () => {
  const baseEntry = {
    id: 'g1',
    historyLow: { all: { amount: 30 } },
    deals: [{
      price: { amount: 30, currency: 'CNY' },
      cut: 40,
      regular: { amount: 50 },
      storeLow: { amount: 25, timestamp: '2024-01-01T00:00:00Z' },
    }],
  };

  it('没有 deals 时返回 null（页面显示无数据空态）', () => {
    expect(summarizeItad({ deals: [] })).toBeNull();
    expect(summarizeItad({})).toBeNull();
  });

  it('完整条目：提取现价/原价/史低并给出判定', () => {
    const s = summarizeItad(baseEntry);
    expect(s.current).toBe(30);
    expect(s.currency).toBe('CNY');
    expect(s.cut).toBe(40);
    expect(s.regular).toBe(50);
    expect(s.low).toBe(25);
    expect(s.lowDate).toBe('2024-01-01T00:00:00Z');
    expect(s.historyLowAll).toBe(30);
    // 现价 30 vs Steam 史低 25 → 高 20%
    expect(s.verdict).toEqual({ cls: 'bad', text: '高于史低 20%，建议再等等' });
  });

  it('缺 storeLow 时判定回退到全商店史低 historyLow.all', () => {
    const entry = structuredClone(baseEntry);
    delete entry.deals[0].storeLow;
    const s = summarizeItad(entry);
    expect(s.low).toBeNull();
    expect(s.lowDate).toBeNull();
    // 现价 30 vs 全商店史低 30 → 已达史低
    expect(s.verdict).toEqual({ cls: 'good', text: '已达史低，可以入手' });
  });

  it('缺 historyLow 时 historyLowAll 为 null', () => {
    const entry = structuredClone(baseEntry);
    delete entry.historyLow;
    expect(summarizeItad(entry).historyLowAll).toBeNull();
  });
});
