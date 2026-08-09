# Planning 文档索引

## 描述

为「Steam 史低计算器」现有项目梳理生成的项目指导文档。本项目此前没有任何 `docs/` 文档；2026-08-06 项目部署到 Vercel（https://steamcalc.vercel.app）后，根据仓库真实证据补齐本套文档，供后续开发和维护引用。

本文档仅根据当前仓库可见内容整理；未在仓库中找到证据的内容均不做假设，一律标为 `待确认`。

- 生成时间：2026-08-06（同日随 ES Modules 化与 Vitest 测试体系引入更新）
- 已检查的项目根目录：`/Users/jerryszz/Desktop/Projects/steamCalc`

## 已检查的关键项目证据

| 证据 | 从中得出的事实 |
|---|---|
| `README.md` | 项目定位、功能清单、数据源、ITAD key 获取方式、本地运行方式 |
| `index.html` | 页面结构：顶栏（区域选择、API Key 设置）、搜索区、结果区、详情区、愿望单区、设置 dialog |
| `api.js` | ITAD / CheapShark 两个数据源的接口封装、CORS 约束、错误分类（auth/rate/network/http） |
| `app.js` | 史低判定规则、搜索/详情/愿望单逻辑、localStorage 三个 key 的 schema、8 个支持区域 |
| `style.css` | Steam 风格深色主题，纯 CSS 无框架 |
| Vercel 部署记录（2026-08-06 `vercel --prod` 输出） | 生产地址 https://steamcalc.vercel.app，项目名 `steamcalc`，已关联 GitHub 仓库 `Jerryszz02/steamCalc` |
| `.gitignore` | 忽略 `.vercel`、`node_modules/`、`coverage/` |
| `package.json` / `vitest.config.js` / `tests/` | Vitest + jsdom 测试体系，`npm test` 可执行 |
| `logic.js` | 从 `app.js` 抽出的纯函数模块（史低判定、ITAD 摘要），配合 ES Modules 化 |

## 已生成文档

| 文档 | 用途 |
|---|---|
| `prd.md` | 定义产品行为：搜索、史低判定规则、多区价格、愿望单、数据源切换的验收标准 |
| `technical-design.md` | 实现与维护指引：文件职责、外部 API 契约、CORS 坑、localStorage schema、Vercel 部署形态 |

## 已跳过的目录文档

| 文档 | 跳过原因 |
|---|---|
| `project-brief.md` | 项目很小，背景、目标、非目标已并入 `prd.md` |
| `user-flow.md` | 主流程与失败流程已并入 `prd.md` 的功能需求章节 |
| `architecture.md` | 单 package、4 个前端文件，无多模块边界；部署形态并入 `technical-design.md` |
| `api-design.md` | 项目不对外提供 API，只消费第三方 API；外部 API 契约在 `technical-design.md` 中摘要 |
| `database-design.md` | 无服务端持久化；localStorage 属于浏览器本地存储，schema 已并入 `technical-design.md` |
| `security-privacy.md` | 唯一敏感点是 ITAD key 仅存 localStorage，已作为信任边界并入 `technical-design.md` |
| `test-plan.md` | 已引入 Vitest（`npm test` 可执行），验证方式在 `technical-design.md` 的验收指引中说明，暂不需要单独成篇 |
| `release-plan.md` | 发布机制非常简单（push 到 main 触发 Vercel 自动部署），已在 `technical-design.md` 说明 |
| `operations-runbook.md` | 纯静态站点，无运行时进程、日志或健康检查 |
| `decision-log.md` | 关键决策数量少，已作为章节并入 `technical-design.md` |

## 待确认

- `app.js` 的 DOM 交互逻辑暂无自动化测试（Vitest 已就位，可后续补 jsdom 用例）。
- ITAD 免费层限额「每 5 分钟 1000 次请求」来自根 `README.md`，未在仓库中找到 ITAD 官方文档引文，实际限额以官方为准。
- 根 `README.md` 的 Roadmap / License / 贡献方式尚无证据，已保留章节并标 `待确认`。
