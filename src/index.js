require('dotenv').config();
const { Telegraf } = require('telegraf');
const https = require('https');
const transactionHandler = require('./handlers/transactionHandler');
const { db, firebaseReady } = require('./firebase');

// ====== 工具函數 ======
function fmtDate(date) {
  const d = date instanceof Date ? date : (date && date.toDate ? date.toDate() : new Date(date));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ====== 強制使用 IPv4（解決沙盒 IPv6 連線問題）======
const ipv4Agent = new https.Agent({ family: 4 });

const token = process.env.BOT_TOKEN;
const bot = new Telegraf(token, {
  telegram: { agent: ipv4Agent }
});

// ====== 邀請碼授權系統（有效期 3 個月）======
// 管理員可透過 /generate 產生一次性邀請碼
// 新用戶使用 /start <邀請碼> 來取得授權（有效期 3 個月）
const ALLOWED_USERS = [7985643310];  // 只有這些 ID 能產生邀請碼
let authorizedUsers = new Map();  // userId → { expiresAt: Date | null }
let authorizedGroups = new Map();  // groupId → { expiresAt: Date | null }

// 硬編碼管理員永不過期
ALLOWED_USERS.forEach(id => authorizedUsers.set(id, { expiresAt: null }));

// 授權有效期（毫秒）：3 個月
const AUTH_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

// 從 Firestore 加載已授權用戶
async function loadAuthorizedUsers() {
  if (!firebaseReady || !db) {
    console.log('⚠️  Firebase 未就緒，跳過授權載入');
    return;
  }
  try {
    const doc = await db.collection('settings').doc('authorized_users').get();
    if (doc.exists && doc.data().users) {
      for (const [userIdStr, info] of Object.entries(doc.data().users)) {
        const userId = parseInt(userIdStr);
        const expiresAt = info.expiresAt ? info.expiresAt.toDate() : null;
        // 跳過已過期的
        if (expiresAt && expiresAt < new Date()) continue;
        authorizedUsers.set(userId, { expiresAt });
      }
      console.log(`👥 已加載 ${authorizedUsers.size} 位有效授權用戶`);
    }
  } catch (e) {
    console.error('加載授權用戶失敗:', e.message);
  }
}

// 儲存用戶授權到 Firestore
async function saveUserAuth(userId, expiresAt) {
  const docRef = db.collection('settings').doc('authorized_users');
  const doc = await docRef.get();
  let users = doc.exists ? (doc.data().users || {}) : {};
  users[String(userId)] = { expiresAt: expiresAt || null };
  await docRef.set({ users });
}

// 加載已授權群組
async function loadAuthorizedGroups() {
  if (!firebaseReady || !db) return;
  try {
    const doc = await db.collection('settings').doc('authorized_groups').get();
    if (doc.exists && doc.data().groups) {
      for (const [groupIdStr, info] of Object.entries(doc.data().groups)) {
        const groupId = parseInt(groupIdStr);
        const expiresAt = info.expiresAt ? info.expiresAt.toDate() : null;
        if (expiresAt && expiresAt < new Date()) continue;
        authorizedGroups.set(groupId, { expiresAt });
      }
      console.log(`👥 已加載 ${authorizedGroups.size} 個已授權群組`);
    }
  } catch (e) {
    console.error('加載授權群組失敗:', e.message);
  }
}

// 儲存群組授權到 Firestore
async function saveGroupAuth(groupId, expiresAt) {
  const docRef = db.collection('settings').doc('authorized_groups');
  const doc = await docRef.get();
  let groups = doc.exists ? (doc.data().groups || {}) : {};
  groups[String(groupId)] = { expiresAt: expiresAt || null };
  await docRef.set({ groups });
}

// 檢查群組是否已授權
function isGroupAuthorized(chatId) {
  const info = authorizedGroups.get(chatId);
  if (!info) return false;
  if (info.expiresAt && info.expiresAt < new Date()) {
    authorizedGroups.delete(chatId);
    return false;
  }
  return true;
}

// 檢查是否已授權（含過期檢查）
function isAuthorized(userId) {
  const info = authorizedUsers.get(userId);
  if (!info) return false;
  if (info.expiresAt && info.expiresAt < new Date()) {
    authorizedUsers.delete(userId);  // 過期自動移除
    return false;
  }
  return true;
}

// 白名單過濾中間件
bot.use((ctx, next) => {
  // 以下情況跳過檢查：
  // 1. my_chat_member（bot 被拉入群組）
  // 2. /start、/generate、/激活 指令
  if (ctx.updateType === 'my_chat_member' ||
      (ctx.message && ctx.message.text && 
       (ctx.message.text.startsWith('/start') || 
        ctx.message.text.startsWith('/generate') ||
        ctx.message.text.startsWith('/激活')))) {
    return next();
  }

  // 檢查群組授權：如果消息來自已授權的群組，直接放行所有人
  if (ctx.chat && ctx.chat.type !== 'private' && isGroupAuthorized(ctx.chat.id)) {
    return next();
  }

  // 檢查用戶個人授權
  if (ctx.from && !isAuthorized(ctx.from.id)) {
    return ctx.reply(
      `❌ 你沒有使用此機器人的權限\n\n` +
      `你的 User ID: ${ctx.from.id}\n` +
      `請使用 /start <邀請碼> 來取得授權\n` +
      `或在已授權的群組中使用`
    ).catch(() => {});
  }

  return next();
});

// ====== 鍵盤按鈕（完全匹配截圖版面）======
const mainKeyboard = {
  keyboard: [
    ['💰 入金(+) ', '📉 出金(-) ', '📊 顯示統計'],
    ['🌙 手續費', '🛡️ 風控', '❌ 刪除'],
    ['📅 結算預覽', '📝 結算計入', '📤 匯出'],
    ['❓ 幫助']
  ],
  resize_keyboard: true,
  one_time_keyboard: false
};

// ====== 用戶輸入狀態追蹤 ======
const userInputMode = new Map();

// ====== 群組自動附加鍵盤 ======
bot.use((ctx, next) => {
  if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
    const origReply = ctx.reply.bind(ctx);
    ctx.reply = (text, extra = {}) => {
      if (!extra.reply_markup) {
        extra.reply_markup = mainKeyboard;
      }
      return origReply(text, extra);
    };
  }
  return next();
});

