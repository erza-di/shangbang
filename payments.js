/**
 * payments.js — 出价订单 + 链上 USDT 收款核验
 * 流程：POST /api/bid 创建 pending 订单 → 用户转 USDT 到收款地址 →
 *       扫链发现匹配金额 → 订单变 paid → placeBid 生效上墙。
 */
'use strict';
const { scanRecentTransfers } = require('./chain');

const PAY_WALLET = (process.env.PAY_WALLET || '0x9E468fbbf03Bb91066E2B0d1D218bA4d735d4714').toLowerCase();
const TOLERANCE = 0.5;      // 金额匹配容差（USDT）
const EXPIRE_MS  = 30 * 60 * 1000;   // 订单 30 分钟过期
const SCAN_EVERY_MS = 20 * 1000;     // 扫链间隔

/* 订单: { id, url, name, cat, bid, memo, createdAt, status, txHash, payer, paidAt } */
let orders = [];   // 由 server.js 注入 load/save

function bindPersistence(loader, saver) {
  orders = loader() || [];
}
function serializeOrders() { return orders; }

/** 创建订单：memo = 唯一尾数金额（如 12.37），防混淆 */
function createOrder({ url, name, cat, bid }) {
  const cents = Math.floor(Math.random() * 89) + 10;          // .10 ~ .99
  const memo = Number((bid + cents / 100).toFixed(2));        // 出价额 + 随机分
  const order = {
    id: 'o' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36),
    url, name, cat, bid: Math.floor(bid),
    amountDue: memo,
    createdAt: Date.now(),
    status: 'pending',   // pending -> paid -> applied | expired | underpaid
  };
  orders.push(order);
  orders = orders.slice(-200); // 只留最近 200 单
  return order;
}

function getOrder(id) {
  const o = orders.find(x => x.id === id);
  if (!o) return null;
  if (o.status === 'pending' && Date.now() - o.createdAt > EXPIRE_MS) o.status = 'expired';
  return o;
}

/** 把已入账订单交给 placeBid 生效 */
let applyBidFn = null;
function onPaidApply(fn) { applyBidFn = fn; }

/* ---------------- 扫链循环 ---------------- */
async function scanOnce() {
  const pendings = orders.filter(o => o.status === 'pending');
  if (!pendings.length) return;
  try {
    // 查最近约 110 分钟的区块（BSC 3s 一块 ≈ 2200 块）
    const transfers = await scanRecentTransfers(PAY_WALLET, 2200);
    const seen = new Set(orders.filter(o => o.txHash).map(o => o.txHash + ':' + o.logIndex));
    for (const t of transfers) {
      if (seen.has(t.txHash + ':' + t.logIndex)) continue;
      // 匹配一笔 pending 订单：金额在容差内、未过期
      const hit = pendings.find(o =>
        o.status === 'pending' &&
        Date.now() - o.createdAt <= EXPIRE_MS &&
        Math.abs(t.amount - o.amountDue) <= TOLERANCE);
      if (!hit) continue;
      hit.status = 'paid';
      hit.txHash = t.txHash;
      hit.payer = t.from;
      hit.paidAmount = t.amount;
      hit.token = t.token;
      hit.paidAt = Date.now();
      console.log(`[pay] order ${hit.id} paid ${t.amount} ${t.token} by ${t.from} tx=${t.txHash}`);
    }
  } catch (e) {
    console.error('[pay] scan error:', e.message);
  }
  // 过期清理 + 已支付未生效的上墙
  for (const o of orders) {
    if (o.status === 'paid' && applyBidFn) {
      o.status = 'applied';
      try {
        const r = applyBidFn({ url: o.url, name: o.name, cat: o.cat, bid: o.bid });
        o.result = r.err ? { err: r.err } : { rank: r.rank, mode: r.mode };
      } catch (e) { o.result = { err: e.message }; }
    }
    if (o.status === 'pending' && Date.now() - o.createdAt > EXPIRE_MS) o.status = 'expired';
  }
}
setInterval(scanOnce, SCAN_EVERY_MS);

module.exports = { PAY_WALLET, createOrder, getOrder, bindPersistence, serializeOrders, onPaidApply };
