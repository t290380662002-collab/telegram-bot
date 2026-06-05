@echo off
chcp 65001 >nul
echo 正在啟動 Telegram 機器人...
echo 日誌輸出到 bot.log

REM 檢查是否已安裝 node
where node >nul 2>&1
if errorlevel 1 (
    echo 錯誤: Node.js 未安裝或未添加到 PATH
    pause
    exit /b 1
)

REM 檢查是否在正確的目錄
if not exist "package.json" (
    echo 錯誤: 請在 telegram-bot 目錄中運行此腳本
    pause
    exit /b 1
)

REM 殺死可能正在運行的舊進程
for /f "tokens=2" %%i in ('tasklist ^| findstr /i "node.*index"') do (
    echo 殺死舊進程 PID: %%i
    taskkill /F /PID %%i >nul 2>&1
)

REM 啟動機器人並將輸出重定向到日誌文件
start /B "Telegram Bot" node src/index.js > bot.log 2>&1

echo 機器人已啟動在後台
echo 檢查日誌: type bot.log
echo.
echo 要停止機器人，運行: stop_bot.bat
pause