// ====== 群組相關處理 ======
// 當 bot 被加入群組時，發送歡迎訊息和鍵盤
bot.on('my_chat_member', async (ctx) => {
  const chat = ctx.chat;
  const newStatus = ctx.update.my_chat_member.new_chat_member.status;

  if ((chat.type === 'group' || chat.type === 'supergroup') && newStatus === 'member') {
    await ctx.telegram.sendMessage(chat.id,
      `🤖 出入帳機器人 已加入群組！\n\n` +
      `請使用下方鍵盤操作，或直接輸入指令：\n` +
      `💰 直接輸入 +數字 記入金\n` +
      `📉 直接輸入 -數字 記出金`,
      { reply_markup: mainKeyboard }
    );
  }
});

// ====== /start 指令（支援邀請碼）======
bot.start(async (ctx) => {
  const payload = ctx.startPayload;
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || ctx.from.username || '用戶';

  if (payload) {
    // 判斷是否在群組中
    const isGroup = ctx.chat && ctx.chat.type !== 'private';

    // 嘗試使用邀請碼
    try {
      const inviteDoc = await db.collection('inviteCodes').doc(payload).get();

      if (!inviteDoc.exists) {
        return ctx.reply('❌ 邀請碼無效，請檢查是否輸入正確');
      }

      const codeData = inviteDoc.data();
      if (codeData.used) {
        return ctx.reply('❌ 此邀請碼已被使用');
      }
      if (codeData.expiresAt) {
        const codeExpiry = codeData.expiresAt.toDate ? codeData.expiresAt.toDate() : new Date(codeData.expiresAt);
        if (codeExpiry < new Date()) {
          return ctx.reply('❌ 此邀請碼已過期，請向管理員索取新碼');
        }
      }

      // 標記邀請碼為已使用
      await inviteDoc.ref.update({
        used: true,
        usedBy: isGroup ? `group_${ctx.chat.id}_by_${userId}` : userId,
        usedAt: new Date()
      });

      const expiresAt = new Date(Date.now() + AUTH_DURATION_MS);

      if (isGroup) {
        // 群組授權：授權整個群組
        authorizedGroups.set(ctx.chat.id, { expiresAt });
        await saveGroupAuth(ctx.chat.id, expiresAt);
        await ctx.reply(
          `✅ 群組授權成功！\n\n` +
          `群組 ID: ${ctx.chat.id}\n` +
          `此群組內所有成員現在都可以使用機器人\n` +
          `📅 授權有效期至: ${fmtDate(expiresAt)}\n\n` +
          `請使用下方鍵盤操作 👇`,
          { reply_markup: mainKeyboard }
        );
      } else {
        // 個人授權
        authorizedUsers.set(userId, { expiresAt });
        await saveUserAuth(userId, expiresAt);

        await ctx.reply(
          `✅ 授權成功！歡迎 ${userName}\n\n` +
          `你現在可以使用出入帳機器人了\n` +
          `📅 授權有效期至: ${fmtDate(expiresAt)}\n\n` +
          `請使用下方鍵盤操作 👇`,
          { reply_markup: mainKeyboard }
        );
      }
    } catch (error) {
      console.error('邀請碼驗證錯誤:', error);
      await ctx.reply('❌ 驗證失敗: ' + error.message);
    }
  } else {
    // 無邀請碼
    if (isAuthorized(userId)) {
      await ctx.reply(
        `👋 歡迎回來 ${userName}\n\n` +
        `可用指令:\n` +
        `💰 入金: /+ 金額\n` +
        `📉 出金: /- 金額\n` +
        `🌙 手續費: /手續費 金額\n` +
        `📊 顯示統計: /顯示\n` +
        `🗑️ 刪除: /刪除 編號 日期\n` +
        `🛡️ 風控: /風控 金額\n\n` +
        `請使用下方鍵盤操作:`,
        { reply_markup: mainKeyboard }
      );
    } else {
      await ctx.reply(
        `🔒 此機器人需要邀請碼才能使用\n\n` +
        `請向管理員索取邀請碼，然後輸入：\n` +
        `/start <邀請碼>\n\n` +
        `例：/start INVITE-XXXXXX`
      );
    }
  }
});

