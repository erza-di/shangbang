#!/usr/bin/env node
/**
 * 上榜公报 SHANGBANG.GAZOU — 竞价排行榜后端
 * 零依赖 Node HTTP 服务：榜单 API + 出价 + 限流 + 文件持久化
 *
 *   node server.js            # 默认 127.0.0.1:8787
 *   PORT=9000 node server.js  # 自定义端口
 *
 * API:
 *   GET  /api/state?cat=<id>       全量状态（分类榜、统计、快讯）
 *   POST /api/bid                  出价上榜/加价  {url,name,cat,bid}
 *   GET  /api/events               快讯列表
 *   GET  /api/rules                规则
 *   GET  /healthz                   健康检查
 *   POST /api/admin/reset          清空用户出价（需 x-admin-token）
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const payments = require('./payments');

const PORT = parseInt(process.env.PORT || '8787', 10);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'shangbang-admin-2026';

/* ---------------- 品类 ---------------- */
const CATS = [
  { id: 'tea',    name: '新茶饮咖啡' },
  { id: 'food',   name: '餐饮连锁' },
  { id: 'beauty', name: '美妆个护' },
  { id: 'fit',    name: '运动健身' },
  { id: 'toys',   name: '潮玩手办' },
  { id: 'game',   name: '游戏动漫' },
  { id: 'social', name: '内容社区' },
  { id: 'ecom',   name: '电商平台' },
  { id: 'tech',   name: '科技数码' },
  { id: 'travel', name: '出行旅游' },
  { id: 'edu',    name: '教育学习' },
];
const catIds = new Set(CATS.map(c => c.id));
const catName = id => (CATS.find(c => c.id === id) || {}).name || id;

/* ---------------- 种子数据（演示用虚构条目） ---------------- */
function seedEntries() {
  const E = (id, name, host, cat, bid, cph) =>
    ({ id, name, host, cat, bid, cph, heldSince: Date.now(), user: false });
  return [
    E('luckin','瑞幸咖啡','luckincoffee.com','tea',18600,412),
    E('mxbc','蜜雪冰城','mxbc.com','tea',15200,388),
    E('heytea','喜茶','heytea.com','tea',9400,205),
    E('chagee','霸王茶姬','chagee.com','tea',8100,177),
    E('cotti','库迪咖啡','cotti.com.cn','tea',3000,64),
    E('haidilao','海底捞','haidilao.com','food',11200,246),
    E('tastien','塔斯汀','tastien.com','food',6800,151),
    E('taier','太二酸菜鱼','taiersuancai.com','food',5400,119),
    E('wallace','华莱士','jhwallace.cn','food',3200,58),
    E('lxc','老乡鸡','laoxiangji.com','food',2100,41),
    E('florasis','花西子','florasis.com','beauty',9800,188),
    E('proya','珀莱雅','proya.com','beauty',8600,163),
    E('winona','薇诺娜','winona.com.cn','beauty',6200,127),
    E('pdiary','完美日记','perfectdiary.com','beauty',3500,72),
    E('tosummer','观夏','tosummer.cn','beauty',2800,53),
    E('keep','Keep','gotokeep.com','fit',6400,138),
    E('lulu','lululemon 中国','lululemon.com.cn','fit',5100,109),
    E('supermonkey','超级猩猩','supermonkey.com.cn','fit',4700,95),
    E('lefit','乐刻运动','lefit.com','fit',3300,61),
    E('beneunder','蕉下','beneunder.com','fit',2900,49),
    E('popmart','泡泡玛特 LABUBU','popmart.com','toys',52800,1024),
    E('kayou','卡游','kayou.com','toys',16800,296),
    E('toptoy','TOP TOY','toptoy.cn','toys',9200,171),
    E('52toys','52TOYS','52toys.com','toys',4800,87),
    E('rolife','若来 Rolife','rolifefun.com','toys',2400,44),
    E('genshin','原神','yuanshen.com','game',22800,507),
    E('wzry','王者荣耀','pvp.qq.com','game',19500,463),
    E('eggyparty','蛋仔派对','eggyparty.163.com','game',12600,254),
    E('deepspace','恋与深空','deepspace.papegames.com','game',7300,148),
    E('arknights','明日方舟','ak.hypergryph.com','game',5900,113),
    E('xhs','小红书','xiaohongshu.com','social',24500,531),
    E('douyin','抖音商城','douyin.com','social',17800,372),
    E('bili','哔哩哔哩','bilibili.com','social',13400,281),
    E('zhihu','知乎盐选','zhihu.com','social',4200,83),
    E('jimeng','即梦 AI','jimeng.jianying.com','social',3600,77),
    E('tmall','天猫超级旗舰','tmall.com','ecom',12800,264),
    E('pdd','拼多多百亿补贴','pinduoduo.com','ecom',9600,213),
    E('jd','京东自营','jd.com','ecom',8800,196),
    E('dewu','得物','dewu.com','ecom',5200,104),
    E('goofish','闲鱼','goofish.com','ecom',2600,47),
    E('huawei','华为商城','vmall.com','tech',15800,301),
    E('mi','小米商城','mi.com','tech',12200,243),
    E('dji','大疆商城','dji.com','tech',7500,156),
    E('insta360','影石 Insta360','insta360.com','tech',4300,89),
    E('meizu','魅族','meizu.com','tech',1900,33),
    E('ctrip','携程旅行','ctrip.com','travel',13600,277),
    E('didi','滴滴出行','didiglobal.com','travel',11800,238),
    E('ly','同程旅行','ly.com','travel',7600,149),
    E('hello','哈啰','hellobike.com','travel',3800,69),
    E('rail','12306','12306.cn','travel',2200,58),
    E('dedao','得到','dedao.cn','edu',7200,132),
    E('youdao','有道','youdao.com','edu',5600,107),
    E('hundun','混沌学园','hundun.cn','edu',3100,55),
    E('zebra','斑马 AI 课','zebra.ai','edu',2500,42),
    E('duolingo','多邻国','duolingo.cn','edu',1800,29),
  ];
}

