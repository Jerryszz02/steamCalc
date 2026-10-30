import { describe, it, expect } from 'vitest';
import {
  GAMES, searchGames, regionalAmount, formatRegionalPrice, getVerdict, getTrackPositions,
} from '../design-demos/demo-data.js';

describe('UI demo 游戏搜索', () => {
  it('支持英文大小写与中文标题搜索', () => {
    expect(searchGames('  hAdEs ')[0].id).toBe('hades');
    expect(searchGames('小丑牌')[0].id).toBe('balatro');
  });

  it('空输入与无匹配时返回空列表', () => {
    expect(searchGames('   ')).toEqual([]);
    expect(searchGames('不存在的游戏')).toEqual([]);
  });
});

describe('UI demo 区域价格', () => {
  it('按区域换算并格式化价格', () => {
    expect(regionalAmount(48, 'US')).toBeCloseTo(6.72);
    expect(formatRegionalPrice(24, 'CN')).toBe('¥24');
    expect(formatRegionalPrice(24, 'US')).toBe('$3.36');
  });

  it('无效区域或金额返回占位符', () => {
    expect(regionalAmount(24, 'XX')).toBeNull();
    expect(regionalAmount(Number.NaN, 'CN')).toBeNull();
    expect(formatRegionalPrice(null, 'CN')).toBe('—');
  });
});

describe('UI demo 史低判断与价格尺', () => {
  it('覆盖新史低、已达史低、接近史低与观望状态', () => {
    expect(getVerdict({ current: 40, low: 50 }).cls).toBe('good');
    expect(getVerdict({ current: 50, low: 50 }).short).toBe('已达史低');
    expect(getVerdict({ current: 55, low: 50 }).short).toBe('接近史低');
    expect(getVerdict({ current: 56, low: 50 }).short).toBe('再等等');
  });

  it('免费史低与缺失价格不会误判为好价', () => {
    expect(getVerdict({ current: 10, low: 0 }).cls).toBe('bad');
    expect(getVerdict({ current: null, low: 50 }).cls).toBe('unknown');
  });

  it('价格尺的位置限制在 0–100% 内', () => {
    expect(getTrackPositions(GAMES[0])).toEqual({ current: 50, low: 50 });
    expect(getTrackPositions({ regular: 20, current: 30, low: -5 })).toEqual({ current: 100, low: 0 });
  });
});