// ====== 文字訊息處理（包含 /+ 和 /-）======
bot.on('text', async (ctx, next) => {
  const text = ctx.message.text.trim();
  const inputModeKey = `${ctx.from.id}_${ctx.chat.id}`;
  const chatType = ctx.chat.type;
  const chatId = ctx.chat.id;
  console.log(`[HANDLER] text="${text}", chatType=${chatType}, chatId=${chatId}, inputModeKey=${inputModeKey}`);

  // --- 處理 /激活 指令（群組授權）---
  if (text.startsWith('/激活')) {
    const parts = text.split(/\s+/);
    const code = parts[1];
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    if (!code) return ctx.reply('❌ 請提供邀請碼\n格式: /激活 <邀請碼>');
    if (ctx.chat.type === 'private') return ctx.reply('❌ 此指令僅可在群組中使用\n私聊請使用 /start <邀請碼>');

    try {
      const inviteDoc = await db.collection('inviteCodes').doc(code).get();
      if (!inviteDoc.exists) return ctx.reply('❌ 邀請碼無效');
      const cd = inviteDoc.data();
      if (cd.used) return ctx.reply('❌ 此邀請碼已被使用');
      const codeExpiry = cd.expiresAt && cd.expiresAt.toDate ? cd.expiresAt.toDate() : null;
      if (codeExpiry && codeExpiry < new Date()) return ctx.reply('❌ 此邀請碼已過期');

      await inviteDoc.ref.update({ used: true, usedBy: `group_${chatId}_by_${userId}`, usedAt: new Date() });
      const expiresAt = new Date(Date.now() + AUTH_DURATION_MS);
      authorizedGroups.set(chatId, { expiresAt });
      await saveGroupAuth(chatId, expiresAt);

      return ctx.reply(
        `✅ 群組授權成功！\n群組 ID: ${chatId}\n此群組內所有成員現在都可以使用機器人\n📅 有效期至: ${fmtDate(expiresAt)}\n請使用下方鍵盤操作 👇`,
        { reply_markup: mainKeyboard }
      );
    } catch (e) {
      console.error('群組激活錯誤:', e);
      return ctx.reply('❌ 激活失敗: ' + e.message);
    }
  }

  // --- 處理 /+ 和 /- 直接指令（含備註）---
  if (text.match(/^\/\+\s*\d/) || text.match(/^\+\s*\d/)) {
    const clean = text.replace(/^\/\+\s*/, '').replace(/^\+\s*/, '');
    const parts = clean.trim().split(/\s+/);
    const amount = parseFloat(parts[0]);
    if (!isNaN(amount) && amount > 0) return transactionHandler.addIncome(ctx, amount, parts.slice(1).join(' ') || 'W');
  }
  if (text.match(/^\/-\s*\d/) || text.match(/^-\s*\d/)) {
    const clean = text.replace(/^\/-\s*/, '').replace(/^-\s*/, '');
    const parts = clean.trim().split(/\s+/);
    const amount = parseFloat(parts[0]);
    if (!isNaN(amount) && amount > 0) return transactionHandler.addExpense(ctx, amount, parts.slice(1).join(' ') || 'W');
  }

  // --- 傳統指令直接處理（解決 bot.command() 對中文兼容問題）---
  if (text.startsWith('/顯示')) return transactionHandler.showStatus(ctx);
  if (text.startsWith('/刪除')) {
    const parts = text.split(/\s+/).slice(1);
    if (!parts[0]) return ctx.reply('❌ 請輸入編號\n格式: /刪除 #1 或 /刪除 #1 日期');
    return transactionHandler.deleteRecord(ctx, parts[0], parts[1] || null);
  }
  if (text.startsWith('/風控')) {
    const input = text.replace(/^\/風控\s*/, '');
    return transactionHandler.setRiskControl(ctx, input);
  }
  if (text.startsWith('/結算計入')) {
    const ym = text.split(/\s+/)[1] || '';
    return transactionHandler.confirmSettlement(ctx, ym);
  }
  if (text.startsWith('/結算')) {
    const ym = text.split(/\s+/)[1] || '';
    return transactionHandler.previewSettlement(ctx, ym);
  }
  if (text.startsWith('/匯出')) {
    const ym = text.split(/\s+/)[1] || '';
    return transactionHandler.exportMonthlyData(ctx, ym);
  }
  if (text.startsWith('/手續費')) {
    const parts = text.replace(/^\/手續費\s*/, '').trim().split(/\s+/);
    const amt = parseFloat(parts[0]);
    if (isNaN(amt) || amt <= 0) return ctx.reply('❌ 請輸入金額\n例如: /手續費 100 或 /手續費 100 C');
    return transactionHandler.addFee(ctx, amt, parts.slice(1).join(' ') || 'W');
  }

  // --- 其他 / 開頭的指令（/+ 和 /- 除外）：交給 bot.command() 處理 ---
  if (text.startsWith('/') && !text.startsWith('/+') && !text.startsWith('/-')) {
    return next();
  }

  // --- 處理入金模式（鍵盤按鈕觸發）---
  if (text === '💰 入金(+) ' || text === '💰 入金(+)') {
    userInputMode.set(inputModeKey, 'income');
    return ctx.reply(`請輸入入金金額：
• 無備註：10000（自動設為 W）
• 有備註：10000 C`);
  }

  // --- 處理出金模式（鍵盤按鈕觸發）---
  if (text === '📉 出金(-) ' || text === '📉 出金(-)') {
    userInputMode.set(inputModeKey, 'expense');
    return ctx.reply(`請輸入出金金額：
• 無備註：10000（自動設為 W）
• 有備註：10000 C`);
  }

  // --- 處理手續費模式 ---
  if (text === '🌙 手續費') {
    userInputMode.set(inputModeKey, 'fee');
    return ctx.reply(`請輸入手續費金額：
• 無備註：100（自動設為 W）
• 有備註：100 C`);
  }

  // --- 顯示統計 ---
  if (text === '📊 顯示統計') {
    return transactionHandler.showStatus(ctx);
  }

  // --- 刪除模式 ---
  if (text === '❌ 刪除') {
    userInputMode.set(inputModeKey, 'delete_recordId');
    return transactionHandler.listCurrentMonthForDelete(ctx);
  }

  // --- 風控模式 ---
  if (text === '🛡️ 風控') {
    userInputMode.set(inputModeKey, 'risk');
    return ctx.reply(
      `請輸入風控限額：\n` +
      `• 只設限額：10000\n` +
      `• 設限額+到期日：10000 2026-07-01\n` +
      `• 刪除風控：0 或 刪除`
    );
  }

  // --- 結算預覽 ---
  if (text === '📅 結算預覽') {
    userInputMode.set(inputModeKey, 'preview');
    return ctx.reply('請輸入要預覽的年月（例如：2026-06）');
  }

  // --- 結算計入 ---
  if (text === '📝 結算計入') {
    userInputMode.set(inputModeKey, 'confirm');
    return ctx.reply('請輸入要結算的年月（例如：2026-06）');
  }

  // --- 匯出 ---
  if (text === '📤 匯出') {
    const now = new Date();
    const months = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ text: ym, callback_data: `export_${ym}` });
    }
    const keyboard = [];
    for (let i = 0; i < months.length; i += 3) {
      keyboard.push(months.slice(i, i + 3));
    }
    keyboard.push([{ text: '❌ 取消', callback_data: 'cancel_export' }]);
    return ctx.reply('📤 請選擇要匯出的月份：', {
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  // --- 幫助 ---
  if (text === '❓ 幫助') {
    return ctx.reply(
      `🤖 出入帳機器人 幫助\n\n` +
      `💰 入金: /+ 金額 或 直接輸入 +金額\n` +
      `📉 出金: /- 金額 或 直接輸入 -金額\n` +
      `🌙 手續費: /手續費 金額\n` +
      `📊 顯示統計: /顯示\n` +
      `🗑️ 刪除: /刪除 編號 日期\n` +
      `🛡️ 風控: /風控 金額\n` +
      `📤 匯出: /匯出 年月\n` +
      `📊 結算預覽: /結算 年月\n` +
      `✅ 結算計入: /結算計入 年月\n\n` +
      `也可以使用下方鍵盤快速操作!`
    );
  }

  // --- 處理輸入模式的數字 ---
  const mode = userInputMode.get(inputModeKey);
  if (mode) {

    // --- 非數字輸入：先處理，避開下方 parseFloat 檢查 ---
    if (mode === 'risk') {
      userInputMode.delete(inputModeKey);
      return transactionHandler.setRiskControl(ctx, text);
    }
    if (mode === 'delete_recordId') {
      userInputMode.delete(inputModeKey);
      const recordId = text.startsWith('#') ? text : `#${text}`;
      return transactionHandler.deleteRecord(ctx, recordId);
    }
    if (mode === 'preview') {
      userInputMode.delete(inputModeKey);
      return transactionHandler.previewSettlement(ctx, text);
    }
    if (mode === 'confirm') {
      userInputMode.delete(inputModeKey);
      return transactionHandler.confirmSettlement(ctx, text);
    }

    // --- 其餘模式：解析 金額 [備註] ---
    const parts = text.trim().split(/\s+/);
    const amount = parseFloat(parts[0]);
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('❌ 請輸入有效的正數金額');
    }
    // 備註：無則自動設為 W
    const remark = parts.slice(1).join(' ') || 'W';
    userInputMode.delete(inputModeKey);

    switch (mode) {
      case 'income':
        return transactionHandler.addIncome(ctx, amount, remark);
      case 'expense':
        return transactionHandler.addExpense(ctx, amount, remark);
      case 'fee':
        return transactionHandler.addFee(ctx, amount, remark);
      default:
        return;
    }
  }
});

