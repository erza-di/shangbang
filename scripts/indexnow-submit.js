#!/usr/bin/env node
/**
 * indexnow-submit.js — 向 IndexNow（Bing/Seznam/Naver/Yandex 共享端点）提交站点 URL
 * 用法：INDEXNOW_KEY=xxx node indexnow-submit.js [url1 url2 ...]
 * 首次使用：先跑 --gen 生成密钥文件并提交到 docs/ 根目录
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = 'https://erza-di.github.io/shangbang/';
const KEY_FILE = path.join(__dirname, '..', 'docs', 'indexnow-key.txt');

if (process.argv[2] === '--gen') {
  const key = require('crypto').randomBytes(16).toString('hex');
  fs.writeFileSync(KEY_FILE, key);
  console.log('KEY=' + key);
  console.log('已写入 docs/indexnow-key.txt，push 后即可用此 KEY 提交。');
  process.exit(0);
}

const key = process.env.INDEXNOW_KEY || (fs.existsSync(KEY_FILE) ? fs.readFileSync(KEY_FILE, 'utf8').trim() : '');
if (!key) { console.error('no key'); process.exit(1); }

const hosts = {
  bing: 'https://api.indexnow.org/IndexNow',           // 共享端点，Bing/Yandex/Seznam/Naver 均收
};
const urls = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [SITE, SITE + 'blog.html', SITE + 'share.html', SITE + 'poster.html'];

(async () => {
  for (const [name, ep] of Object.entries(hosts)) {
    try {
      const r = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ host: new URL(SITE).host, key, keyLocation: SITE + 'indexnow-key.txt', urlList: urls }),
      });
      console.log(name, r.status, r.status === 200 || r.status === 202 ? 'OK' : await r.text());
    } catch (e) { console.log(name, 'ERR', e.message); }
  }
})();
