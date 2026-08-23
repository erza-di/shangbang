# 上榜公报 SHANGBANG · 竞价排行榜

「排名就是出价，别的不算。想上位？加钱❗」—— 仿 [outbid.lol](https://outbid.lol) 的中国市场竞价排行榜，公报风设计（米白纸底 / 墨色宋体 / 朱红印章）。

**→ 网站入口：https://erza-di.github.io/shangbang/ （本仓库 Pages 即网站本体，见 `public/` 目录）**

## 公网地址（双入口）

| 入口 | 地址 | 说明 |
|---|---|---|
| **GitHub Pages** | https://erza-di.github.io/shangbang/ | 页面永久在线；API 自动走 ngrok 域名 |
| **ngrok 直连** | https://mayflower-vanquish-botch.ngrok-free.dev | 页面+API 同源，由 GitHub Actions 7×24 常驻 |

### 7×24 常驻机制（GitHub Actions）

`.github/workflows/keep-online.yml`：

- 每 4 小时自动续期一轮（`schedule` + `workflow_dispatch` 可手动触发）
- 单轮跑约 3 小时 40 分，`concurrency` 组确保新实例顶替旧实例时域名无缝切换
- ngrok authtoken / ADMIN_TOKEN / UPSTASH_* 存于仓库 Secrets
- 实例轮换时数据通过 Upstash Redis 跨实例持久，出价、快讯、订单自动恢复

### 推广素材

`promo/` 目录：8 语言 12 平台现成发帖文案（HN/Reddit/PH/X/V2EX/小红书/知乎/微博/TG/VK/日韩）。