// ====== 傳統指令（兼容快捷輸入）======

// 入金指令 /+ 金額 [備註]
bot.command('+', (ctx) => {
  const parts = ctx.message.text.replace(/^\+\s*/, '').trim().split(/\s+/);
  const amount = parseFloat(parts[0]);
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('❌ 請輸入金額\n例如: /+ 1000 或 /+ 1000 C');
  }
  const remark = parts.slice(1).join(' ') || 'W';
  return transactionHandler.addIncome(ctx, amount, remark);
});

// 出金指令 /- 金額 [備註]
bot.command('-', (ctx) => {
  const parts = ctx.message.text.replace(/^-\s*/, '').trim().split(/\s+/);
  const amount = parseFloat(parts[0]);
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('❌ 請輸入金額\n例如: /- 1000 或 /- 1000 C');
  }
  const remark = parts.slice(1).join(' ') || 'W';
  return transactionHandler.addExpense(ctx, amount, remark);
});

// 手續費指令
bot.command('手續費', (ctx) => {
  const parts = ctx.message.text.replace(/^\/手續費\s*/, '').trim().split(/\s+/);
  const amount = parseFloat(parts[0]);
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('❌ 請輸入金額\n例如: /手續費 100 或 /手續費 100 C');
  }
  const remark = parts.slice(1).join(' ') || 'W';
  return transactionHandler.addFee(ctx, amount, remark);
});

