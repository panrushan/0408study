@echo off
chcp 65001 >nul
echo ==========================================
echo   安肌成分检测 - 启动服务器
echo ==========================================
echo.
echo 正在启动，请稍候...
echo.
start msedge http://localhost:3000
timeout /t 2 >nul
node server.js
pause
