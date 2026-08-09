/* ===== Steam 愿望单中转（Vercel serverless 函数）=====
 * api.steampowered.com 不返回 CORS 头，浏览器无法直连，
 * 所以由服务端代调 IWishlistService/GetWishlist。
 * key 由用户提供、随查询参数传入，服务端不存储。
 */
import { extractWishlistItems } from '../logic.js';

const STEAM_API = 'https://api.steampowered.com';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function resolveVanity(vanity, key) {
  const res = await fetch(
    `${STEAM_API}/ISteamUser/ResolveVanityURL/v1/?key=${encodeURIComponent(key)}&vanityurl=${encodeURIComponent(vanity)}`,
  );
  if (res.status === 403) return { error: ['Steam API key 无效或已过期', 403] };
  if (!res.ok) return { error: [`Steam 接口请求失败（HTTP ${res.status}）`, 502] };
  const data = await res.json();
  if (data && data.response && data.response.success === 1 && data.response.steamid) {
    return { steamid: data.response.steamid };
  }
  return { error: ['找不到该 Steam 用户，请检查 ID 或个人资料链接', 404] };
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const input = (url.searchParams.get('input') || '').trim();
  const key = (url.searchParams.get('key') || '').trim();

  // Steam Web API key 固定为 32 位十六进制
  if (!/^[0-9a-f]{32}$/i.test(key)) {
    return json(res, 400, { error: '缺少有效的 Steam Web API key（32 位十六进制字符）' });
  }

  let steamid = null;
  try {
    if (/^\d{17}$/.test(input)) {
      steamid = input;
    } else if (/^[a-z0-9_-]{2,32}$/i.test(input)) {
      const r = await resolveVanity(input, key);
      if (r.error) return json(res, r.error[1], { error: r.error[0] });
      steamid = r.steamid;
    } else {
      return json(res, 400, { error: 'Steam ID 格式不正确' });
    }

    const wlRes = await fetch(
      `${STEAM_API}/IWishlistService/GetWishlist/v1/?key=${encodeURIComponent(key)}&steamid=${steamid}`,
    );
    // Steam 对部分错误仍返回 200，真实结果码在 x-eresult 头里（1 为成功）；
    // 私密愿望单实测返回 400（网关层 Bad Request）或 200 + x-eresult: 15
    const eresult = Number(wlRes.headers.get('x-eresult') || '1');
    if (wlRes.status === 403) {
      return json(res, 403, { error: 'Steam API key 无效或已过期' });
    }
    if (wlRes.status === 400 || eresult === 15) {
      return json(res, 403, { error: '无法读取愿望单：请在 Steam 隐私设置中把愿望单设为公开，并确认 ID 正确' });
    }
    if (!wlRes.ok) {
      return json(res, 502, { error: `Steam 接口请求失败（HTTP ${wlRes.status}）` });
    }
    if (eresult !== 1) {
      return json(res, 502, { error: `Steam 接口返回错误（eresult ${eresult}）` });
    }
    const data = await wlRes.json();
    return json(res, 200, { items: extractWishlistItems(data) });
  } catch {
    return json(res, 502, { error: '无法连接 Steam 接口，请稍后再试' });
  }
}
