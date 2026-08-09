# 技术设计：Steam 史低计算器

## 文档目的

把仓库现状转换为实现与维护指引：改代码前需要知道的文件职责、外部 API 契约、踩过的 CORS 坑、本地存储 schema 和部署形态。目标是让另一个工程师不重读全部源码、不重新踩坑就能安全修改。

## 适用范围

- 适用：4 个前端文件、两个第三方 API 的集成、localStorage 持久化、Vercel 部署。
- 不适用：产品行为定义（见 `prd.md`）。

## Plan 或项目证据

- `api.js`：ITAD / CheapShark 封装与 CORS 注释。
- `app.js`：状态、存储 key、判定与渲染逻辑。
- `index.html`：资源引用带 `?v=2` 查询串。
- 2026-08-06 Vercel CLI 部署输出：项目名 `steamcalc`，生产地址 https://steamcalc.vercel.app，关联 GitHub 仓库 `Jerryszz02/steamCalc`。

## 选定方案与文件职责

运行时纯静态、零依赖、无构建；开发依赖只有 Vitest 测试体系（不进入部署产物）。前端文件全部为 ES Modules（`package.json` 含 `"type": "module"`）。

| 文件 | 职责 |
|---|---|
| `index.html` | 页面结构；以 `<script type="module" src="app.js?v=N">` 加载入口，`?v=N` 用于缓存刷新 |
| `style.css` | Steam 风格深色主题，CSS 变量定义配色 |
| `api.js` | ITAD / CheapShark / Steam 导入的 fetch 封装 + `ApiError` 错误分类 + 价格/日期格式化 |
| `api/steam-wishlist.js` | Vercel serverless 函数：中转调用 Steam Web API 读取愿望单（Steam 接口无 CORS 头） |
| `logic.js` | 纯函数：史低判定 `computeVerdict`、ITAD 摘要提取 `summarizeItad`、愿望单行文案 `formatWishlistPriceLine`、Steam 输入解析 `parseSteamInput` 与愿望单响应提取 `extractWishlistItems`，不碰 DOM/网络，可独立测试 |
| `app.js` | 入口模块：状态、DOM 交互、搜索/详情/愿望单/Steam 导入/设置/初始化 |
| `tests/` | Vitest 用例（`logic.test.js` / `api.test.js`） |
| `package.json` / `vitest.config.js` | 测试脚本与配置（jsdom 环境、覆盖率范围） |

模块化后 `file://` 双击打开不再可用（浏览器对模块脚本有 CORS 限制），本地预览必须起静态服务（`npm run dev` 或 `python3 -m http.server`）。

## 外部 API 契约

### IsThereAnyDeal（主数据源，需 key）

Base：`https://api.isthereanydeal.com`，key 以 query 参数 `key=` 传递。

| 用途 | 端点 | 说明 |
|---|---|---|
| 搜索 | `GET /games/search/v1?title=...&results=10` | 返回 `[{id, title, type}]` |
| 查价 | `POST /games/prices/v3?country=XX&shops=61` | body 为游戏 id 的 JSON 数组；`shops=61` 即 Steam；返回 `[{id, historyLow, deals}]` |
| appid 映射 | `GET /games/lookup/v1?appid=...` | 用 Steam appid 查 ITAD 游戏，返回 `{found, game:{id, title, ...}}`，导入愿望单时用 |

错误分类（`itadFetch`）：401/403 → `auth`，429 → `rate`，其他非 2xx → `http`，fetch 抛异常 → `auth`（见下方 CORS 说明）。

### Steam Web API（仅愿望单导入，需 key，经 serverless 中转）

Base：`https://api.steampowered.com`，key 以 query 参数 `key=` 传递。**该域名无 CORS 头，浏览器无法直连**，且 Steam 已于 2024-11 关闭免 key 的 `store.steampowered.com/wishlist/.../wishlistdata/` 接口（实测 302 跳转首页），所以由 `api/steam-wishlist.js` 服务端代调：

| 用途 | 端点 | 说明 |
|---|---|---|
| 读愿望单 | `GET /IWishlistService/GetWishlist/v1?key=...&steamid=...` | 公开愿望单返回 `{response:{items:[{appid,priority,date_added}]}}` |
| vanity 解析 | `GET /ISteamUser/ResolveVanityURL/v1?key=...&vanityurl=...` | `{response:{success:1, steamid}}`；`success:42` 为无匹配 |

实测错误行为（2026-08）：私密愿望单 → HTTP 400（网关层「Bad Request: Missing required routing parameter」）或 200 + `x-eresult: 15`；key 无效 → 403。函数统一映射为中文错误文案，成功时返回 `[{appid, added}]`。

### CheapShark（兜底，无需 key，仅美元）

Base：`https://www.cheapshark.com/api/1.0`。

| 用途 | 端点 | 说明 |
|---|---|---|
| 搜索 | `GET /games?title=...&limit=10` | 返回 `[{gameID, external, thumb, cheapest}]` |
| 详情 | `GET /games?id=...` | 返回 `{info, cheapestPriceEver, deals}`；`deals` 中 `storeID === '1'` 为 Steam |

## 关键约束（改代码前必读）

