/**
 * chain.js — BSC 链上 USDT 转账扫描与解析（零依赖）
 * 用 JSON-RPC eth_getLogs / eth_getTransactionReceipt 检测向指定地址的代币转账。
 */
'use strict';
const https = require('https');
const http = require('http');
const net = require('net');
const tls = require('tls');
const { URL } = require('url');

/* ---------------- 配置 ---------------- */
const TOKENS = [
  // BSC 主网 USDT (BSC-USD)
  { symbol: 'USDT', contract: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
  // BSC 主网 USDC
  { symbol: 'USDC', contract: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
];
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const RPCS = (process.env.BSC_RPC || '')
  .split(',').map(s => s.trim()).filter(Boolean).concat([
    'https://bsc-dataseed.binance.org',
    'https://bsc-dataseed1.defibit.io',
    'https://bsc.publicnode.com',
    'https://binance.llamarpc.com',
  ]);
let rpcIdx = 0;

/* ---------------- 带代理支持的 HTTPS POST ---------------- */
function viaProxy(host, port, cb) {
  const p = new URL(process.env.HTTPS_PROXY || process.env.HTTP_PROXY);
  const sock = net.connect(Number(p.port) || 80, p.hostname, () => {
    sock.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n\r\n`);
  });
  let buf = '';
  sock.on('data', function onData(d) {
    buf += d.toString();
    if (buf.includes('\r\n\r\n')) {
      sock.removeListener('data', onData);
      if (!/^HTTP\/1\.[01] 200/.test(buf)) return cb(new Error('proxy connect failed'));
      cb(null, tls.connect({ socket: sock, servername: host }));
    }
  });
  sock.on('error', cb);
}
function postJson(urlStr, body, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const data = JSON.stringify(body);
    const send = socket => {
      socket.setTimeout(timeoutMs);
      socket.write(
        `POST ${u.pathname} HTTP/1.1\r\nHost: ${u.host}\r\nContent-Type: application/json\r\n` +
        `Content-Length: ${Buffer.byteLength(data)}\r\nConnection: close\r\n\r\n${data}`);
      let buf = '';
      socket.on('data', d => (buf += d.toString()));
      socket.on('timeout', () => { socket.destroy(); reject(new Error('rpc timeout')); });
      socket.on('error', reject);
      socket.on('end', () => {
        const idx = buf.indexOf('\r\n\r\n');
        try {
          resolve(JSON.parse(buf.slice(idx + 4)));
        } catch (e) { reject(new Error('bad rpc response')); }
      });
    };
    const useProxy = !u.hostname.includes('localhost') &&
                     (process.env.HTTPS_PROXY || process.env.HTTP_PROXY);
    if (useProxy) {
      viaProxy(u.hostname, 443, (err, sock) => err ? reject(err) : send(sock));
    } else {
      send(tls.connect({ host: u.hostname, port: u.port || 443, servername: u.hostname }));
    }
  });
}
async function rpc(method, params) {
  let lastErr;
  for (let i = 0; i < RPCS.length; i++) {
    const ep = RPCS[(rpcIdx + i) % RPCS.length];
    try {
      const res = await postJson(ep, { jsonrpc: '2.0', id: Date.now(), method, params });
      if (res.error) throw new Error(res.error.message || 'rpc error');
      rpcIdx = (rpcIdx + i) % RPCS.length; // 记住能用的端点
      return res.result;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('all rpc failed');
}

/* ---------------- 解析工具 ---------------- */
function padAddr(addrLower) {
  return '0x' + '0'.repeat(24) + addrLower.replace(/^0x/, '').toLowerCase();
}
function decodeHexWei(hex) {
  return Number(BigInt(hex)) / 1e18; // 金额精度到小数点后足够位
}

/** 从交易回执里提取「转入 toAddr」的代币转账 */
async function transfersFromTx(txHash, toAddr) {
  const rcpt = await rpc('eth_getTransactionReceipt', [txHash]);
  if (!rcpt || !rcpt.logs) return [];
  const out = [];
  for (const log of rcpt.logs) {
    const tk = TOKENS.find(t => t.contract.toLowerCase() === (log.address || '').toLowerCase());
    if (!tk) continue;
    if (!log.topics || log.topics[0] !== TRANSFER_TOPIC || log.topics.length < 3) continue;
    if ((log.topics[2] || '').toLowerCase() !== padAddr(toAddr)) continue;
    out.push({
      token: tk.symbol, txHash,
      logIndex: Number(log.logIndex),
      from: '0x' + log.topics[1].slice(26).toLowerCase(),
      to: toAddr.toLowerCase(),
      amount: decodeHexWei(log.data),
      block: Number(rcpt.blockNumber),
    });
  }
  return out;
}

/** 扫描最近 range 个区块里所有转入 toAddr 的代币转账 */
async function scanRecentTransfers(toAddr, range = 2200) {
  const head = Number(await rpc('eth_blockNumber', []));
  const fromBlock = Math.max(0, head - range);
  const to = padAddr(toAddr);
  const out = [];
  for (const tk of TOKENS) {
    // 分块查询避免单次范围过大被节点拒
    const CHUNK = 4500;
    for (let s = fromBlock; s <= head; s += CHUNK + 1) {
      const e = Math.min(head, s + CHUNK);
      const logs = await rpc('eth_getLogs', [{
        fromBlock: '0x' + s.toString(16),
        toBlock: '0x' + e.toString(16),
        address: tk.contract,
        topics: [TRANSFER_TOPIC, null, to],
      }]).catch(() => []);
      for (const log of logs || []) {
        out.push({
          token: tk.symbol,
          txHash: log.transactionHash,
          logIndex: Number(log.logIndex),
          from: '0x' + (log.topics[1] || '').slice(26).toLowerCase(),
          to: toAddr.toLowerCase(),
          amount: decodeHexWei(log.data),
          block: Number(parseInt(log.blockNumber, 16)),
        });
      }
      if (e >= head) break;
    }
  }
  return out;
}

module.exports = { TOKENS, TRANSFER_TOPIC, rpc, transfersFromTx, scanRecentTransfers, padAddr };