// 刪除指令
bot.command('刪除', (ctx) => {
  const parts = ctx.message.text.split(' ').slice(1);
  if (parts.length < 1) {
    return ctx.reply('❌ 請輸入編號和日期\n例如: /刪除 #1 2026-06-04\n或: /刪除 #1');
  }
  const recordId = parts[0];
  const dateStr = parts[1] || null;
  return transactionHandler.deleteRecord(ctx, recordId, dateStr);
});

// 顯示指令
bot.command('顯示', (ctx) => transactionHandler.showStatus(ctx));

// 匯出指令
bot.command('匯出', (ctx) => {
  const yearMonth = ctx.message.text.split(' ').slice(1).join(' ');
  return transactionHandler.exportMonthlyData(ctx, yearMonth);
});

// 風控指令
bot.command('風控', (ctx) => {
  const amount = ctx.message.text.split(' ').slice(1).join(' ');
  if (!amount || isNaN(parseFloat(amount))) {
    return ctx.reply('❌ 請輸入限額\n例如: /風控 10000');
  }
  return transactionHandler.setRiskControl(ctx, amount);
});

// 結算預覽指令
bot.command('結算', (ctx) => {
  const yearMonth = ctx.message.text.split(' ').slice(1).join(' ');
  return transactionHandler.previewSettlement(ctx, yearMonth);
});

