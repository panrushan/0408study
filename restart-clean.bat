@echo off
echo ==========================================
echo   AnJi Server Restart
echo ==========================================
echo.
echo Stopping programs on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    echo Killing PID: %%a
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 >nul
echo.
echo Starting server and browser...
start msedge http://localhost:3000
node server.js
pause
