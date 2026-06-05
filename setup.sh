#!/bin/bash

echo "==================================="
echo "Telegram Bot 出入帳機器人 - 啟動腳本"
echo "==================================="
echo ""

# 檢查 Node.js
if ! command -v node &> /dev/null; then
    echo "[錯誤] 未找到 Node.js，請先安裝 Node.js"
    echo "下載地址: https://nodejs.org/"
    exit 1
fi

# 檢查 .env 文件
if [ ! -f .env ]; then
    echo "[警告] 未找到 .env 文件"
    echo "正在從 .env.example 創建 .env..."
    cp .env.example .env
    echo "請編輯 .env 文件並填入你的配置"
    ${EDITOR:-nano} .env
fi

# 檢查 node_modules
if [ ! -d node_modules ]; then
    echo "[信息] 正在安裝依賴套件..."
    npm install
fi

# 檢查 Firebase 服務帳戶密鑰
if [ ! -f service-account-key.json ]; then
    echo "[警告] 未找到 service-account-key.json"
    echo "請從 Firebase Console 下載服務帳戶密鑰文件"
    echo "並將其重命名為 service-account-key.json 放在此目錄"
    read -p "按 Enter 繼續..."
fi

echo ""
echo "[信息] 正在啟動 Telegram Bot..."
echo ""
node src/index.js
