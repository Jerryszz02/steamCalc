import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  itadSearch, itadSteamPrices, itadLookupAppid, csSearch, csGameDetail,
  steamWishlist, ApiError, formatPrice, formatDate,
} from '../api.js';

function jsonResponse(data, { status = 200, ok = true } = {}) {
  return { status, ok, json: async () => data };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ITAD 接口', () => {
  it('itadSearch 拼接搜索 URL：编码标题、results=10、附带 key', async () => {
    fetch.mockResolvedValue(jsonResponse([{ id: 'g1', title: 'Stardew Valley' }]));
    const res = await itadSearch('Stardew Valley', 'mykey');
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('https://api.isthereanydeal.com/games/search/v1');
    expect(url).toContain('title=Stardew%20Valley');
    expect(url).toContain('results=10');
    expect(url).toContain('key=mykey');
    expect(res).toHaveLength(1);
  });

  it('itadSteamPrices 用 POST 发 JSON 数组，按 country 和 Steam 商店过滤', async () => {
    fetch.mockResolvedValue(jsonResponse([]));
    await itadSteamPrices(['g1', 'g2'], 'mykey', 'CN');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/games/prices/v3');
    expect(url).toContain('country=CN');
    expect(url).toContain('shops=61');
    expect(options.method).toBe('POST');
    expect(options.body).toBe('["g1","g2"]');
  });

  it('itadSteamPrices 不得设置 Content-Type 头（ITAD CORS 预检不含 allow-headers，带了会被浏览器拦截）', async () => {
    fetch.mockResolvedValue(jsonResponse([]));
    await itadSteamPrices(['g1'], 'mykey', 'US');
    const options = fetch.mock.calls[0][1];
    expect(options.headers).toBeUndefined();
  });

  it('401/403 → auth 错误', async () => {
    fetch.mockResolvedValue(jsonResponse({}, { status: 403, ok: false }));
    await expect(itadSearch('x', 'badkey')).rejects.toMatchObject({ kind: 'auth' });
  });

  it('429 → rate 错误', async () => {
    fetch.mockResolvedValue(jsonResponse({}, { status: 429, ok: false }));
    await expect(itadSearch('x', 'k')).rejects.toMatchObject({ kind: 'rate' });
  });

  it('其他非 2xx → http 错误', async () => {
    fetch.mockResolvedValue(jsonResponse({}, { status: 500, ok: false }));
    await expect(itadSearch('x', 'k')).rejects.toMatchObject({ kind: 'http' });
  });

  it('fetch 抛异常 → auth 错误（ITAD 4xx 不带 CORS 头，浏览器会掩盖成 Failed to fetch）', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(itadSearch('x', 'k')).rejects.toMatchObject({ kind: 'auth' });
  });

  it('itadLookupAppid 拼接 lookup URL：带 appid 与 key', async () => {
    fetch.mockResolvedValue(jsonResponse({ found: true, game: { id: 'g1', title: 'Stardew Valley' } }));
    const res = await itadLookupAppid(413150, 'mykey');
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('https://api.isthereanydeal.com/games/lookup/v1');
    expect(url).toContain('appid=413150');
    expect(url).toContain('key=mykey');
    expect(res.game.title).toBe('Stardew Valley');
  });
});

describe('Steam 愿望单导入接口', () => {
  it('steamWishlist 以 POST 请求同源 /api/steam-wishlist，input/key 放 body（不进 URL 日志）', async () => {
    fetch.mockResolvedValue(jsonResponse({ items: [{ appid: 413150, added: 1700000000 }] }));
    const items = await steamWishlist('76561199441847079', 'AB'.repeat(16));
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/steam-wishlist');
    expect(url).not.toContain('key');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      input: '76561199441847079',
      key: 'AB'.repeat(16),
    });
    expect(items).toEqual([{ appid: 413150, added: 1700000000 }]);
  });

  it('403 → auth 错误，透传服务端 error 文案', async () => {
    fetch.mockResolvedValue(
      jsonResponse({ error: 'Steam API key 无效或已过期' }, { status: 403, ok: false }),
    );
    await expect(steamWishlist('x', 'k'))
      .rejects.toMatchObject({ kind: 'auth', message: 'Steam API key 无效或已过期' });
  });

  it('其他非 2xx → http 错误', async () => {
    fetch.mockResolvedValue(jsonResponse({ error: 'bad' }, { status: 502, ok: false }));
    await expect(steamWishlist('x', 'k')).rejects.toMatchObject({ kind: 'http', message: 'bad' });
  });

  it('200 但非 JSON（静态服务器把函数当静态文件返回）→ unsupported 错误', async () => {
    fetch.mockResolvedValue({
      status: 200, ok: true, json: async () => { throw new Error('not json'); },
    });
    await expect(steamWishlist('x', 'k')).rejects.toMatchObject({ kind: 'unsupported' });
  });

  it('网络失败 → network 错误', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(steamWishlist('x', 'k')).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('CheapShark 接口', () => {
  it('csSearch 拼接搜索 URL', async () => {
    fetch.mockResolvedValue(jsonResponse([{ gameID: '1', external: 'Game' }]));
    const res = await csSearch('my game');
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('https://www.cheapshark.com/api/1.0/games');
    expect(url).toContain('title=my%20game');
    expect(url).toContain('limit=10');
    expect(res[0].gameID).toBe('1');
  });

  it('csGameDetail 按 id 查询', async () => {
    fetch.mockResolvedValue(jsonResponse({ info: { title: 'Game' } }));
    await csGameDetail('123');
    expect(fetch.mock.calls[0][0]).toContain('/games?id=123');
  });

  it('网络失败 → network 错误', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(csSearch('x')).rejects.toMatchObject({ kind: 'network' });
  });

  it('非 2xx → http 错误', async () => {
    fetch.mockResolvedValue(jsonResponse({}, { status: 502, ok: false }));
    await expect(csSearch('x')).rejects.toMatchObject({ kind: 'http' });
  });
});

describe('格式化工具', () => {
  it('formatPrice 按币种格式化', () => {
    expect(formatPrice(50, 'CNY')).toContain('50');
    expect(formatPrice(9.99, 'USD')).toContain('9.99');
  });

  it('formatPrice 遇到非法币种时回退为「金额 + 币种」', () => {
    expect(formatPrice(50, 'XX')).toBe('50 XX');
  });

  it('formatDate 非法输入返回「未知」', () => {
    expect(formatDate(null)).toBe('未知');
    expect(formatDate('not-a-date')).toBe('未知');
    expect(formatDate('2024-01-15T00:00:00Z')).not.toBe('未知');
  });

  it('ApiError 携带 kind 供 UI 分类提示', () => {
    const err = new ApiError('msg', 'rate');
    expect(err).toBeInstanceOf(Error);
    expect(err.kind).toBe('rate');
  });
});
