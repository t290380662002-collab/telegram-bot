const { db } = require('../firebase');
const { Markup } = require('telegraf');
const XLSX = require('xlsx');

// 取得資料範圍 ID：
//   私聊 → user_{userId}（個人資料）
//   群組 → group_{chatId}（該群組共享資料）
function getScopeId(ctx) {
  const chatType = ctx.chat?.type;
  if (chatType === 'group' || chatType === 'supergroup') {
    return `group_${ctx.chat.id}`;
  }
  return `user_${ctx.from.id}`;
}

// 為每個範圍生成遞增的紀錄編號 (#1, #2, #3...)
async function getNextRecordId(userId) {
  const counterRef = db.collection('counters').doc(`recordId_${userId}`);
  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(counterRef);
      if (!doc.exists) {
        transaction.set(counterRef, { count: 1 });
      } else {
        const newCount = doc.data().count + 1;
        transaction.update(counterRef, { count: newCount });
      }
    });
    const updated = await counterRef.get();
    return updated.data().count;
  } catch (error) {
    console.error('取得紀錄編號失敗:', error);
    return Date.now();
  }
}

// 輔助函數：按 createdAt 升序排序
function sortByCreatedAtAsc(docs) {
  return docs.sort((a, b) => {
    const aDate = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
    const bDate = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
    return aDate - bDate;
  });
}

// 輔助函數：按 createdAt 降序排序
function sortByCreatedAtDesc(docs) {
  return docs.sort((a, b) => {
    const aDate = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
    const bDate = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
    return bDate - aDate;
  });
}

// 格式化金額（去掉不必要的小數）
function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  const num = Number(n);
  return num % 1 === 0 ? num.toString() : num.toFixed(1);
}

// 時區轉換：UTC → GMT+8
function toTZ(date) {
  const d = date instanceof Date ? date : (date && date.toDate ? date.toDate() : new Date(date));
  return new Date(d.getTime() + 8 * 60 * 60 * 1000);
}

// 取得當前 GMT+8 時間
function nowTZ() { return toTZ(new Date()); }