1. **ITAD 的 POST 不能带 `Content-Type: application/json` 头**。ITAD 的 CORS 预检响应不含 `access-control-allow-headers`，带该头会被浏览器拦截（Failed to fetch）。不带时 fetch 默认 `text/plain`（安全头部，免预检），服务端照常解析 JSON body。`api.js` 中有对应注释，不要「修正」它。
2. **ITAD 的 4xx 错误响应不带 CORS 头**，浏览器会把 403 掩盖成 `TypeError: Failed to fetch`。因此 `itadFetch` 的 catch 分支按 key 无效处理并给出对应文案——网络错误和鉴权错误在浏览器侧无法区分。
3. **HTML 转义**：所有插入 `innerHTML` 的动态字符串必须过 `esc()`。
4. **缓存刷新**：修改 css/js 后需手动递增 `index.html` 引用上的 `?v=N`，否则线上用户可能拿到旧缓存。
5. **Steam 接口必须经 `api/steam-wishlist.js` 中转**：`api.steampowered.com` 无 CORS 头；不要在前端直接 fetch Steam，也不要「修复」回已下线的 `wishlistdata` 接口。静态服务器（python http.server）会把函数当静态文件返回，前端靠「200 但非 JSON」识别并提示改用 `npx vercel dev`。

## 本地存储 schema（localStorage）

| key | 内容 |
|---|---|
| `steamcalc_itad_key` | ITAD API key，字符串 |
| `steamcalc_country` | 区域代码，默认 `CN`；无 key 时强制 `US` |
| `steamcalc_wishlist` | JSON 数组，元素 `{source: 'itad'\|'cs', id, title}` |
| `steamcalc_steam_id` | Steam ID 或资料链接原文，字符串 |
| `steamcalc_steam_key` | Steam Web API key（32 位十六进制），字符串 |

无迁移机制：改 schema 需考虑老用户已有数据的兼容。

## 部署形态

- 托管：Vercel，项目名 `steamcalc`（Vercel 项目名不允许大写字母，故不用目录名 `steamCalc`）。
- 生产地址：https://steamcalc.vercel.app
- 已关联 GitHub 仓库 `Jerryszz02/steamCalc`：push 到 main 会触发 Vercel 自动重新部署；预览/生产策略等未改动，保持 Vercel 默认。
- 无构建配置：Vercel 直接托管仓库根目录静态文件，Output Directory 为 `.`；`api/` 目录下的 `steam-wishlist.js` 由 Vercel 零配置识别为 serverless 函数（Node 运行时，ESM）。仓库现有 `package.json`（Vitest 开发依赖），Vercel 会执行 `npm install` 但没有构建步骤。
- 本地预览：`npm run dev` 或 `python3 -m http.server 8000`（ES Modules 下 `file://` 双击打开不可用）。本地调试 Steam 导入需 `npx vercel dev`（静态服务器无 serverless 函数）。
- `.vercel`（CLI 本地状态）、`node_modules/`、`coverage/` 已通过 `.gitignore` 排除，不要提交。

## 安全与信任边界

- ITAD key 只存用户浏览器 localStorage，仅随请求发往 `api.isthereanydeal.com`，不经过任何自有后端。
- Steam Web API key 同样只存 localStorage，但会随请求发往本项目的 `api/steam-wishlist.js` 中转（服务端即用即弃，不存储、不打日志）；响应设 `Cache-Control: no-store`。
- 页面直连第三方 API（ITAD/CheapShark），key 对查看页面源码/网络面板的本机用户可见，属于可接受范围（key 即用户自己的）。

## 关键决策

| 决策 | 理由 | 重新评估触发条件 |
|---|---|---|
| ITAD 为主、CheapShark 兜底 | ITAD 支持多区价格和 Steam 史低，但需 key；兜底保证零配置可用 | ITAD 免费层政策变化 |
| 运行时零依赖无构建；测试引入 Vitest | 静态托管即可降低维护成本；史低判定分支多，值得自动化回归兜底 | 需要状态管理/路由等复杂能力时 |
| 愿望单存 localStorage | 无账号体系，单设备场景足够 | 用户要求多设备同步 |
| Steam 导入走「用户自带 key + serverless 中转」 | 免 key 的 wishlistdata 已被 Steam 关闭；Steam API 无 CORS 头；纯静态无法实现安全的 Steam OAuth 登录 | Steam 重新开放免 key 且带 CORS 的愿望单接口 |

## 非目标

- 不引入数据库、构建工具（Vitest 仅作开发依赖，不影响运行时）；serverless 函数仅限 Steam 愿望单中转这一个用途。
- 不做 Service Worker / 离线缓存。

## 实现指引

- 改判定规则：只动 `logic.js` 的 `computeVerdict`，注意史低为 0 的免费特例；同步更新 `tests/logic.test.js` 对应用例，跑 `npm test` 验证。
- 加新区域：改 `app.js` 的 `REGIONS` 数组；需确认 ITAD 支持该 country 代码。
- 换/加数据源：在 `api.js` 仿照现有两个封装新增，错误统一抛 `ApiError`；`app.js` 的搜索/详情/愿望单三处都有 `source` 分支需要同步；在 `tests/api.test.js` 用 mock fetch 补用例。
- 新纯逻辑优先放 `logic.js` 或独立新模块并配测试；`app.js` 的 DOM 交互逻辑暂靠浏览器手工验证。
- 改完 css/js：递增 `index.html` 的 `?v=N`。

## 验收指引

先跑 `npm test`（纯逻辑与 API 封装的自动回归）；再按 `prd.md` 的验收标准在浏览器手工验证 5 条场景（DOM 交互部分）；部署后访问 https://steamcalc.vercel.app 确认返回 200 且资源版本号为最新。

## 待确认

- `app.js` 的 DOM 交互逻辑尚无自动化测试，是否补 jsdom 层面的 UI 测试待确认。
- Vercel 与 GitHub 关联后的自动部署分支策略保持默认，未在仓库中找到证据确认团队是否有其他要求。
