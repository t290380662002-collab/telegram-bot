# Firebase 新项目设置指南 (telegram-bot-new)

本指南将帮助您创建新的 Firebase 项目 `telegram-bot-new` 并配置 Telegram 机器人使用它。

## ⚠️ 重要提醒

**在继续之前，请确保：**
- 您已登录 Google 账户（拥有 Firebase 访问权限）
- 您已备份现有 Firebase 项目 `anget1` 中的重要数据（如果需要）
- 您了解切换 Firebase 项目后，现有数据将无法访问

## 🚀 快速设置步骤

### 步骤 1：创建 Firebase 项目

1. 访问 [Firebase 控制台](https://console.firebase.google.com/)
2. 点击「创建项目」或「添加项目」
3. 输入项目名称：**`telegram-bot-new`**
4. 点击「继续」
5. **不要启用 Google Analytics**（除非需要）
6. 点击「创建项目」（等待约 30 秒）

### 步骤 2：启用 Firestore 数据库

1. 在项目概览页面，点击左侧菜单「Firestore Database」
2. 点击「创建数据库」
3. 选择「以测试模式开始」
4. 选择数据库位置：**`asia-east1`（台湾）**（推荐）
5. 点击「启用」

### 步骤 3：获取项目配置信息

1. 点击左侧齿轮图标「项目设置」
2. 在「一般」标签页中，找到：
   - **项目 ID**：`telegram-bot-new`（应该与项目名称相同）
   - **项目编号**：记下备用

3. 在「服务账户」标签页中：
   - 点击「生成新的私钥」
   - 选择「Firebase Admin SDK」
   - 点击「生成密钥」
   - 下载 JSON 文件

### 步骤 4：配置服务账户密钥

1. 将下载的 JSON 文件重命名为 `service-account-key.json`
2. 复制到项目目录的 `config/` 文件夹中：
   ```
   C:\Users\t2903\WorkBuddy\2026-06-04-15-29-30\telegram-bot\config\service-account-key.json
   ```

3. 如果 `config/` 文件夹不存在，请先创建：
   ```bash
   cd "C:\Users\t2903\WorkBuddy\2026-06-04-15-29-30\telegram-bot"
   mkdir config
   ```

### 步骤 5：更新环境变量

`.env` 文件已预先配置为使用新项目：

```env
FIREBASE_DATABASE_URL=https://telegram-bot-new.firebaseio.com
FIREBASE_PROJECT_ID=telegram-bot-new
```

**无需修改**，除非项目 ID 不同。

### 步骤 6：测试新连接

1. 停止当前机器人（如果正在运行）：
   ```bash
   cd "C:\Users\t2903\WorkBuddy\2026-06-04-15-29-30\telegram-bot"
   stop_bot.bat
   ```

2. 启动机器人：
   ```bash
   start_bot.bat
   ```

3. 检查日志文件 `bot.log`：
   ```bash
   type bot.log
   ```

4. 预期输出：
   ```
   ✅ Telegram bot 已启动...
   📛 Bot 用户名: @JOHNNY1688_BOT
   🔥 Firebase 已连接: telegram-bot-new
   ```

### 步骤 7：测试功能

在 Telegram 中向 `@JOHNNY1688_BOT` 发送：

1. `/ping` - 测试基本响应
2. `/start` - 测试用户注册
3. `/+ 1000` - 测试交易记录

## 🔧 故障排除

### 问题 1：Firebase 认证失败
**错误信息**：`Failed to initialize Firebase`
**解决方案**：
- 确认 `service-account-key.json` 文件在 `config/` 目录中
- 确认文件内容完整（非空）
- 重新下载服务账户密钥

### 问题 2：数据库权限错误
**错误信息**：`Missing or insufficient permissions`
**解决方案**：
1. 返回 Firebase 控制台
2. 进入 Firestore Database > 规则
3. 确保规则为测试模式：
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```

### 问题 3：机器人无响应
**解决方案**：
1. 检查日志：`type test.log`
2. 发送 `/ping` 测试
3. 重启机器人：`stop_bot.bat` 然后 `start_bot.bat`

## 🔄 切换回旧项目

如果需要切换回旧项目 `anget1`：

1. 编辑 `.env` 文件：
   - 注释新项目配置（在行首添加 `#`）
   - 取消注释旧项目配置（移除行首的 `#`）

2. 确保 `config/service-account-key.json` 是旧项目的密钥

3. 重启机器人

## 📞 获取帮助

如果遇到问题，请提供：
1. 日志文件内容（`bot.log` 或 `test.log`）
2. 具体的错误信息
3. 您已执行的步骤

---
*最后更新：2026-06-04*