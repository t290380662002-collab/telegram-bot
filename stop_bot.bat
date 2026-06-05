@echo off
echo Stopping Telegram bot...

rem Kill any node process running our bot
for /f "tokens=2" %%i in ('tasklist ^| findstr /i "node.exe"') do (
  echo Killing process PID: %%i
  taskkill /F /PID %%i >nul 2>&1
)

echo Bot stopped.
pause