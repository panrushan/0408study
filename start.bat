@echo off
chcp 65001 >nul
echo ==========================================
echo   安肌成分检测 - 启动服务器
echo ==========================================
echo.
echo 正在启动服务器，请稍候...
echo.

rem 先在新窗口启动服务器（保持后台运行）
start "安肌成分检测 - 服务端" node server.js

echo 等待服务器就绪...
timeout /t 3 >nul

echo 正在打开浏览器...
start msedge http://localhost:3000

echo.
echo ==========================================
echo  浏览器已打开，服务器在独立窗口运行
echo  关闭那个窗口才会停止服务
echo ==========================================
echo.
pause