/* ---------------- 持久化 ---------------- */
let db;
function loadDb() {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!Array.isArray(db.entries)) throw new Error('bad db');
  } catch (e) {
    db = {
      entries: seedEntries(),
      events: [
        { t: Date.now(), msg: '泡泡玛特 LABUBU 以 ¥52,800 登顶总榜' },
        { t: Date.now() - 6e5, msg: '瑞幸咖啡 加价 ¥800 反超蜜雪冰城' },
        { t: Date.now() - 12e5, msg: '12306 出现神秘出价，全网震惊' },
      ],
      raisesToday: 137,
      dayKey: new Date().toISOString().slice(0, 10),
      seq: 1000,
      orders: [],
    };
    saveDb();
  }
}
let saveTimer = null;
function saveDb() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = DB_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, DB_FILE);
    } catch (e) { console.error('[save]', e.message); }
  }, 120);
}

/* ---------------- 工具 ---------------- */
const fmt = n => '¥' + Number(n).toLocaleString('zh-CN');
function heldText(since) {
  const s = Math.max(1, Math.floor((Date.now() - since) / 1000));
  if (s < 60) return s + '秒';
  const m = Math.floor(s / 60);
  if (m < 60) return m + '分钟';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h < 24) return h + '小时' + mm + '分';
  const d = Math.floor(h / 24);
  return d + '天' + (h % 24) + '小时';
}
function normalizeHost(url) {
  let u = String(url || '').trim();
  try {
    const withProto = /^https?:\/\//i.test(u) ? u : 'https://' + u;
    return new URL(withProto).host.toLowerCase();
  } catch (_) { return u.slice(0, 80).toLowerCase(); }
}
function pushEvent(msg) {
  db.events.unshift({ t: Date.now(), msg });
  db.events = db.events.slice(0, 12);
}
function rollDay() {
  const key = new Date().toISOString().slice(0, 10);
  if (db.dayKey !== key) { db.dayKey = key; db.raisesToday = 0; }
}

/* ---------------- 限流 ---------------- */
const hits = new Map(); // ip -> [timestamps]
const RATE_MS = 60_000, RATE_MAX = 5;
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < RATE_MS);
  if (arr.length >= RATE_MAX) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}

/* ---------------- 出价核心 ---------------- */
const MIN_BID = 5, MAX_BID = 999999;
/** 只校验不生效，供 /api/bid 预检与支付回调共用 */
function preValidateBid({ url, name, cat, bid }) {
  bid = Math.floor(Number(bid));
  if (!Number.isFinite(bid)) return { err: '出价必须是数字' };
  if (bid < MIN_BID) return { err: `出价至少 ¥${MIN_BID}，整数` };
  if (bid > MAX_BID) return { err: `单笔出价上限 ¥${MAX_BID.toLocaleString('zh-CN')}` };
  url = String(url || '').trim();
  name = String(name || '').trim().slice(0, 16);
  if (!url) return { err: '链接不填，你想让杂鱼猜吗？' };
  if (url.length > 200) return { err: '链接太长了' };
  if (!name) return { err: '给个名字，不然墙上写什么？' };
  if (!catIds.has(cat)) return { err: '品类不认识' };
  return { url, name, cat, bid };
}
function placeBid({ url, name, cat, bid }) {
  rollDay();
  // 同一 host+cat 视为同一条目：再次出价 = 加价（只需 ≥ 原价+1）
  const host = normalizeHost(url);
  let entry = db.entries.find(e => e.host === host && e.cat === cat && e.user);
  let mode;
  if (entry) {
    mode = 'raise';
    if (bid <= entry.bid) return { err: `你当前出价 ${fmt(entry.bid)}，新出价必须更高` };
    entry.bid = bid;
    entry.name = name; // 允许改名
    entry.heldSince = entry.heldSince; // 在位时间不清零
  } else {
    const topInCat = Math.max(0, ...db.entries.filter(e => e.cat === cat).map(e => e.bid));
    mode = bid > topInCat ? 'crown' : 'board';
    entry = {
      id: 'u' + (++db.seq), name, host, cat, bid,
      cph: 3 + Math.floor(Math.random() * 20),
      heldSince: Date.now(), user: true,
    };
    db.entries.push(entry);
  }
  db.raisesToday += 1;
  const rank = boardList(cat).findIndex(e => e.id === entry.id) + 1;
  pushEvent(`${name} 出价 ${fmt(bid)}，位居${catName(cat)}榜第 ${rank} 名`);
  saveDb();
  return { ok: true, entry: publicEntry(entry), rank, mode };
}
function boardList(cat) {
  const list = cat === 'all' ? db.entries : db.entries.filter(e => e.cat === cat);
  return [...list].sort((a, b) => b.bid - a.bid);
}
function publicEntry(e) {
  return { ...e, held: heldText(e.heldSince) };
}

