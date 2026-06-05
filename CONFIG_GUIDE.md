# 配置指南 - Telegram Bot 出入帳機器人

## 步驟 1: 創建 Telegram Bot

1. 在 Telegram 中搜索 `@BotFather`
2. 發送 `/start` 開始
3. 發送 `/newbot` 創建新機器人
4. 按照提示設置：
   - 機器人名稱（顯示名稱，例如：出入帳機器人）
   - 用戶名（必須以 `bot` 結尾，例如：@JOHNNY1688_BOT）
5. 完成後，BotFather 會提供一個 **Bot Token**，類似：
   ```
   1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   ```
6. **重要**：保存此 Token，稍後需要填入 `.env` 文件

## 步驟 2: 設置 Firebase

### 2.1 創建 Firebase 項目
1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 點擊「新增項目」
3. 輸入項目名稱（例如：telegram-bot-transactions）
4. 完成創建

### 2.2 啟用 Firestore 數據庫
1. 在左側菜單點擊「Firestore Database」
2. 點擊「建立數據庫」
3. 選擇「測試模式」（開發階段）
4. 選擇數據庫位置（例如：asia-east1 台灣）

### 2.3 生成服務帳戶密鑰
1. 點擊右上角「設置」圖標 ⚙️
2. 選擇「服務帳戶」
3. 點擊「生成新的私鑰」
4. 下載 JSON 文件
5. 將文件重命名為 `service-account-key.json`
6. 放入項目根目錄（`telegram-bot/`）

### 2.4 獲取 Firebase 配置
在「設置」>「一般設定」中，找到：
- 項目 ID (Project ID)

在「設置」>「服務帳戶」中，找到：
- 數據庫 URL (Database URL)，格式類似：
  ```
  https://your-project-id.firebaseio.com
  ```

## 步驟 3: 配置環境變量

1. 複製 `.env.example` 為 `.env`：
   ```bash
   cp .env.example .env
   ```

2. 編輯 `.env` 文件，填入你的配置：
   ```env
   # 從 BotFather 獲取的 Token
   BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   
   # 從 Firebase 獲取的配置
   FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
   FIREBASE_PROJECT_ID=your-project-id
   
   # 環境設置
   NODE_ENV=development
   LOG_LEVEL=info
   ```

## 步驟 4: 安裝依賴

```bash
cd telegram-bot
npm install
```

## 步驟 5: 啟動機器人

### Windows:
```bash
setup.bat
```
或直接：
```bash
node src/index.js
```

### Linux/Mac:
```bash
./setup.sh
```
或直接：
```bash
node src/index.js
```

## 步驟 6: 測試機器人

1. 在 Telegram 中搜索你的機器人用戶名（例如：@JOHNNY1688_BOT）
2. 發送 `/start` 開始使用
3. 測試命令：
   - `/income 1000 月薪` - 記錄收入
   - `/expense 50 午餐` - 記錄支出
   - `/balance` - 查詢餘額
   - `/history` - 查詢歷史

## 常見問題

### Q1: 機器人沒有回應？
- 檢查 `BOT_TOKEN` 是否正確
- 檢查機器人是否已啟動（終端機應顯示「Telegram bot 已啟動...」）
- 檢查防火牆是否阻擋連線

### Q2: Firebase 連線失敗？
- 檢查 `service-account-key.json` 是否存在且格式正確
- 檢查 `.env` 中的 Firebase 配置是否正確
- 檢查 Firebase 項目是否已啟用 Firestore

### Q3: 如何讓機器人持續運行？
建議使用 PM2 進程管理工具：
```bash
npm install -g pm2
pm2 start src/index.js --name telegram-bot
pm2 save
pm2 startup
```

## 安全提醒

⚠️ **重要**：
- 不要將 `.env` 和 `service-account-key.json` 提交到 Git
- 這些文件已加入 `.gitignore`
- 如果 Token 或密鑰洩露，請立即重新生成

## 下一步

- 自定義機器人命令和回應
- 添加更多功能（例如：分類統計、圖表生成）
- 部署到雲端伺服器（例如：Heroku, DigitalOcean）