// 取得當前 GMT+8 的年月字串 (YYYY-MM)
function yearMonthTZ() {
  const d = nowTZ();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// 格式化時間 HH:MM (GMT+8)
function fmtTime(date) {
  const d = toTZ(date);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// 格式化日期 YYYY-MM-DD (GMT+8)
function fmtDate(date) {
  const d = toTZ(date);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ========== 收入 ==========
async function addIncome(ctx, amount, remark = "W") {
  const userId = getScopeId(ctx);
  const userName = ctx.from.username || ctx.from.first_name || '未知用戶';
  const recordId = await getNextRecordId(userId);
  
  const data = {
    type: 'income',
    remark: remark,
    amount: parseFloat(amount),
    userId,
    userName,
    operatorId: ctx.from.id,
    recordId: `#${recordId}`,
    createdAt: new Date(),
    yearMonth: yearMonthTZ()
  };

  await db.collection('transactions').add(data);

  const stats = await buildRecordStats(ctx, data);

  const msg = [
    `📈 收入記錄成功!`,
    ``,
    `💰 金額: ${fmt(amount)}`,
    `📝 備註: ${remark}`,
    `🆔 編號: #${recordId}`,
    `📅 日期: ${fmtDate(data.createdAt)} ${fmtTime(data.createdAt)}`,
    ``,
    stats,
  ].join('\n');

  await ctx.reply(msg);
}

// ========== 支出 ==========
async function addExpense(ctx, amount, remark = "W") {
  const userId = getScopeId(ctx);
  const userName = ctx.from.username || ctx.from.first_name || '未知用戶';
  const recordId = await getNextRecordId(userId);

  const data = {
    type: 'expense',
    remark: remark,
    amount: parseFloat(amount),
    userId,
    userName,
    operatorId: ctx.from.id,
    recordId: `#${recordId}`,
    createdAt: new Date(),
    yearMonth: yearMonthTZ()
  };

  await db.collection('transactions').add(data);

  const stats = await buildRecordStats(ctx, data);

  const msg = [
    `📉 支出記錄成功!`,
    ``,
    `💰 金額: ${fmt(amount)}`,
    `📝 備註: ${remark}`,
    `🆔 編號: #${recordId}`,
    `📅 日期: ${fmtDate(data.createdAt)} ${fmtTime(data.createdAt)}`,
    ``,
    stats,
  ].join('\n');

  await ctx.reply(msg);
}

// ========== 手續費 ==========
async function addFee(ctx, amount, remark = "W") {
  const userId = getScopeId(ctx);
  const userName = ctx.from.username || ctx.from.first_name || '未知用戶';
  const recordId = await getNextRecordId(userId);

  const data = {
    type: 'fee',
    remark: remark,
    amount: parseFloat(amount),
    userId,
    userName,
    operatorId: ctx.from.id,
    recordId: `#${recordId}`,
    createdAt: new Date(),
    yearMonth: yearMonthTZ()
  };

  await db.collection('transactions').add(data);

  const stats = await buildRecordStats(ctx, data);

  await ctx.reply(
    `🌙 手續費記錄成功!\n\n` +
    `💰 金額: ${fmt(amount)}\n` +
    `🆔 編號: #${recordId}\n` +
    `📅 日期: ${fmtDate(data.createdAt)}\n\n` +
    stats
  );
}

// ========== 刪除 ==========
async function deleteRecord(ctx, recordId, dateStr) {
  const userId = getScopeId(ctx);

  let query = db.collection('transactions').where('userId', '==', userId);
  
  if (recordId) {
    query = query.where('recordId', '==', recordId.startsWith('#') ? recordId : `#${recordId}`);
  }
  
  const snapshot = await query.get();

  if (snapshot.empty) {
    return ctx.reply('❌ 找不到相符的紀錄');
  }

  let deleted = false;
  let deletedDoc = null;
  snapshot.forEach(doc => {
    const data = doc.data();
    const docDate = fmtDate(data.createdAt);
    
    if ((!recordId || data.recordId === recordId || data.recordId === `#${recordId}`) &&
        (!dateStr || docDate === dateStr)) {
      doc.ref.update({ deleted: true, deletedAt: new Date(), deletedBy: ctx.from.id });
      deleted = true;
      deletedDoc = data;
    }
  });

  if (deleted) {
    const typeLabel = deletedDoc.type === 'income' ? '收入' : deletedDoc.type === 'expense' ? '支出' : '手續費';
    return ctx.reply(
      `✅ 刪除成功!\n\n` +
      `類型: ${typeLabel}\n` +
      `金額: ${fmt(deletedDoc.amount)}\n` +
      `編號: ${deletedDoc.recordId || '?'}`
    );
  } else {
    return ctx.reply('❌ 找不到符合條件的紀錄，請檢查編號和日期');
  }
}

// ========== 風控設定 ==========
async function setRiskControl(ctx, rawInput) {
  const userId = getScopeId(ctx);
  const input = String(rawInput).trim();

  // --- 刪除風控 ---
  if (input === '0' || input === '刪除' || input === '删除') {
    await db.collection('settings').doc(`risk_${userId}`).delete().catch(() => {});
    return ctx.reply('🛡️ 風控已刪除');
  }

  // --- 解析輸入：金額 [日期] ---
  const parts = input.split(/\s+/);
  const amount = parseFloat(parts[0]);
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('❌ 格式錯誤\n請輸入：金額 或 金額 到期日\n例如：10000 或 10000 2026-07-01');
  }

  const data = {
    userId,
    limit: amount,
    updatedAt: new Date()
  };

  // --- 解析到期日 ---
  if (parts[1]) {
    const d = new Date(parts[1] + 'T23:59:59');
    if (isNaN(d.getTime())) {
      return ctx.reply('❌ 日期格式錯誤\n請使用 YYYY-MM-DD 格式\n例如：2026-07-01');
    }
    data.expiryDate = d;
  } else {
    // 沒有到期日則移除舊的 expiryDate
    data.expiryDate = null;
  }

  await db.collection('settings').doc(`risk_${userId}`).set(data);

  let msg = `🛡️ 風控限額已設為: ${fmt(amount)}`;
  if (data.expiryDate) {
    msg += `\n📅 到期日: ${parts[1]}`;
  }
  return ctx.reply(msg);
}

// ========== 建立月明細訊息（逐筆記錄 + 摘要）==========
async function buildMonthlyDetail(ctx) {
  const userId = getScopeId(ctx);

  try {
    const allSnapshot = await db.collection('transactions')
      .where('userId', '==', userId)
      .get();

    if (allSnapshot.empty) return `📭 尚無交易紀錄`;

    const allDocs = [];
    allSnapshot.forEach(doc => allDocs.push({ id: doc.id, ...doc.data() }));
    sortByCreatedAtAsc(allDocs);

    const activeDocs = allDocs.filter(d => !d.deleted);
    const now = new Date();
    const todayStr = fmtDate(now);
    const currentYearMonth = yearMonthTZ();

    // 本日
    const todayDocs = activeDocs.filter(d => fmtDate(d.createdAt) === todayStr);
    const dayIncome = todayDocs.filter(d => d.type === 'income').reduce((s, d) => s + d.amount, 0);
    const dayExpense = todayDocs.filter(d => d.type === 'expense').reduce((s, d) => s + d.amount, 0);
    const dayInCount = todayDocs.filter(d => d.type === 'income').length;
    const dayOutCount = todayDocs.filter(d => d.type === 'expense').length;

    // 本月
    const monthDocs = activeDocs.filter(d => d.yearMonth === currentYearMonth);
    const monthIncome = monthDocs.filter(d => d.type === 'income').reduce((s, d) => s + d.amount, 0);
    const monthExpense = monthDocs.filter(d => d.type === 'expense').reduce((s, d) => s + d.amount, 0);
    const monthFee = monthDocs.filter(d => d.type === 'fee').reduce((s, d) => s + d.amount, 0);
    const monthInCount = monthDocs.filter(d => d.type === 'income').length;
    const monthOutCount = monthDocs.filter(d => d.type === 'expense').length;
    const monthNet = monthIncome - monthExpense;

    // 風控
    const riskDoc = await db.collection('settings').doc(`risk_${userId}`).get();
    let riskLimit = 0, riskExpiry = '';
    if (riskDoc.exists) {
      riskLimit = riskDoc.data().limit || 0;
      if (riskDoc.data().expiryDate) {
        const d = riskDoc.data().expiryDate.toDate ? riskDoc.data().expiryDate.toDate() : new Date(riskDoc.data().expiryDate);
        riskExpiry = fmtDate(d);
      }
    }

    // 前期結餘
    let carryover = 0;
    try {
      const carryDoc = await db.collection('settings').doc(`carryover_${userId}`).get();
      if (carryDoc.exists) carryover = carryDoc.data().amount || 0;
    } catch (e) { console.error('讀取前期結餘失敗:', e); }

    const grandTotal = monthNet - monthFee + carryover;

    // 逐筆記錄
    const recordLines = [];
    for (const d of monthDocs) {
      const sign = d.type === 'income' ? '+' : (d.type === 'expense' ? '-' : '🌙');
      const rid = d.recordId ? d.recordId.replace('#', '') : '?';
      recordLines.push(`(${rid}) ${fmtDate(d.createdAt)} ${fmtTime(d.createdAt)} ${sign}${fmt(d.amount)} [${d.remark || 'W'}]`);
    }

    const lines = [
      `🗓 ${currentYearMonth} 本月記錄`,
      ...recordLines,
      ``,
      `------------------------------`,
      `📊 本日: 入${dayInCount}筆 ${fmt(dayIncome)} / 出${dayOutCount}筆 ${fmt(dayExpense)}`,
      `📊 本月: 入${monthInCount}筆 ${fmt(monthIncome)} / 出${monthOutCount}筆 ${fmt(monthExpense)}`,
      `🌙 手續費: ${fmt(monthFee)}`,
      `🛡️ 風控: ${fmt(riskLimit)}${riskExpiry ? ' (到期:' + riskExpiry + ')' : ''}`,
      `💰 前期結餘: ${fmt(carryover)}`,
      `🔢 總計: ${fmt(grandTotal)} (月計-月計手續費+前期結餘)`
    ];

    return lines.join('\n');
  } catch (error) {
    console.error('明細錯誤:', error);
    return `❌ 讀取資料時發生錯誤: ${error.message}`;
  }
}

// ========== 建立狀態訊息（核心顯示邏輯）==========
async function buildStatusMessage(ctx) {
  const userId = getScopeId(ctx);
  const userName = ctx.from.first_name || ctx.from.username || '用戶';
  console.log(`[DEBUG buildStatusMessage] userId=${userId}, userName=${userName}, from=`, JSON.stringify(ctx.from));

  try {
    // 取得所有交易紀錄（不分頁，全量載入）
    const allSnapshot = await db.collection('transactions')
      .where('userId', '==', userId)
      .get();

    if (allSnapshot.empty) {
      return `📭 尚無交易紀錄`;
    }

    // 全部轉為陣列並按時間升序排列
    const allDocs = [];
    allSnapshot.forEach(doc => allDocs.push({ id: doc.id, ...doc.data() }));
    sortByCreatedAtAsc(allDocs);

    // 過濾已刪除的紀錄
    const activeDocs = allDocs.filter(d => !d.deleted);

    const now = new Date();
    const todayStr = fmtDate(now);
    const currentYearMonth = yearMonthTZ();
    // --- 取得最新一筆 ---
    const latest = activeDocs[activeDocs.length - 1];
    const latestSign = latest.type === 'income' ? '+' : (latest.type === 'expense' ? '-' : '');
    const latestTime = fmtTime(latest.createdAt);
    const latestRecordId = latest.recordId ? latest.recordId.replace('#', '') : '?';

    // --- 本日統計 ---
    const todayDocs = activeDocs.filter(d => fmtDate(d.createdAt) === todayStr);
    const dayIncome = todayDocs.filter(d => d.type === 'income').reduce((s, d) => s + d.amount, 0);
    const dayExpense = todayDocs.filter(d => d.type === 'expense').reduce((s, d) => s + d.amount, 0);
    const dayFee = todayDocs.filter(d => d.type === 'fee').reduce((s, d) => s + d.amount, 0);
    const dayInCount = todayDocs.filter(d => d.type === 'income').length;
    const dayOutCount = todayDocs.filter(d => d.type === 'expense').length;

    // --- 本月統計 ---
    const monthDocs = activeDocs.filter(d => d.yearMonth === currentYearMonth);
    const monthIncome = monthDocs.filter(d => d.type === 'income').reduce((s, d) => s + d.amount, 0);
    const monthExpense = monthDocs.filter(d => d.type === 'expense').reduce((s, d) => s + d.amount, 0);
    const monthFee = monthDocs.filter(d => d.type === 'fee').reduce((s, d) => s + d.amount, 0);
    const monthInCount = monthDocs.filter(d => d.type === 'income').length;
    const monthOutCount = monthDocs.filter(d => d.type === 'expense').length;
    const monthNet = monthIncome - monthExpense;

    // --- 風控 ---
    const riskDoc = await db.collection('settings').doc(`risk_${userId}`).get();
    let riskLimit = 0;
    let riskExpiry = '';
    if (riskDoc.exists) {
      const riskData = riskDoc.data();
      riskLimit = riskData.limit || 0;
      if (riskData.expiryDate) {
        const d = riskData.expiryDate.toDate ? riskData.expiryDate.toDate() : new Date(riskData.expiryDate);
        riskExpiry = fmtDate(d);
      }
    }

    // --- 前期結餘 = 從 settings 讀取（結算後寫入的值）---
    let carryover = 0;
    try {
      const carryDoc = await db.collection('settings').doc(`carryover_${userId}`).get();
      if (carryDoc.exists) {
        carryover = carryDoc.data().amount || 0;
      }
    } catch (e) {
      console.error('讀取前期結餘失敗:', e);
    }

    // --- 總計 ---
    const grandTotal = monthNet - monthFee + carryover;

    // --- 組裝訊息（僅顯示摘要，不含逐筆記錄）---
    const lines = [
      `🗓 ${currentYearMonth} 本月統計`,
      ``,
      `📊 本日: 入${dayInCount}筆 ${fmt(dayIncome)} / 出${dayOutCount}筆 ${fmt(dayExpense)}`,
      `📊 本月: 入${monthInCount}筆 ${fmt(monthIncome)} / 出${monthOutCount}筆 ${fmt(monthExpense)}`,
      `🌙 手續費: ${fmt(monthFee)}`,
      `🛡️ 風控: ${fmt(riskLimit)}${riskExpiry ? ' (到期:' + riskExpiry + ')' : ''}`,
      `💰 前期結餘: ${fmt(carryover)}`,
      `🔢 總計: ${fmt(grandTotal)} (月計-月計手續費+前期結餘)`
    ];

    console.log(`[DEBUG buildStatusMessage] result preview: "${lines.join('\n').substring(0, 100)}"`);
    return lines.join('\n');

  } catch (error) {
    console.error('顯示狀態錯誤:', error);
    return `❌ 讀取資料時發生錯誤: ${error.message}`;
  }
}

// ========== 單筆記錄後統計摘要 ==========
async function buildRecordStats(ctx, currentRecord) {
  const userId = getScopeId(ctx);

  try {
    const allSnapshot = await db.collection('transactions')
      .where('userId', '==', userId)
      .get();

    if (allSnapshot.empty) return '';

    const allDocs = [];
    allSnapshot.forEach(doc => allDocs.push({ id: doc.id, ...doc.data() }));
    sortByCreatedAtAsc(allDocs);
    const activeDocs = allDocs.filter(d => !d.deleted);

    const now = new Date();
    const todayStr = fmtDate(now);
    const currentYearMonth = yearMonthTZ();

    // --- 當前記錄行 ---
    const sign = currentRecord.type === 'income' ? '+' : (currentRecord.type === 'expense' ? '-' : '🌙-');
    const rid = (currentRecord.recordId || '?').replace('#', '');
    const recordDate = fmtDate(currentRecord.createdAt);
    const recordTime = fmtTime(currentRecord.createdAt);
    const recordRemark = currentRecord.remark || 'W';

    // --- 本日統計 ---
    const todayDocs = activeDocs.filter(d => fmtDate(d.createdAt) === todayStr);
    const dayIncome = todayDocs.filter(d => d.type === 'income').reduce((s, d) => s + d.amount, 0);
    const dayExpense = todayDocs.filter(d => d.type === 'expense').reduce((s, d) => s + d.amount, 0);
    const dayInCount = todayDocs.filter(d => d.type === 'income').length;
    const dayOutCount = todayDocs.filter(d => d.type === 'expense').length;

    // --- 本月統計 ---
    const monthDocs = activeDocs.filter(d => d.yearMonth === currentYearMonth);
    const monthIncome = monthDocs.filter(d => d.type === 'income').reduce((s, d) => s + d.amount, 0);
    const monthExpense = monthDocs.filter(d => d.type === 'expense').reduce((s, d) => s + d.amount, 0);
    const monthFee = monthDocs.filter(d => d.type === 'fee').reduce((s, d) => s + d.amount, 0);
    const monthInCount = monthDocs.filter(d => d.type === 'income').length;
    const monthOutCount = monthDocs.filter(d => d.type === 'expense').length;
    const monthNet = monthIncome - monthExpense;

    // --- 風控 ---
    const riskDoc = await db.collection('settings').doc(`risk_${userId}`).get();
    let riskLimit = 0;
    let riskExpiry = '';
    if (riskDoc.exists) {
      const riskData = riskDoc.data();
      riskLimit = riskData.limit || 0;
      if (riskData.expiryDate) {
        const d = riskData.expiryDate.toDate ? riskData.expiryDate.toDate() : new Date(riskData.expiryDate);
        riskExpiry = fmtDate(d);
      }
    }

    // --- 前期結餘 ---
    let carryover = 0;
    const carryDoc = await db.collection('settings').doc(`carryover_${userId}`).get();
    if (carryDoc.exists) carryover = carryDoc.data().amount || 0;

    // --- 總計 ---
    const grandTotal = monthNet - monthFee + carryover;

    const lines = [
      `(${rid}) ${recordDate} ${recordTime} ${sign}${fmt(currentRecord.amount)} [${recordRemark}]`,
      ``,
      `------------------------------`,
      `本日:`,
      `入${dayInCount}筆:${fmt(dayIncome)},出${dayOutCount}筆:${fmt(dayExpense)}`,
      `本月:`,
      `入${monthInCount}筆:${fmt(monthIncome)},出${monthOutCount}筆:${fmt(monthExpense)}`,
      `手續費月計:${fmt(monthFee)}`,
      `風控:${fmt(riskLimit)}${riskExpiry ? ' (到期:' + riskExpiry + ')' : ''}`,
      `前期結餘:${fmt(carryover)}`,
      `總計:${fmt(grandTotal)}`,
      `(月計-月計手續費+前期結餘)`
    ];

    return lines.join('\n');
  } catch (error) {
    console.error('buildStatusMessage 錯誤:', error);
    return '';
  }
}

// ========== /顯示 指令 ==========
async function showStatus(ctx) {
  const msg = await buildStatusMessage(ctx);
  await ctx.reply(msg);
}

// ========== 本月明細（含逐筆記錄 + 摘要）==========
async function showMonthlyDetail(ctx) {
  const msg = await buildMonthlyDetail(ctx);
  await ctx.reply(msg);
}

// ========== 查詢歷史 ==========
async function getHistory(ctx) {
  const userId = getScopeId(ctx);

  try {
    const snapshot = await db.collection('transactions')
      .where('userId', '==', userId)
      .get();

    if (snapshot.empty) {
      return ctx.reply('📝 尚無交易記錄');
    }

    // 內存排序：按 createdAt 降序
    const docs = [];
    snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
    sortByCreatedAtDesc(docs);
    const docsToShow = docs.slice(0, 10);

    let message = `📋 最近 10 筆交易記錄\n\n`;
    let count = 1;

    for (const data of docsToShow) {
      const typeIcon = data.type === 'income' ? '📈' : data.type === 'expense' ? '📉' : '🌙';
      const typeName = data.type === 'income' ? '收入' : data.type === 'expense' ? '支出' : '手續費';
      message += `${count}. ${typeIcon} [${typeName}] ${fmt(data.amount)} - ${data.recordId || '?'}\n`;
      count++;
    }

    await ctx.reply(message);
  } catch (error) {
    console.error('查詢歷史錯誤:', error);
    await ctx.reply('❌ 查詢失敗: ' + error.message);
  }
}

// ========== 月度流量 ==========
async function showMonthlyFlow(ctx, yearMonth) {
  const userId = getScopeId(ctx);

  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    const now = new Date();
    yearMonth = yearMonthTZ();
  }

  try {
    const snapshot = await db.collection('transactions')
      .where('userId', '==', userId)
      .where('yearMonth', '==', yearMonth)
      .get();

    if (snapshot.empty) {
      return ctx.reply(`📅 ${yearMonth} 暫無交易記錄`);
    }

    const docs = [];
    snapshot.forEach(doc => docs.push(doc.data()));
    const activeDocs = docs.filter(d => !d.deleted);

    const totalIncome = activeDocs.filter(d => d.type === 'income').reduce((sum, d) => sum + d.amount, 0);
    const totalExpense = activeDocs.filter(d => d.type === 'expense').reduce((sum, d) => sum + d.amount, 0);
    const totalFee = activeDocs.filter(d => d.type === 'fee').reduce((sum, d) => sum + d.amount, 0);
    const netAmount = totalIncome - totalExpense;

    let message = `📊 ${yearMonth} 月度流量報告\n\n`;
    message += `💰 入帳總額: ${fmt(totalIncome)}\n`;
    message += `💸 支出總額: ${fmt(totalExpense)}\n`;
    message += `🌙 手續費合計: ${fmt(totalFee)}\n`;
    message += `📈 淨值: ${fmt(netAmount)}\n`;
    message += `📝 共 ${docs.length} 筆記錄`;

    await ctx.reply(message);
  } catch (error) {
    console.error('流量查詢錯誤:', error);
    await ctx.reply('❌ 流量查詢失敗: ' + error.message);
  }
}

// ========== 列出月份紀錄 ==========
async function listMonthlyRecords(ctx, yearMonth) {
  const userId = getScopeId(ctx);

  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    const now = new Date();
    yearMonth = yearMonthTZ();
  }

  try {
    const snapshot = await db.collection('transactions')
      .where('userId', '==', userId)
      .where('yearMonth', '==', yearMonth)
      .get();

    if (snapshot.empty) {
      return ctx.reply(`📅 ${yearMonth} 暫無交易記錄`);
    }

    const docs = [];
    snapshot.forEach(doc => docs.push(doc.data()));
    sortByCreatedAtAsc(docs);

    let message = `📋 ${yearMonth} 交易列表\n\n`;
    let count = 1;

    for (const data of docs) {
      const icon = data.type === 'income' ? '📈' : data.type === 'expense' ? '📉' : '🌙';
      const typeName = data.type === 'income' ? '收入' : data.type === 'expense' ? '支出' : '手續費';
      const time = fmtTime(data.createdAt);
      
      message += `${count}. ${icon} ${typeName} | ${fmt(data.amount)} | ${data.recordId || '?'} | ${time}\n`;
      count++;
    }

    message += `\n共 ${docs.length} 筆記錄`;

    await ctx.reply(message);
  } catch (error) {
    console.error('列表錯誤:', error);
    await ctx.reply('❌ 列表讀取失敗: ' + error.message);
  }
}

