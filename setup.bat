@echo off
echo ===================================
echo Telegram Bot 出入帳機器人 - 啟動腳本
echo ===================================
echo.

REM 檢查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [錯誤] 未找到 Node.js，請先安裝 Node.js
    echo 下載地址: https://nodejs.org/
    pause
    exit /b 1
)

REM 檢查 .env 文件
if not exist .env (
    echo [警告] 未找到 .env 文件
    echo 正在從 .env.example 創建 .env...
    copy .env.example .env
    echo 請編輯 .env 文件並填入你的配置
    notepad .env
)

REM 檢查 node_modules
if not exist node_modules (
    echo [信息] 正在安裝依賴套件...
    call npm install
)

REM 檢查 Firebase 服務帳戶密鑰
if not exist service-account-key.json (
    echo [警告] 未找到 service-account-key.json
    echo 請從 Firebase Console 下載服務帳戶密鑰文件
    echo 並將其重命名為 service-account-key.json 放在此目錄
    pause
)

echo.
echo [信息] 正在啟動 Telegram Bot...
echo.
node src/index.js

pause
