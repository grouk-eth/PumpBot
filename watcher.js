// watcher.js - polls WATCH_ENDPOINT and posts to telegram. Also detects big buys window events.
const axios = require('axios');
const { sendTelegram } = require('./telegram');
const { safeParseFloat } = require('./utils');

const WATCH_ENDPOINT = process.env.WATCH_ENDPOINT;
const CHECK_INTERVAL_MS = parseInt(process.env.CHECK_INTERVAL_MS || '2000');
const BIG_BUY_USD_THRESHOLD = parseFloat(process.env.BIG_BUY_USD_THRESHOLD || '50000');
const BIG_BUY_WINDOW_MS = parseInt(process.env.BIG_BUY_WINDOW_MS || '60000');

let _last = null;
let buyEvents = {}; // tokenMint -> [{ts, usd}] to aggregate big buys in window

function recordBuy(tokenMint, usd) {
  if (!buyEvents[tokenMint]) buyEvents[tokenMint] = [];
  buyEvents[tokenMint].push({ ts: Date.now(), usd });
  // purge old
  buyEvents[tokenMint] = buyEvents[tokenMint].filter(x => (Date.now() - x.ts) <= BIG_BUY_WINDOW_MS);
}

function aggregatedBuys(tokenMint) {
  const arr = buyEvents[tokenMint] || [];
  return arr.reduce((s,x)=>s + (x.usd||0),0);
}

async function checkOnce() {
  try {
    const r = await axios.get(WATCH_ENDPOINT, { timeout: 6000 });
    const data = r.data;
    const tokens = data.tokens || [];
    for (let t of tokens) {
      // Basic snipable rule
      if (isSnipable(t)) {
        if (!_last || _last.mint !== t.mint) {
          _last = t;
          const msg = `*GROUK PULSE ALERT*\nSymbol: ${t.symbol || t.name}\nMint: ${t.mint}\nVolume: $${t.volume_usd || 'NA'}\nLiquidity added: ${t.liquidity_added}\n\nUse /execute endpoint to buy (manual) or call POST /execute with token payload.`;
          await sendTelegram(msg);
        }
      }
      // If feed includes trades / buys, simulate recording large buys
      if (t.buy_events && Array.isArray(t.buy_events)) {
        for (let be of t.buy_events) {
          // be = {usd, buyer, ts}
          recordBuy(t.mint, safeParseFloat(be.usd,0));
        }
        const agg = aggregatedBuys(t.mint);
        if (agg >= BIG_BUY_USD_THRESHOLD) {
          // big buy detected - post and trigger auto-sell via executor endpoint (internal)
          const msg2 = `*BIG BUY DETECTED* for ${t.symbol || t.name}\nAggregated buys in window: $${agg}\nTriggering AUTO-SELL for existing positions.`;
          await sendTelegram(msg2);
          // call internal executor auto-sell (we require executor module)
          const exec = require('./executor');
          // non-blocking
          exec.triggerAutoSellForMint(t.mint).catch(e => console.error('AutoSell error', e));
          // reset events for this mint to avoid repeated triggers
          buyEvents[t.mint] = [];
        }
      }
    }
  } catch (e) {
    console.error('Watcher error', e.message);
  }
}

function isSnipable(token) {
  if (!token) return false;
  if (token.liquidity_added && (token.volume_usd || 0) > 500) return true;
  return false;
}

function startWatcher() {
  console.log('Watcher started, endpoint=', WATCH_ENDPOINT);
  setInterval(checkOnce, CHECK_INTERVAL_MS);
}

function getLastTarget() { return _last; }

module.exports = { startWatcher, getLastTarget };