// 結算計入指令
bot.command('結算計入', (ctx) => {
  const yearMonth = ctx.message.text.split(' ').slice(1).join(' ');
  return transactionHandler.confirmSettlement(ctx, yearMonth);
});

// ====== 邀請碼管理 ======
// 產生邀請碼
bot.command('generate', async (ctx) => {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || ctx.from.username || '用戶';

  // 檢查權限：只有管理員（ALLOWED_USERS）才能產生邀請碼
  // 如 ALLOWED_USERS 為空，則已授權用戶可產生
  const isGenerator = ALLOWED_USERS.length > 0
    ? ALLOWED_USERS.includes(userId)
    : isAuthorized(userId);
  
  if (!isGenerator) {
    return ctx.reply('❌ 你沒有權限產生邀請碼，請聯繫管理員');
  }

  // 確保該用戶也在授權名單中（自動加）
  if (!isAuthorized(userId)) {
    const adminExpiresAt = new Date(Date.now() + AUTH_DURATION_MS);
    authorizedUsers.set(userId, { expiresAt: adminExpiresAt });
    await saveUserAuth(userId, adminExpiresAt);
    console.log(`👑 管理員已授權: ${userName} (${userId})`);
  }

  try {
    // 產生唯一邀請碼
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    let exists = true;
    
    while (exists) {
      code = 'INVITE-';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      const checkDoc = await db.collection('inviteCodes').doc(code).get();
      exists = checkDoc.exists;
    }

    // 存入 Firestore（有效期 3 個月）
    const codeExpiresAt = new Date(Date.now() + AUTH_DURATION_MS);
    await db.collection('inviteCodes').doc(code).set({
      code,
      createdBy: userId,
      createdByName: userName,
      createdAt: new Date(),
      expiresAt: codeExpiresAt,
      used: false,
      usedBy: null,
      usedAt: null
    });

    const expiryDateStr = `${codeExpiresAt.getFullYear()}-${String(codeExpiresAt.getMonth() + 1).padStart(2, '0')}-${String(codeExpiresAt.getDate()).padStart(2, '0')}`;
    await ctx.reply(
      `✅ 邀請碼已產生（有效期 3 個月）\n\n` +
      `📌 ${code}\n` +
      `📅 有效至: ${expiryDateStr}\n\n` +
      `分享此碼給要授權的人使用\n` +
      `私聊輸入 /start ${code}\n` +
      `群組輸入 /激活 ${code}（授權全群）`
    );
  } catch (error) {
    console.error('產生邀請碼錯誤:', error);
    await ctx.reply('❌ 產生失敗: ' + error.message);
  }
});

