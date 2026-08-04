@echo off
title BygSmart 2.0 - Launcher
color 0A

echo.
echo  ================================================
echo    BygSmart 2.0 - Development Startup
echo  ================================================
echo.

:: ── Kill existing Node.js processes ─────────────────
echo  [0/2] Cleaning up existing node processes...
taskkill /F /IM node.exe >nul 2>&1

:: ── Free port 3000 if still in use by another process ─
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%P >nul 2>&1
)
echo.

:: ── Check Node.js ──────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed or not in PATH.
    echo          Download from: https://nodejs.org
    pause
    exit /b 1
)

:: ── Install dependencies if node_modules missing ───
if not exist "%~dp0node_modules\" (
    echo  [INFO] Installing npm dependencies...
    echo         This only runs once.
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] npm install failed. Check the output above.
        pause
        exit /b 1
    )
    echo.
)

:: ── Install server dependencies if needed ──────────
if not exist "%~dp0server\node_modules\" (
    echo  [INFO] Installing server npm dependencies...
    call npm install --prefix "%~dp0server"
    if %errorlevel% neq 0 (
        echo  [ERROR] Server npm install failed.
        pause
        exit /b 1
    )
    echo.
)

:: ── Start API Server in a new window ────────────────
echo  [1/2] Starting API server on http://localhost:3002 ...
start "BygSmart - API Server" cmd /k "title BygSmart - API Server && color 0C && cd /d "%~dp0" && node server/index.js"

:: ── Wait for API to be ready ────────────────────────
timeout /t 2 /nobreak >nul

:: ── Start Vite Dev Server in a new window ──────────
echo  [2/2] Starting Vite dev server on http://localhost:3000 ...
start "BygSmart - Vite Dev Server" cmd /k "title BygSmart - Vite Dev Server && color 0B && cd /d "%~dp0" && npm run dev"

:: ── Wait a moment then open browser ────────────────
echo.
echo  Waiting for Vite to start...
timeout /t 4 /nobreak >nul
start "" "http://localhost:3000"

echo.
echo  ================================================
echo    Services started:
echo.
echo    [1] API Server        ^> http://localhost:3002
echo        (runs in separate window, yellow)
echo.
echo    [2] Vite Dev Server   ^> http://localhost:3000
echo        (runs in separate window, cyan)
echo.
echo    Backend DB: Supabase hosted at
echo        https://pkzburssqetnlcbvabdq.supabase.co
echo  ================================================
echo.
echo  Press any key to close this launcher window...
pause >nul