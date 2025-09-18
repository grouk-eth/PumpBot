const { Telegraf } = require('telegraf');
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let bot = null;
if (BOT_TOKEN) {
  bot = new Telegraf(BOT_TOKEN);
  // no bot.launch() to avoid long polling in serverless if not needed
}

async function sendTelegram(text) {
  try {
    if (!BOT_TOKEN || !CHAT_ID) {
      console.log('TG fallback:', text);
      return;
    }
    await bot.telegram.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error('Telegram send error', e.message);
  }
}

module.exports = { sendTelegram };
