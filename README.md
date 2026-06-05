# Telegram 出入帳機器人

一個用於記錄個人收入和支出的 Telegram bot，支持用戶名讀取和 Firebase 數據存儲。

## 功能特點

- 📈 記錄收入：`/income [金額] [備註]`
- 📉 記錄支出：`/expense [金額] [備註]`
- 📊 查詢餘額：`/balance`
- 📋 查詢歷史：`/history`
- 👤 自動讀取用戶名並保存至 Firebase

## 安裝步驟

### 1. 創建 Telegram Bot

1. 在 Telegram 中搜索 `@BotFather`
2. 發送 `/newbot` 創建新機器人
3. 按照提示設置名稱和用戶名
4. 獲取 Bot Token

### 2. 設置 Firebase

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 創建新項目
3. 啟用 Firestore 數據庫
4. 生成服務帳戶密鑰文件（Project Settings > Service Accounts）
5. 將密鑰文件保存為 `service-account-key.json` 並放在項目根目錄

### 3. 配置環境變量

```bash
cp .env.example .env
```

編輯 `.env` 文件，填入你的配置：

```
BOT_TOKEN=你的_bot_token
FIREBASE_DATABASE_URL=https://你的項目.firebaseio.com
FIREBASE_PROJECT_ID=你的項目_id
```

### 4. 安裝依賴

```bash
npm install
```

### 5. 啟動機器人

```bash
# 生產模式
npm start

# 開發模式（需要安裝 nodemon）
npm install -g nodemon
npm run dev
```

## 使用方法

1. 在 Telegram 中搜索你的 bot 用戶名
2. 發送 `/start` 開始使用
3. 使用命令記錄交易：
   - `/income 1000 月薪` - 記錄 1000 收入，備註"月薪"
   - `/expense 50 午餐` - 記錄 50 支出，備註"午餐"
4. 查詢餘額：`/balance`
5. 查詢歷史：`/history`

## 數據結構

### Firestore 集合

**users** - 用戶信息
- userId: Telegram 用戶 ID
- username: Telegram 用戶名
- firstName: 名字
- lastName: 姓氏
- createdAt: 創建時間

**transactions** - 交易記錄
- userId: 用戶 ID
- type: "income" 或 "expense"
- amount: 金額
- note: 備註
- createdAt: 創建時間
- username: 用戶名
- firstName: 名字

## 技術棧

- Node.js
- Telegraf (Telegram Bot Framework)
- Firebase Admin SDK
- Firestore (NoSQL 數據庫)

## 注意事項

- 請妥善保管 `service-account-key.json` 和 `.env` 文件，不要提交到 Git
- 建議使用 PM2 或其他進程管理工具保持 bot 持續運行
- 首次使用需要在 Firebase Console 中設置 Firestore 安全規則

## 授權

ISC