// ========== 匯出月份數據（Excel）=========
async function exportMonthlyData(ctx, yearMonth) {
  const userId = getScopeId(ctx);

  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    const now = new Date();
    yearMonth = yearMonthTZ();
  }

  try {
    const snapshot = await db.collection('transactions')
      .where('userId', '==', userId)
      .where('yearMonth', '==', yearMonth)
      .get();

    if (snapshot.empty) {
      return ctx.reply(`📅 ${yearMonth} 暫無資料可匯出`);
    }

    const docs = [];
    snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
    sortByCreatedAtAsc(docs);

    // --- 準備 Excel 數據 ---
    const wsData = [];
    
    // 標題列
    wsData.push(['編號', '類型', '金額', '日期', '時間', '備註']);

    // 資料列
    const activeDocsForStats = docs.filter(d => !d.deleted);
    for (const data of docs) {
      const typeName = data.deleted ? '已刪除' : (data.type === 'income' ? '收入' : data.type === 'expense' ? '支出' : '手續費');
      wsData.push([
        data.recordId || '?',
        typeName,
        data.amount,
        fmtDate(data.createdAt),
        fmtTime(data.createdAt),
        data.remark || 'W'
      ]);
    }

    // 統計列
    const totalIncome = activeDocsForStats.filter(d => d.type === 'income').reduce((sum, d) => sum + d.amount, 0);
    const totalExpense = activeDocsForStats.filter(d => d.type === 'expense').reduce((sum, d) => sum + d.amount, 0);
    const totalFee = activeDocsForStats.filter(d => d.type === 'fee').reduce((sum, d) => sum + d.amount, 0);

    wsData.push([]);
    wsData.push(['統計', '', '', '', '']);
    wsData.push(['入帳筆數', activeDocsForStats.filter(d => d.type === 'income').length, '入帳總計', totalIncome]);
    wsData.push(['支出筆數', activeDocsForStats.filter(d => d.type === 'expense').length, '支出總計', totalExpense]);
    wsData.push(['手續費總計', totalFee, '', '']);
    wsData.push(['已刪除筆數', docs.filter(d => d.deleted).length, '', '']);

    // 風控
    const riskDoc = await db.collection('settings').doc(`risk_${userId}`).get();
    const riskLimit = riskDoc.exists ? riskDoc.data().limit : 0;
    wsData.push(['風控限額', riskLimit, '', '']);

    // 前期結餘
    let carryover = 0;
    const carryDoc = await db.collection('settings').doc(`carryover_${userId}`).get();
    if (carryDoc.exists) carryover = carryDoc.data().amount || 0;
    wsData.push(['前期結餘', carryover, '', '']);

    // 總計
    const grandTotal = totalIncome - totalExpense - totalFee + carryover;
    wsData.push(['總計', grandTotal, '', '']);
    wsData.push(['公式', '月計-月計手續費+前期結餘', '', '']);

    // --- 生成 Excel ---
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // 設定欄寬
    ws['!cols'] = [
      { wch: 10 },
      { wch: 10 },
      { wch: 15 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, '出入帳明細');

    // 寫入 Buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    await ctx.replyWithDocument(
      { source: buf, filename: `出入帳_${yearMonth}.xlsx` },
      { caption: `📤 ${yearMonth} 資料已匯出（共 ${docs.length} 筆）` }
    );
  } catch (error) {
    console.error('匯出錯誤:', error);
    await ctx.reply('❌ 匯出失敗: ' + error.message);
  }
}

