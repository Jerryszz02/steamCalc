# Steam 史低计算器

一个纯前端的 Steam 史低价格查询工具：输入游戏名，看当前价是否已达历史最低，支持多区价格和本地愿望单跟踪。无需后端，双击打开或部署到任意静态托管即可用。

## 功能

- **游戏搜索**：按标题搜索，选中后展示价格卡片
- **史低判定**：当前价 vs Steam 史低 vs 全商店史低，给出结论：
  - 已达史低 / 新史低（可以入手）
  - 接近史低（高出 ≤10%）
  - 高于史低（建议再等等）
- **多区价格**：国区 (CNY)、美区 (USD)、香港、台湾、日本、英国、德国、巴西
- **本地愿望单**：把游戏加入列表，一键批量刷新所有游戏的史低状态，数据存在浏览器 localStorage

## 数据源

| 数据源 | 说明 |
|---|---|
| [IsThereAnyDeal API](https://docs.isthereanydeal.com/) | 主数据源。支持多区价格、Steam 史低、全商店史低。需要免费 API key |
| [CheapShark API](https://apidocs.cheapshark.com/) | 兜底数据源。无需 key，但只有美元价格 |

没填 key 时自动用 CheapShark（区域锁定为美区）；填了 ITAD key 后解锁多区。

## 如何获取 ITAD API key

1. 登录 [isthereanydeal.com](https://isthereanydeal.com)（可用 Steam 账号直接登录）
2. 打开 <https://isthereanydeal.com/apps/my/>，注册一个新的 App（名字随便填）
3. 复制生成的 API key
4. 在本工具页面右上角点「API Key 设置」粘贴保存

key 只保存在你自己浏览器的 localStorage 里，不会上传到任何地方。

## 使用

本地直接打开 `index.html`，或起一个静态服务：

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

## 部署

线上地址：<https://steamcalc.vercel.app>（Vercel 托管，项目名 `steamcalc`）。

这是纯静态站点，无构建步骤。已关联 GitHub 仓库，push 到 `main` 分支会触发 Vercel 自动重新部署。也可以把整个目录拖进 Netlify 等其他静态托管。

本地预览：

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

## 文件结构

- `index.html` — 页面结构
- `style.css` — Steam 风格深色主题
- `api.js` — ITAD / CheapShark 接口封装
- `app.js` — 搜索、史低判定、愿望单逻辑

## 说明

- 价格数据来自 IsThereAnyDeal 与 CheapShark，仅供参考，实际以商店页面为准
- 使用 ITAD API 需遵守其 [API 条款](https://docs.isthereanydeal.com/)（免费层为每 5 分钟 1000 次请求）

## Roadmap

待确认：尚无公开的后续计划，有规划时在此补充。

## License

待确认：仓库中尚未包含 License 文件，添加前默认保留所有权利。

## 贡献

待确认：暂无贡献指南。目前可直接提 Issue 或 PR；如有代码改动约定会在此补充。
