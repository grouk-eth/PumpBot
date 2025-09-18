// executor.js - placeholder executor. Handles buying (manual via /execute) and auto-sell trigger.
// WARNING: This file DOES NOT implement real swaps out-of-the-box.
// It contains structure, position tracking, and pseudo-swap via sending SOL (replace with real DEX swap).

const { Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction } = require('@solana/web3.js');
const fs = require('fs');
const { sendTelegram } = require('./telegram');
const { safeParseFloat } = require('./utils');

const RPC_URL = process.env.RPC_URL;
const DRY_RUN = (process.env.DRY_RUN === 'true');
const MAX_SPEND_SOL = parseFloat(process.env.MAX_SPEND_SOL || '0.01');
const MAX_POSITION_SIZE_SOL = parseFloat(process.env.MAX_POSITION_SIZE_SOL || '0.05');

let connection = new Connection(RPC_URL, 'confirmed');

// Load keypair (either path or base58)
let payer = null;
if (process.env.PRIVATE_KEY_BASE58) {
  const bs = process.env.PRIVATE_KEY_BASE58.trim();
  // base58 -> Buffer
  const bs58 = require('bs58');
  const secret = bs58.decode(bs);
  payer = Keypair.fromSecretKey(secret);
} else if (process.env.PRIVATE_KEY_PATH) {
  const raw = JSON.parse(fs.readFileSync(process.env.PRIVATE_KEY_PATH));
  payer = Keypair.fromSecretKey(Buffer.from(raw));
} else {
  console.warn('No private key configured. Executor will not sign transactions.');
}

let positions = {}; // mint -> {spent_sol, amount_tokens, buy_tx}

async function executeBuy(token) {
  // token contains .mint, .symbol, suggested_spend_sol
  const spend = Math.min(MAX_SPEND_SOL, safeParseFloat(token.suggested_spend_sol, MAX_SPEND_SOL));
  if (spend <= 0) throw new Error('spend <=0');

  // safety: check current position size
  const cur = positions[token.mint] ? positions[token.mint].spent_sol : 0;
  if (cur + spend > MAX_POSITION_SIZE_SOL) {
    await sendTelegram(`Position limit reached for ${token.symbol || token.mint}. Skipping buy.`);
    return { status: 'skipped-position-limit' };
  }

  await sendTelegram(`Executor: Preparing BUY ${token.symbol || token.mint} with ${spend} SOL (DRY=${DRY_RUN})`);

  if (DRY_RUN) {
    // record a fake position for testing
    positions[token.mint] = positions[token.mint] || { spent_sol: 0, token_amount: 0, buy_tx: null };
    positions[token.mint].spent_sol += spend;
    positions[token.mint].token_amount += 0.0001; // placeholder
    return { status: 'dry-run-recorded', mint: token.mint, spent: spend };
  }

  // REAL swap implementation placeholder:
  // For production, replace below with DEX swap (Jupiter / Raydium / Serum).
  // Example: build swap via aggregator, sign tx with payer, send and confirm.

  // Example: send SOL to random address (DO NOT use this in real bot)
  const toPubkey = payer.publicKey; // dummy
  const tx = new Transaction().add(SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey,
    lamports: Math.floor(spend * LAMPORTS_PER_SOL)
  }));
  const sig = await connection.sendTransaction(tx, [payer]);
  await connection.confirmTransaction(sig, 'confirmed');

  positions[token.mint] = positions[token.mint] || { spent_sol: 0, token_amount: 0, buy_tx: null };
  positions[token.mint].spent_sol += spend;
  positions[token.mint].buy_tx = sig;
  // token amount unknown until real swap is implemented
  await sendTelegram(`BUY executed (placeholder). tx=${sig}`);
  return { status: 'executed-placeholder', tx: sig, mint: token.mint };
}

async function executeSell(mint) {
  if (!positions[mint]) {
    await sendTelegram(`No position for ${mint} to sell.`);
    return { status: 'no-position' };
  }
  await sendTelegram(`Executor: Preparing SELL for ${mint} (DRY=${DRY_RUN})`);
  if (DRY_RUN) {
    // remove fake position
    delete positions[mint];
    return { status: 'dry-run-sold', mint };
  }

  // REAL sell integration required here.
  // For now simulate a sell by logging tx id.
  const fakeTx = 'SIMULATED_SELL_TX_' + Date.now();
  delete positions[mint];
  await sendTelegram(`SELL executed (placeholder). tx=${fakeTx}`);
  return { status: 'executed-placeholder', tx: fakeTx };
}

async function executorExecute(token) {
  // human calls this to buy
  return await executeBuy(token);
}

// Called by watcher when big buy detected
async function triggerAutoSellForMint(mint) {
  await sendTelegram(`Auto-sell triggered for ${mint}`);
  return await executeSell(mint);
}

function getPositions() { return positions; }

module.exports = { executorExecute, triggerAutoSellForMint, getPositions };
