# Firebase 新连接设置指南

本指南将指导您为 Telegram 出入帐机器人创建一个全新的 Firebase 连接。

## 前置条件
- 已有一个 Google 账号（Gmail 账号）
- 已安装 Node.js 环境（项目已配置）

## 步骤 1：创建新的 Firebase 项目

### 1.1 访问 Firebase 控制台
1. 打开浏览器，访问 [Firebase Console](https://console.firebase.google.com/)
2. 使用您的 Google 账号登录

### 1.2 创建新项目
1. 点击「创建项目」或「新增项目」
2. 输入项目名称（例如：`telegram-bot-new`）
   - 建议使用有意义的名称，便于识别
   - 项目 ID 会自动生成，也可以自定义
3. 点击「继续」
4. **可选**：启用 Google Analytics（建议禁用以简化设置）
5. 点击「创建项目」
6. 等待项目创建完成（约 30 秒）

## 步骤 2：启用 Firestore 数据库

### 2.1 创建 Firestore 数据库
1. 在项目概览页面，点击左侧菜单的「Firestore Database」
2. 点击「建立数据库」
3. 选择「以测试模式开始」
   - 注意：测试模式允许所有读写，适合开发阶段
   - 生产环境请设置安全规则
4. 选择数据库位置：
   - 推荐选择 `asia-east1`（台湾）或 `asia-southeast1`（新加坡）
   - 选择后点击「启用」

### 2.2 验证数据库创建
1. 等待数据库初始化完成
2. 您将看到空的 Firestore 数据库界面

## 步骤 3：获取 Firebase 配置信息

### 3.1 获取项目 ID
1. 点击左侧菜单的「项目设置」（齿轮图标 ⚙️）
2. 在「一般」标签页中，找到「项目 ID」
3. 复制此项目 ID（例如：`telegram-bot-new-12345`）

### 3.2 获取数据库 URL
1. 在 Firestore 数据库页面，查看 URL 地址栏
2. 数据库 URL 格式为：`https://[项目ID].firebaseio.com`
3. 或者使用：`https://[项目ID].firebaseio.com`

## 步骤 4：生成服务账户密钥（推荐）

### 4.1 创建服务账户密钥
1. 在「项目设置」页面，切换到「服务账户」标签页
2. 在「Firebase Admin SDK」部分，点击「生成新的私钥」
3. 确认弹窗中点击「生成密钥」
4. 浏览器将自动下载一个 JSON 文件

### 4.2 保存密钥文件
1. 将下载的 JSON 文件重命名为 `service-account-key-new.json`
   - 注意：保留原有文件作为备份
2. 将文件放入项目目录的 `config/` 文件夹中：
   ```
   C:\Users\t2903\WorkBuddy\2026-06-04-15-29-30\telegram-bot\config\
   ```

## 步骤 5：更新机器人配置

### 5.1 更新环境变量
1. 打开项目根目录的 `.env` 文件
2. 更新以下 Firebase 相关变量：
   ```env
   # 现有配置（不要删除，先注释或修改）
   FIREBASE_PROJECT_ID=telegram-bot-new-12345
   FIREBASE_DATABASE_URL=https://telegram-bot-new-12345.firebaseio.com
   ```
3. 保存文件

### 5.2 使用新服务账户密钥
**选项 A：替换现有密钥文件**
1. 备份现有的 `config/service-account-key.json`（如有）
2. 将新的 `service-account-key-new.json` 重命名为 `service-account-key.json`
3. 确保文件路径为：`config/service-account-key.json`

**选项 B：修改代码使用新文件**
1. 修改 `src/firebase.js` 第 5 行：
   ```javascript
   serviceAccount = require('../config/service-account-key-new.json');
   ```

## 步骤 6：测试新连接

### 6.1 重启机器人
```bash
# 停止当前机器人（如果正在运行）
stop_bot.bat

# 启动机器人
start_bot.bat
```

### 6.2 验证连接
1. 查看日志文件 `bot.log` 或 `test.log`
2. 寻找以下成功消息：
   ```
   ✅ Telegram bot 已启动...
   📛 Bot 用户名: @JOHNNY1688_BOT
   ```
3. 如果没有错误，表示 Firebase 连接成功

### 6.3 测试数据存储
1. 在 Telegram 中向机器人发送 `/start`
2. 发送 `/+ 1000 测试收入`
3. 检查 Firestore 数据库：
   - 打开 Firebase 控制台
   - 进入 Firestore 数据库
   - 查看 `users` 和 `transactions` 集合是否有新数据

## 步骤 7：验证数据持久性

### 7.1 检查用户数据
1. 在 Firestore 中，查看 `users` 集合
2. 应该能看到您的用户文档，包含：
   - `userId`: 您的 Telegram 用户 ID
   - `username`: 您的 Telegram 用户名
   - `firstName`: 名
   - `lastName`: 姓（可选）
   - `createdAt`: 创建时间

### 7.2 检查交易数据
1. 查看 `transactions` 集合
2. 测试交易应包含：
   - `userId`: 用户 ID
   - `type`: "income" 或 "expense"
   - `amount`: 金额
   - `note`: 备注
   - `createdAt`: 时间戳

## 故障排除

### 问题 1：Firebase 初始化失败
**错误信息**：`Failed to initialize Firebase`
**解决方案**：
1. 检查 `service-account-key.json` 文件路径是否正确
2. 验证 JSON 文件格式是否正确
3. 确认服务账户有 Firestore 读写权限

### 问题 2：权限被拒绝
**错误信息**：`Permission denied` 或 `Missing or insufficient permissions`
**解决方案**：
1. 确保 Firestore 处于「测试模式」
2. 检查 Firestore 安全规则：
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```

### 问题 3：数据库连接超时
**错误信息**：`Firestore connection timeout`
**解决方案**：
1. 检查网络连接
2. 确认数据库位置选择正确
3. 尝试使用不同的数据库位置

## 重要提醒

### 安全注意事项
1. **保护服务账户密钥**：不要公开分享 `service-account-key.json` 文件
2. **环境变量安全**：不要将 `.env` 文件提交到版本控制
3. **定期轮换密钥**：建议每 90 天更新一次服务账户密钥

### 备份策略
1. 在切换 Firebase 项目前，备份现有数据
2. 使用 Firestore 导出功能备份数据：
   - 在 Firebase 控制台，进入「Firestore Database」
   - 点击「导出」按钮
   - 选择存储位置（Google Cloud Storage）

### 多环境配置
如果需要在不同环境使用不同 Firebase 项目：
1. 创建多个 `.env` 文件：`.env.development`, `.env.production`
2. 根据 `NODE_ENV` 加载不同配置
3. 使用不同命名的服务账户密钥文件

## 下一步

1. **设置安全规则**：开发完成后，设置适当的 Firestore 安全规则
2. **启用身份验证**：如果需要用户认证，启用 Firebase Authentication
3. **监控使用量**：在 Firebase 控制台监控数据库读写次数
4. **设置预算警报**：避免意外费用

## 获取帮助

如果遇到问题：
1. 查看项目中的 `TEST_INSTRUCTIONS.md` 文件
2. 检查日志文件中的详细错误信息
3. 参考 [Firebase 官方文档](https://firebase.google.com/docs)

---

**最后更新**：2026-06-04  
**适用版本**：Telegram Bot v1.0  
**维护者**：WorkBuddy AI Assistant