/* ---------------- 背景模拟：点击数缓慢跳动 ---------------- */
setInterval(() => {
  for (let k = 0; k < 3; k++) {
    const e = db.entries[Math.floor(Math.random() * db.entries.length)];
    e.cph += 1 + Math.floor(Math.random() * 9);
  }
  saveDb();
}, 8000);

/* ---------------- HTTP ---------------- */
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => {
      data += c;
      if (data.length > 4096) { reject(new Error('body too large')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
             req.socket.remoteAddress || 'unknown';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,x-admin-token',
    });
    return res.end();
  }

  try {
    if (p === '/healthz') return json(res, 200, { ok: true, ts: Date.now() });

    if (p === '/api/state') {
      rollDay();
      const cat = catIds.has(u.searchParams.get('cat')) ? u.searchParams.get('cat') : 'all';
      const list = boardList(cat).map(publicEntry);
      const pool = (cat === 'all' ? db.entries : db.entries.filter(e => e.cat === cat))
        .reduce((s, e) => s + e.bid, 0);
      return json(res, 200, {
        cats: CATS,
        view: cat,
        list: list.slice(0, 25),
        total: list.length,
        stats: {
          online: 236 + Math.round(Math.sin(Date.now() / 60000) * 24),
          pool, raises: db.raisesToday,
        },
        events: db.events,
        orders: db.orders || [],
        rules: { minBid: MIN_BID, maxBid: MAX_BID },
      });
    }

    if (p === '/api/bid' && req.method === 'POST') {
      if (rateLimited(ip)) return json(res, 429, { err: '手速太快了，一分钟内最多出价 5 次' });
      let payload;
      try { payload = JSON.parse((await readBody(req)) || '{}'); }
      catch (_) { return json(res, 400, { err: '请求格式不对' }); }
      // 预校验（不落榜），通过则生成链上支付订单
      const pre = preValidateBid(payload);
      if (pre.err) return json(res, 400, { err: pre.err });
      const order = payments.createOrder(pre);
      saveDb();
      return json(res, 200, {
        needPayment: true,
        orderId: order.id,
        payTo: payments.PAY_WALLET,
        chain: 'BSC (BNB Smart Chain)',
        token: 'USDT (BSC-USD) 或 USDC',
        amountDue: order.amountDue,
        expiresMs: 30 * 60 * 1000,
        note: '按上方精确金额转账（含随机尾数用于匹配），到账后自动上墙。可用任何钱包/交易所提币。',
      });
    }

    if (p === '/api/order' ) {
      const o = payments.getOrder(u.searchParams.get('id'));
      if (!o) return json(res, 404, { err: '订单不存在' });
      const pub = { id:o.id, status:o.status, amountDue:o.amountDue, createdAt:o.createdAt };
      if (o.txHash) { pub.txHash = o.txHash; pub.paidAmount = o.paidAmount; pub.token = o.token; }
      if (o.result)  pub.result = o.result;
      return json(res, 200, pub);
    }

    if (p === '/api/events') return json(res, 200, { events: db.events });

    if (p === '/api/rules') return json(res, 200, { rules: { minBid: MIN_BID, maxBid: MAX_BID } });

    if (p === '/api/admin/reset' && req.method === 'POST') {
      if ((req.headers['x-admin-token'] || '') !== ADMIN_TOKEN)
        return json(res, 401, { err: 'token 不对' });
      db.entries = db.entries.filter(e => !e.user);
      pushEvent('管理员清空了所有用户出价');
      saveDb();
      return json(res, 200, { ok: true });
    }

    if (p === '/' || !p.startsWith('/api/')) return serveStatic(req, res, p);

    return json(res, 404, { err: 'not found' });
  } catch (e) {
    console.error('[err]', e);
    return json(res, 500, { err: '服务器打了个喷嚏，再试一次' });
  }
});

loadDb();
payments.bindPersistence(
  () => db.orders || [],
  () => {}
);
payments.onPaidApply(payload => {
  const r = placeBid(payload);
  if (!r.err) saveDb();
  return r;
});
server.listen(PORT, HOST, () => {
  console.log(`[上榜公报] listening on http://${HOST}:${PORT}  data=${DB_FILE}`);
});
