/**
 * upstash.js — Upstash Redis REST 备份（零依赖，Node ≥18 自带 fetch）
 * 用途：GitHub Actions 实例每 4 小时轮换，db.json 存进 Redis 跨实例存活。
 * 环境变量 UPSTASH_URL / UPSTASH_TOKEN 未设置时自动降级为纯本地文件模式。
 */
'use strict';
const US_URL = (process.env.UPSTASH_URL || '').replace(/\/+$/, '');
const US_TOKEN = process.env.UPSTASH_TOKEN || '';
const KEY = 'shangbang:db';
const enabled = Boolean(US_URL && US_TOKEN);

async function cmd(...args) {
  const r = await fetch(US_URL + '/' + args.map(a => encodeURIComponent(a)).join('/'), {
    headers: { Authorization: `Bearer ${US_TOKEN}` },
  });
  if (!r.ok) throw new Error('upstash http ' + r.status);
  return (await r.json()).result;
}

/** 启动时从 Redis 恢复；返回 null 表示远端没有备份 */
async function loadRemote() {
  if (!enabled) return null;
  try {
    const raw = await cmd('GET', KEY);
    if (!raw) return null;
    const db = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (db && Array.isArray(db.entries)) {
      console.log(`[upstash] restored db from redis (${db.entries.length} entries)`);
      return db;
    }
  } catch (e) { console.error('[upstash] load failed:', e.message); }
  return null;
}

/** 防抖保存到 Redis（2 秒合并写，省免费额度） */
let saveTimer = null, lastErr = 0;
function scheduleSave(getDb) {
  if (!enabled || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    cmd('SET', KEY, JSON.stringify(getDb()))
      .catch(e => {
        // 限流类错误最多每 5 分钟打一行日志
        if (Date.now() - lastErr > 300000) { console.error('[upstash] save failed:', e.message); lastErr = Date.now(); }
      });
  }, 2000);
}

module.exports = { enabled, loadRemote, scheduleSave };
