#!/usr/bin/env node
/** blog-gen.js — 从 Redis/本地 db 生成 blog.html（战报页，SEO 用）*/
'use strict';
const fs = require('fs');
const path = require('path');

const DB = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');
const OUT = path.join(__dirname, '..', 'public', 'blog.html');
const BASE = 'https://erza-di.github.io/shangbang/';

function esc(s){ return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function fmt(n){ return '¥'+Number(n).toLocaleString('zh-CN'); }

let db;
try { db = JSON.parse(fs.readFileSync(DB,'utf8')); } catch(_) { console.log('no db, skip'); process.exit(0); }

const top = [...db.entries].sort((a,b)=>b.bid-a.bid).slice(0,10);
const now = new Date().toISOString().slice(0,10);
const rows = top.map((e,i)=>`<tr><td>${i+1}</td><td>${esc(e.name)}</td><td class="h">${esc(e.host)}</td><td class="r">${fmt(e.bid)}</td></tr>`).join('');
const evs = (db.events||[]).slice(0,8).map(ev=>`<li>${esc(ev.msg)}</li>`).join('');

const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>上榜公报 · 每日战报 ${now}</title>
<meta name="description" content="价高者得。中国品牌竞价排行榜每日战况：谁在榜首，谁被拉下马。">
<link rel="canonical" href="${BASE}">
<style>
body{font-family:"Songti SC",SimSun,serif;max-width:760px;margin:40px auto;padding:0 20px;color:#1c1813;background:#f6f2ea;line-height:1.8}
h1{font-size:34px;border-bottom:3px double #c23a1e;padding-bottom:12px}
.meta{color:#6e675a;font-size:13px}
table{width:100%;border-collapse:collapse;margin:20px 0;font-family:ui-monospace,monospace}
td{padding:8px 6px;border-bottom:1px solid #ddd5c5;font-size:15px}
.r{text-align:right;color:#c23a1e;font-weight:700}.h{color:#a39a89;font-size:12px}
.events{background:#fbf8f2;border:1px solid #ddd5c5;padding:14px 30px}
.btn{display:inline-block;margin-top:18px;background:#c23a1e;color:#fff;padding:10px 22px;text-decoration:none;font-family:sans-serif}
</style></head><body>
<h1>上榜公报 · 每日战报</h1>
<p class="meta">${now} · 排名就是出价，别的不算。想上位？加钱❗</p>
<table><tr><th>#</th><th>条目</th><th></th><th>出价</th></tr>${rows}</table>
<div class="events"><b>⚡ 今日快讯</b><ul style="margin:8px 0 0;padding-left:18px">${evs}</ul></div>
<a class="btn" href="${BASE}">上榜单 → 我也要出价</a>
<p class="meta" style="margin-top:30px">本页由后端自动生成 · 数据实时来自 <a href="${BASE}">上榜公报</a></p>
</body></html>`;

fs.writeFileSync(OUT, html);
console.log('blog.html written,', top.length, 'rows');
