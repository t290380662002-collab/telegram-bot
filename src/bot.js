require('dotenv').config();
const { Telegraf } = require('telegraf');
const { db, rtdb } = require('./firebase');

const bot = new Telegraf(process.env.BOT_TOKEN);

// 基本命令
bot.start((ctx) => {
  const userName = ctx.from.username || ctx.from.first_name;
  ctx.reply(`歡迎使用出入帳機器人, ${userName}!`);
});

bot.help((ctx) => {
  ctx.reply('可用命令:\n/start - 開始\n/help - 幫助\n/income - 記錄收入\n/expense - 記錄支出\n/balance - 查詢餘額\n/history - 查詢歷史');
});

// 啟動機器人
bot.launch();
console.log('Telegram bot 已啟動...');

// 優雅關閉
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