// ========== 結算預覽 ==========
async function previewSettlement(ctx, yearMonth) {
  const userId = getScopeId(ctx);

  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    const now = new Date();
    yearMonth = yearMonthTZ();
  }

  try {
    const snapshot = await db.collection('transactions')
      .where('userId', '==', userId)
      .where('yearMonth', '==', yearMonth)
      .get();

    if (snapshot.empty) {
      return ctx.reply(`📅 ${yearMonth} 暫無交易記錄，無法結算`);
    }

    const docs = [];
    snapshot.forEach(doc => docs.push(doc.data()));
    const activeDocs = docs.filter(d => !d.deleted);

    const totalIncome = activeDocs.filter(d => d.type === 'income').reduce((sum, d) => sum + d.amount, 0);
    const totalExpense = activeDocs.filter(d => d.type === 'expense').reduce((sum, d) => sum + d.amount, 0);
    const totalFee = activeDocs.filter(d => d.type === 'fee').reduce((sum, d) => sum + d.amount, 0);

    // 前期結餘
    let carryover = 0;
    try {
      const carryDoc = await db.collection('settings').doc(`carryover_${userId}`).get();
      if (carryDoc.exists) carryover = carryDoc.data().amount || 0;
    } catch (e) {}

    const netAmount = totalIncome - totalExpense - totalFee + carryover;

    let message = `📋 ${yearMonth} 結算預覽\n\n`;
    message += `📥 入帳總計: ${fmt(totalIncome)}\n`;
    message += `📤 支出總計: ${fmt(totalExpense)}\n`;
    message += `🧧 手續費總計: ${fmt(totalFee)}\n`;
    message += `💰 結轉餘額: ${fmt(totalIncome - totalExpense)}\n`;
    message += `💰 最終結轉餘額: ${fmt(netAmount)}\n`;
    message += `📊 共 ${docs.length} 筆記錄\n\n`;
    message += `⚠️ 使用 /結算計入 ${yearMonth} 確認寫入`;

    await ctx.reply(message);
  } catch (error) {
    console.error('結算預覽錯誤:', error);
    await ctx.reply('❌ 預覽失敗: ' + error.message);
  }
}