// ====== /激活 指令（群組中啟用邀請碼，授權整個群組）======
bot.command('激活', async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);
  const code = parts[1];
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (!code) {
    return ctx.reply('❌ 請提供邀請碼\n格式: /激活 <邀請碼>');
  }

  // 檢查是否在群組中
  if (ctx.chat.type === 'private') {
    return ctx.reply('❌ 此指令僅可在群組中使用\n私聊請使用 /start <邀請碼>');
  }

  try {
    const inviteDoc = await db.collection('inviteCodes').doc(code).get();

    if (!inviteDoc.exists) {
      return ctx.reply('❌ 邀請碼無效，請檢查是否輸入正確');
    }

    const codeData = inviteDoc.data();
    if (codeData.used) {
      return ctx.reply('❌ 此邀請碼已被使用');
    }
    if (codeData.expiresAt) {
      const codeExpiry = codeData.expiresAt.toDate ? codeData.expiresAt.toDate() : new Date(codeData.expiresAt);
      if (codeExpiry < new Date()) {
        return ctx.reply('❌ 此邀請碼已過期，請向管理員索取新碼');
      }
    }

    // 標記邀請碼為已使用
    await inviteDoc.ref.update({
      used: true,
      usedBy: `group_${chatId}_by_${userId}`,
      usedAt: new Date()
    });

    // 授權整個群組
    const expiresAt = new Date(Date.now() + AUTH_DURATION_MS);
    authorizedGroups.set(chatId, { expiresAt });
    await saveGroupAuth(chatId, expiresAt);

    await ctx.reply(
      `✅ 群組授權成功！\n\n` +
      `群組 ID: ${chatId}\n` +
      `此群組內所有成員現在都可以使用機器人\n` +
      `📅 授權有效期至: ${fmtDate(expiresAt)}\n\n` +
      `請使用下方鍵盤操作 👇`,
      { reply_markup: mainKeyboard }
    );
  } catch (error) {
    console.error('群組激活錯誤:', error);
    await ctx.reply('❌ 激活失敗: ' + error.message);
  }
});

// ====== 內聯鍵盤回調處理 ======
// 刪除回調 — 點選記錄按鈕直接刪除
bot.action(/^d_(.+)$/, async (ctx) => {
  const docId = ctx.match[1];
  await ctx.answerCbQuery('正在刪除...');
  await transactionHandler.deleteByDocId(ctx, docId);
});

// 取消刪除
bot.action('cancel_delete', async (ctx) => {
  await ctx.answerCbQuery('已取消');
  try { await ctx.deleteMessage(); } catch(e) {}
});

// ====== 匯出功能 ======


// 回調：執行匯出
bot.action(/^export_(.+)$/, async (ctx) => {
  const yearMonth = ctx.match[1];
  await ctx.answerCbQuery(`正在匯出 ${yearMonth}...`);
  try { await ctx.deleteMessage(); } catch(e) {}
  await transactionHandler.exportMonthlyData(ctx, yearMonth);
});

// 取消匯出
bot.action('cancel_export', async (ctx) => {
  await ctx.answerCbQuery('已取消');
  try { await ctx.deleteMessage(); } catch(e) {}
});

// ====== 錯誤處理 ======
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('❌ 發生錯誤，請稍後再試').catch(() => {});
});

// ====== 啟動 ======
async function startBot() {
  try {
    await loadAuthorizedUsers();
    await loadAuthorizedGroups();
  } catch (e) {
    console.warn('⚠️  授權載入失敗，Bot 仍會啟動:', e.message);
  }
  
  bot.launch()
    .then(() => {
      console.log('✅ Telegram bot 已啟動...');
      console.log(`📛 Bot 用户名: ${bot.botInfo ? '@' + bot.botInfo.username : 'unknown'}`);
    })
    .catch((err) => {
      console.error('❌ Bot 啟動失敗:', err.message);
      if (err.message.includes('409') || err.message.includes('Conflict')) {
        console.error('請檢查是否有另一個 bot 實例在運行');
      }
      process.exit(1);
    });
}

startBot();

// 優雅關閉
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
