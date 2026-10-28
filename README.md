# Steam 史低计算器

一个以前端为主的 Steam 史低价格查询工具：输入游戏名，看当前价是否已达历史最低，支持多区价格、本地愿望单跟踪和 Steam 愿望单一键导入。除 Steam 导入走一个 Vercel serverless 中转函数外，其余功能均为纯前端，部署到 Vercel 即可用。

## 功能

- **游戏搜索**：按标题搜索，选中后展示价格卡片
- **史低判定**：原价、当前价 vs Steam 史低 vs 全商店史低，给出结论：
  - 已达史低 / 新史低（可以入手）
  - 接近史低（高出 ≤10%）
  - 高于史低（建议再等等）
- **多区价格**：国区 (CNY)、美区 (USD)、香港、台湾、日本、英国、德国、巴西
- **本地愿望单**：把游戏加入列表，一键批量刷新所有游戏的史低状态，数据存在浏览器 localStorage
- **Steam 愿望单导入**：填入 Steam ID（或资料链接）+ 免费 Steam Web API key，自动读取公开愿望单并批量加入跟踪

## 数据源

| 数据源 | 说明 |
|---|---|
| [IsThereAnyDeal API](https://docs.isthereanydeal.com/) | 主数据源。支持多区价格、Steam 史低、全商店史低。需要免费 API key |
| [CheapShark API](https://apidocs.cheapshark.com/) | 兜底数据源。无需 key，但只有美元价格 |
| [Steam Web API](https://steamcommunity.com/dev/apikey) | 仅用于读取愿望单（`IWishlistService/GetWishlist`）。需要免费 key，经 `api/steam-wishlist.js` serverless 函数中转（Steam 接口无 CORS 头，浏览器无法直连） |

没填 key 时自动用 CheapShark（区域锁定为美区）；填了 ITAD key 后解锁多区。

## 如何获取 ITAD API key

1. 登录 [isthereanydeal.com](https://isthereanydeal.com)（可用 Steam 账号直接登录）
2. 打开 <https://isthereanydeal.com/apps/my/>，注册一个新的 App（名字随便填）
3. 复制生成的 API key
4. 在本工具页面右上角点「API Key 设置」粘贴保存

key 只保存在你自己浏览器的 localStorage 里，不会上传到任何地方。

## 导入 Steam 愿望单

1. 把 Steam 愿望单设为公开：Steam 客户端或网页版 → 个人资料 → 编辑个人资料 → 隐私设置 → 「我的愿望单」设为公开
2. 打开 <https://steamcommunity.com/dev/apikey>，申请免费的 Steam Web API key（域名随便填）
3. 在本工具愿望单区域点「导入 Steam 愿望单」，填入你的 Steam ID（17 位数字，或 `steamcommunity.com/id/xxx`、`/profiles/xxx` 链接）和上一步的 key
4. 点「开始导入」：工具读取愿望单后，会逐个通过 ITAD 映射成本地条目并自动刷新价格

Steam ID 与 key 同样只存在浏览器 localStorage；key 会随请求发给本项目的 serverless 函数中转（服务端不存储）。导入依赖 ITAD key 做游戏映射，请先在「API Key 设置」里填好。

注意：Steam 导入依赖 Vercel serverless 函数，本地用 `python3 -m http.server` 启动时该功能不可用（会提示改用 `npx vercel dev` 或线上版本）；其余功能不受影响。

## 使用

起一个静态服务即可（页面使用 ES Modules，不能直接双击打开 `index.html`）：

```bash
python3 -m http.server 8000
# 或：npm run dev
# 浏览器打开 http://localhost:8000
```

## UI 设计 demo

打开 <http://localhost:8000/design-demos/> 可对比「查价优先」「愿望单优先」两种极简布局。demo 保留搜索、区域切换、价格对比、愿望单和设置弹窗等交互，但使用明确标注的示例价格，不请求真实 API，也不会保存弹窗中输入的内容。

也可以通过 `?theme=focus`、`?theme=split` 直接打开指定布局。正式页面与数据逻辑不受 demo 影响。

## 开发

```bash
npm install        # 安装开发依赖（Vitest）
npm test           # 运行全部测试
npm run test:watch # watch 模式，改代码自动重跑
npm run coverage   # 生成覆盖率报告
```

测试用 Vitest（jsdom 环境），用例在 `tests/` 目录。纯逻辑（史低判定、API 封装）已有覆盖；`app.js` 的 DOM 交互逻辑暂未覆盖，改动后需在浏览器手工验证。

## 部署

线上地址：<https://steamcalc.vercel.app>（Vercel 托管，项目名 `steamcalc`）。

无构建步骤：静态文件直接托管，另含一个 serverless 函数 `api/steam-wishlist.js`（Vercel 对 `api/` 目录零配置支持，随静态站点一起部署）。已关联 GitHub 仓库，push 到 `main` 分支会触发 Vercel 自动重新部署。

本地预览：

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
# 如需本地调试 Steam 导入功能：npx vercel dev
```

## 文件结构

- `index.html` — 页面结构
- `style.css` — Steam 风格深色主题
- `api.js` — ITAD / CheapShark / Steam 导入接口封装
- `api/steam-wishlist.js` — Steam 愿望单中转（Vercel serverless 函数）
- `logic.js` — 史低判定等纯函数（不碰 DOM，可独立测试）
- `app.js` — 入口模块：搜索、详情渲染、愿望单逻辑
- `design-demos/` — 两种可切换的极简 UI 布局与示例数据
- `tests/` — Vitest 测试用例

## 说明

- 价格数据来自 IsThereAnyDeal 与 CheapShark，仅供参考，实际以商店页面为准
- 使用 ITAD API 需遵守其 [API 条款](https://docs.isthereanydeal.com/)（免费层为每 5 分钟 1000 次请求）

## Roadmap

待确认：尚无公开的后续计划，有规划时在此补充。

## License

待确认：仓库中尚未包含 License 文件，添加前默认保留所有权利。

## 贡献

待确认：暂无贡献指南。目前可直接提 Issue 或 PR；如有代码改动约定会在此补充。
