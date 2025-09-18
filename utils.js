const BigNumber = require('bignumber.js');

function now() { return Date.now(); }

function safeParseFloat(x, fallback=0) {
  try { return parseFloat(x) || fallback; } catch (e) { return fallback; }
}

module.exports = { now, safeParseFloat, BigNumber };
