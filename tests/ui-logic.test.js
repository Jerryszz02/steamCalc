import { describe, it, expect } from 'vitest';
import { computeVerdict, getVerdictShort } from '../logic.js';

describe('getVerdictShort 愿望单简洁判断', () => {
  it('将详细判断映射为简短标签', () => {
    expect(getVerdictShort(computeVerdict(40, 50))).toBe('新史低');
    expect(getVerdictShort(computeVerdict(50, 50))).toBe('已达史低');
    expect(getVerdictShort(computeVerdict(55, 50))).toBe('接近史低');
    expect(getVerdictShort(computeVerdict(60, 50))).toBe('再等等');
  });

  it('没有判断或类型未知时返回空字符串', () => {
    expect(getVerdictShort(null)).toBe('');
    expect(getVerdictShort({ cls: 'unknown', text: '暂无数据' })).toBe('');
  });
});
