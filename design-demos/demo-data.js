export const THEMES = {
  focus: { name: '查价优先' },
  split: { name: '愿望单优先' },
};

export const REGIONS = {
  CN: { currency: 'CNY', locale: 'zh-CN', rate: 1, label: '国区' },
  US: { currency: 'USD', locale: 'en-US', rate: 0.14, label: '美区' },
  HK: { currency: 'HKD', locale: 'zh-HK', rate: 1.09, label: '香港' },
  TW: { currency: 'TWD', locale: 'zh-TW', rate: 4.5, label: '台湾' },
  JP: { currency: 'JPY', locale: 'ja-JP', rate: 22, label: '日本' },
  GB: { currency: 'GBP', locale: 'en-GB', rate: 0.11, label: '英国' },
  DE: { currency: 'EUR', locale: 'de-DE', rate: 0.13, label: '德国' },
  BR: { currency: 'BRL', locale: 'pt-BR', rate: 0.72, label: '巴西' },
};

const artwork = (appid, file = 'header.jpg') =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/${file}`;

export const GAMES = [
  {
    id: 'stardew-valley',
    title: 'Stardew Valley',
    chineseTitle: '星露谷物语',
    genre: '田园生活 · 角色扮演',
    appid: 413150,
    regular: 48,
    current: 24,
    low: 24,
    allLow: 19.2,
    lowDate: '2026.10.28',
    image: artwork(413150),
    hero: artwork(413150, 'library_hero.jpg'),
  },
  {
    id: 'hades',
    title: 'Hades',
    chineseTitle: '哈迪斯',
    genre: '动作 · Roguelike',
    appid: 1145360,
    regular: 92,
    current: 42,
    low: 40,
    allLow: 36.8,
    lowDate: '2026.09.16',
    image: artwork(1145360),
    hero: artwork(1145360, 'library_hero.jpg'),
  },
  {
    id: 'hollow-knight',
    title: 'Hollow Knight',
    chineseTitle: '空洞骑士',
    genre: '类银河战士 · 冒险',
    appid: 367520,
    regular: 58,
    current: 29,
    low: 19.2,
    allLow: 19.2,
    lowDate: '2026.06.25',
    image: artwork(367520),
    hero: artwork(367520, 'library_hero.jpg'),
  },
  {
    id: 'dave-the-diver',
    title: 'DAVE THE DIVER',
    chineseTitle: '潜水员戴夫',
    genre: '海洋冒险 · 经营',
    appid: 1868140,
    regular: 80,
    current: 56,
    low: 56,
    allLow: 48,
    lowDate: '2026.10.02',
    image: artwork(1868140),
    hero: artwork(1868140, 'library_hero.jpg'),
  },
  {
    id: 'balatro',
    title: 'Balatro',
    chineseTitle: '小丑牌',
    genre: '卡牌构筑 · Roguelike',
    appid: 2379780,
    regular: 60,
    current: 48,
    low: 45.9,
    allLow: 40.5,
    lowDate: '2026.08.20',
    image: artwork(2379780),
    hero: artwork(2379780, 'library_hero.jpg'),
  },
  {
    id: 'cyberpunk-2077',
    title: 'Cyberpunk 2077',
    chineseTitle: '赛博朋克 2077',
    genre: '开放世界 · 角色扮演',
    appid: 1091500,
    regular: 298,
    current: 149,
    low: 104.3,
    allLow: 89.4,
    lowDate: '2026.07.11',
    image: artwork(1091500),
    hero: artwork(1091500, 'library_hero.jpg'),
  },
];

export function searchGames(query, games = GAMES) {
  const keyword = String(query || '').trim().toLocaleLowerCase();
  if (!keyword) return [];
  return games.filter((game) =>
    `${game.title} ${game.chineseTitle} ${game.genre}`.toLocaleLowerCase().includes(keyword));
}

export function regionalAmount(amount, regionCode) {
  const region = REGIONS[regionCode];
  if (!region || typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  return amount * region.rate;
}

export function formatRegionalPrice(amount, regionCode) {
  const value = regionalAmount(amount, regionCode);
  if (value == null) return '—';
  const region = REGIONS[regionCode];
  return new Intl.NumberFormat(region.locale, {
    style: 'currency',
    currency: region.currency,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function getVerdict(game) {
  if (!game || game.current == null || game.low == null) {
    return { cls: 'unknown', short: '暂无价格', text: '当前区域暂无足够的价格数据' };
  }
  if (game.current < game.low) {
    return { cls: 'good', short: '新史低', text: '比历史最低还便宜，可以入手' };
  }
  if (game.current === game.low) {
    return { cls: 'good', short: '已达史低', text: '现在就是历史最低价，可以入手' };
  }
  if (game.low === 0) {
    return { cls: 'bad', short: '再等等', text: '历史最低为免费，建议继续观望' };
  }
  const difference = ((game.current - game.low) / game.low) * 100;
  if (difference <= 10) {
    return { cls: 'warn', short: '接近史低', text: `仅比史低高 ${difference.toFixed(0)}%，已经接近好价` };
  }
  return { cls: 'bad', short: '再等等', text: `比史低高 ${difference.toFixed(0)}%，建议继续观望` };
}

export function getTrackPositions(game) {
  const regular = Math.max(game.regular || 0, game.current || 0, 1);
  const clamp = (value) => Math.min(100, Math.max(0, value));
  return {
    current: clamp((game.current / regular) * 100),
    low: clamp((game.low / regular) * 100),
  };
}
