# 上榜公报 SHANGBANG · 竞价排行榜

「排名就是出价，别的不算。想上位？加钱❗」—— 仿 [outbid.lol](https://outbid.lol) 的中国市场竞价排行榜，公报风设计（米白纸底 / 墨色宋体 / 朱红印章）。

## 当前形态

- **前端**：`public/index.html`（单文件，无依赖）
- **后端**：`server.js`（零依赖 Node，≥18 即可）
- **存储**：`data/db.json`（文件持久化，出价实时落盘）
- **公网**：Cloudflare 快速隧道（本机在线 = 网站在线）

## 本地运行

```bash
node server.js          # http://127.0.0.1:8787
PORT=9000 node server.js
```

## 公网运行（当前方式）

```bash
# 终端 A
node server.js
# 终端 B（%LOCALAPPDATA%\Temp\cloudflared.exe 已下载好）
cloudflared tunnel --url http://127.0.0.1:8787 --no-autoupdate
```

> 注意：快速隧道的 URL **每次重启都会变**。当前地址：
> `https://oriental-frame-powder-harris.trycloudflare.com`
>
> 想要固定域名两条路：
> 1. Cloudflare 账号 + 自己的域名 → `cloudflared tunnel login` 创建命名隧道（免费、稳定、可绑自定义域）
> 2. 或部署到任意 Node 托管（Railway/Fly.io/自己的 VPS），`server.js` 零依赖可直接跑

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/state?cat=<id>` | 全量状态（榜单/统计/快讯），cat=all 或分类 id |
| POST | `/api/bid` | 出价 `{url,name,cat,bid}`；同 host+cat 再次出价=加价 |
| GET | `/api/events` | 快讯 |
| GET | `/healthz` | 健康检查 |
| POST | `/api/admin/reset` | 清空用户出价，header `x-admin-token` |

内置防护：IP 限流（每分钟 5 次出价）、金额上限、名称截断、XSS 前端转义。

**管理 token**：默认 `shangbang-admin-2026`，生产环境用环境变量覆盖：

```bash
ADMIN_TOKEN=换个新的 node server.js
```

## 接真实支付（已上线：BSC 链上 USDT/USDC）

收款地址：`0x9E468fbbf03Bb91066E2B0d1D218bA4d735d4714`（可用环境变量 `PAY_WALLET` 覆盖）

流程（全自动，无需人工对账）：

1. 访客填出价 → `POST /api/bid` 预校验后生成订单，返回**带随机尾数的精确金额**（如 ¥88 → 转 88.85 USDT）
2. 访客用任意钱包 / 交易所把 **USDT 或 USDC（BSC 网络）** 转到收款地址
3. 后端每 20 秒扫一次 BSC 链（`eth_getLogs` Transfer 事件，回看约 110 分钟区块），金额匹配到账 → 订单变 paid → 自动调用 `placeBid()` 上墙
4. 前端每 15 秒轮询 `/api/order?id=...`，显示到账确认与 txHash；30 分钟未到账自动过期

相关文件：

- `chain.js` — BSC JSON-RPC 扫链（内置公共 RPC 池自动切换 + 系统代理 CONNECT 支持，可加 `BSC_RPC` 环境变量换自建节点）
- `payments.js` — 订单生命周期（pending → paid → applied | expired），金额容差 ±0.5，防尾数撞单
- 前端弹窗含复制地址、立即核验按钮

> 注意：扫链依赖 BSC 公共 RPC 的可用性；生产建议用 QuickNode/Ankr 等自建端点：
> `BSC_RPC=https://bsc-mainnet.nodereal.io/v1/xxx node server.js`

## 旧方案存档（法币通道）

若以后要接微信/支付宝，同样走「下单→回调」两步：`POST /api/bid` 返回订单号+支付链接，
网关 notify 回调验签后调用现有 `placeBid()`。核心规则已在 `placeBid()` 里实现好。

## 数据

种子条目（瑞幸/LABUBU/原神等 55 条）为演示虚构数据。清库即回到种子态：删除 `data/db.json` 后重启。