// ========== 確認結算 ==========
async function confirmSettlement(ctx, yearMonth) {
  const userId = getScopeId(ctx);

  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return ctx.reply('❌ 請提供正確的年月格式，例如: /結算計入 2026-01');
  }

  try {
    const snapshot = await db.collection('transactions')
      .where('userId', '==', userId)
      .where('yearMonth', '==', yearMonth)
      .get();

    if (snapshot.empty) {
      return ctx.reply(`📅 ${yearMonth} 暫無交易記錄，無法結算`);
    }

    const docs = [];
    snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
    const activeDocs = docs.filter(d => !d.deleted);

    const totalIncome = activeDocs.filter(d => d.type === 'income').reduce((sum, d) => sum + d.amount, 0);
    const totalExpense = activeDocs.filter(d => d.type === 'expense').reduce((sum, d) => sum + d.amount, 0);
    const totalFee = activeDocs.filter(d => d.type === 'fee').reduce((sum, d) => sum + d.amount, 0);
    const netAmount = totalIncome - totalExpense - totalFee;

    // 寫入結算記錄
    await db.collection('settlements').add({
      userId,
      yearMonth,
      totalIncome,
      totalExpense,
      totalFee,
      netAmount,
      recordCount: docs.length,
      settledAt: new Date()
    });

    // 將結算淨額存為前期結餘（供下個月狀態顯示使用）
    await db.collection('settings').doc(`carryover_${userId}`).set({
      userId,
      amount: netAmount,
      fromYearMonth: yearMonth,
      updatedAt: new Date()
    });

    let message = `✅ ${yearMonth} 結算成功並已存入資料庫\n`;
    message += `----------------------------\n`;
    message += `📥 入帳總計: ${fmt(totalIncome)}\n`;
    message += `📤 支出總計: ${fmt(totalExpense)}\n`;
    message += `🧧 手續費總計: ${fmt(totalFee)}\n`;
    message += `💰 最終結轉餘額: ${fmt(netAmount)}\n`;
    message += `📊 處理單據: ${docs.length} 筆`;

    await ctx.reply(message);
  } catch (error) {
    console.error('結算確認錯誤:', error);
    await ctx.reply('❌ 結算失敗: ' + error.message);
  }
}

