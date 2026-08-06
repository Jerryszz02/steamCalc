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

纯静态、零依赖、无构建。四个文件职责：

| 文件 | 职责 |
|---|---|
| `index.html` | 页面结构；以 `?v=2` 查询串引用 `style.css` / `api.js` / `app.js` 做缓存刷新 |
| `style.css` | Steam 风格深色主题，CSS 变量定义配色 |
| `api.js` | 两个数据源的 fetch 封装 + `ApiError` 错误分类 + 价格/日期格式化 |
| `app.js` | 全部状态与交互：搜索、详情渲染、史低判定、愿望单、设置、初始化 |

`api.js` 必须先于 `app.js` 加载（`app.js` 直接调用其中的全局函数，无模块系统）。

## 外部 API 契约

### IsThereAnyDeal（主数据源，需 key）

Base：`https://api.isthereanydeal.com`，key 以 query 参数 `key=` 传递。

| 用途 | 端点 | 说明 |
|---|---|---|
| 搜索 | `GET /games/search/v1?title=...&results=10` | 返回 `[{id, title, type}]` |
| 查价 | `POST /games/prices/v3?country=XX&shops=61` | body 为游戏 id 的 JSON 数组；`shops=61` 即 Steam；返回 `[{id, historyLow, deals}]` |

错误分类（`itadFetch`）：401/403 → `auth`，429 → `rate`，其他非 2xx → `http`，fetch 抛异常 → `auth`（见下方 CORS 说明）。

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

## 本地存储 schema（localStorage）

| key | 内容 |
|---|---|
| `steamcalc_itad_key` | ITAD API key，字符串 |
| `steamcalc_country` | 区域代码，默认 `CN`；无 key 时强制 `US` |
| `steamcalc_wishlist` | JSON 数组，元素 `{source: 'itad'\|'cs', id, title}` |

无迁移机制：改 schema 需考虑老用户已有数据的兼容。

## 部署形态

- 托管：Vercel，项目名 `steamcalc`（Vercel 项目名不允许大写字母，故不用目录名 `steamCalc`）。
- 生产地址：https://steamcalc.vercel.app
- 已关联 GitHub 仓库 `Jerryszz02/steamCalc`：push 到 main 会触发 Vercel 自动重新部署；预览/生产策略等未改动，保持 Vercel 默认。
- 无构建配置：Vercel 直接托管仓库根目录静态文件，Output Directory 为 `.`。
- 本地预览：`python3 -m http.server 8000` 或直接双击 `index.html`。
- `.vercel` 目录（CLI 本地状态）已通过 `.gitignore` 排除，不要提交。

## 安全与信任边界

- ITAD key 只存用户浏览器 localStorage，仅随请求发往 `api.isthereanydeal.com`，不经过任何自有后端（项目没有后端）。
- 页面直连第三方 API，无任何服务端代理；key 对查看页面源码/网络面板的本机用户可见，属于可接受范围（key 即用户自己的）。

## 关键决策

| 决策 | 理由 | 重新评估触发条件 |
|---|---|---|
| ITAD 为主、CheapShark 兜底 | ITAD 支持多区价格和 Steam 史低，但需 key；兜底保证零配置可用 | ITAD 免费层政策变化 |
| 零依赖无构建 | 项目体量小，静态托管即可，降低维护成本 | 需要状态管理/路由等复杂能力时 |
| 愿望单存 localStorage | 无账号体系，单设备场景足够 | 用户要求多设备同步 |

## 非目标

- 不引入后端、数据库、构建工具、测试框架（是否引入测试见待确认）。
- 不做 Service Worker / 离线缓存。

## 实现指引

- 改判定规则：只动 `app.js` 的 `computeVerdict`，注意史低为 0 的免费特例。
- 加新区域：改 `app.js` 的 `REGIONS` 数组；需确认 ITAD 支持该 country 代码。
- 换/加数据源：在 `api.js` 仿照现有两个封装新增，错误统一抛 `ApiError`；`app.js` 的搜索/详情/愿望单三处都有 `source` 分支需要同步。
- 改完 css/js：递增 `index.html` 的 `?v=N`。

## 验收指引

按 `prd.md` 的验收标准手工验证 5 条场景；部署后访问 https://steamcalc.vercel.app 确认返回 200 且资源版本号为最新。

## 待确认

- 是否引入测试框架与最小测试集（当前改动只能靠手工验证）。
- Vercel 与 GitHub 关联后的自动部署分支策略保持默认，未在仓库中找到证据确认团队是否有其他要求。