// ========== 列出本月全部紀錄（供刪除用）==========
async function listCurrentMonthForDelete(ctx) {
  const userId = getScopeId(ctx);
  const now = new Date();
  const yearMonth = yearMonthTZ();

  try {
    const snapshot = await db.collection('transactions')
      .where('userId', '==', userId)
      .where('yearMonth', '==', yearMonth)
      .get();

    if (snapshot.empty) {
      return ctx.reply(`📅 ${yearMonth} 暫無交易記錄`);
    }

    const items = [];
    snapshot.forEach(doc => items.push({ data: doc.data(), docId: doc.id }));
    items.sort((a, b) => {
      const aTime = a.data.createdAt && a.data.createdAt.toDate ? a.data.createdAt.toDate() : new Date(a.data.createdAt || 0);
      const bTime = b.data.createdAt && b.data.createdAt.toDate ? b.data.createdAt.toDate() : new Date(b.data.createdAt || 0);
      return aTime - bTime;
    });

    let message = `🗑️ ${yearMonth} 本月全部記錄\n\n`;
    message += `編號  日期      時間    類型    金額\n`;
    message += `--------------------------------\n`;

    for (const item of items) {
      const data = item.data;
      const icon = data.type === 'income' ? '📈' : data.type === 'expense' ? '📉' : '🌙';
      const typeName = data.type === 'income' ? '入帳' : data.type === 'expense' ? '支出' : '手續';
      const date = fmtDate(data.createdAt);
      const time = fmtTime(data.createdAt);
      const rid = (data.recordId || '?').padEnd(5);

      message += `${rid} ${date} ${time}  ${icon}${typeName} ${fmt(data.amount)}\n`;
    }

    message += `\n共 ${items.length} 筆記錄`;
    message += `\n👇 點選下方按鈕直接刪除：`;

    // 建立內聯鍵盤 — 每行 3 個按鈕
    const inlineRows = [];
    let row = [];
    for (const item of items) {
      const data = item.data;
      const btnLabel = `🗑️ ${data.recordId || '?'} ${fmt(data.amount)}`;
      row.push(Markup.button.callback(btnLabel, `d_${item.docId}`));
      if (row.length === 3) {
        inlineRows.push(row);
        row = [];
      }
    }
    if (row.length > 0) inlineRows.push(row);

    // 取消按鈕
    inlineRows.push([Markup.button.callback('❌ 取消', 'cancel_delete')]);

    await ctx.reply(message, Markup.inlineKeyboard(inlineRows));
  } catch (error) {
    console.error('列出本月記錄錯誤:', error);
    await ctx.reply('❌ 讀取失敗: ' + error.message);
  }
}

// ========== 透過 Firestore docId 直接刪除 ==========
async function deleteByDocId(ctx, docId) {
  try {
    const docRef = db.collection('transactions').doc(docId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return ctx.reply('❌ 找不到該記錄，可能已被刪除');
    }
    const data = doc.data();
    const typeLabel = data.type === 'income' ? '收入' : data.type === 'expense' ? '支出' : '手續費';
    await docRef.update({ deleted: true, deletedAt: new Date(), deletedBy: ctx.from.id });
    await ctx.reply(
      `✅ 已刪除\n\n` +
      `類型: ${typeLabel}\n` +
      `金額: ${fmt(data.amount)}\n` +
      `編號: ${data.recordId || '?'}`
    );
  } catch (error) {
    console.error('回調刪除錯誤:', error);
    await ctx.reply('❌ 刪除失敗: ' + error.message);
  }
}

module.exports = {
  addIncome,
  addExpense,
  addFee,
  deleteRecord,
  deleteByDocId,
  setRiskControl,
  showStatus,
  showMonthlyDetail,
  getHistory,
  showMonthlyFlow,
  listMonthlyRecords,
  exportMonthlyData,
  previewSettlement,
  confirmSettlement,
  buildStatusMessage,
  listCurrentMonthForDelete
};
