@echo off
setlocal
title Gon Scan - Khoi dong ung dung
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo [LOI] Chua cai Node.js. Hay cai Node.js 22 hoac 24 tu https://nodejs.org
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay npm. Hay cai lai Node.js.
    pause
    exit /b 1
)

if not exist "node_modules\next\package.json" goto install
if not exist "public\opencv.js" goto install
goto launch

:install
echo Dang cai thu vien. Lan dau can ket noi Internet...
call npm ci
if errorlevel 1 (
    echo [LOI] Cai thu vien that bai. Hay kiem tra ket noi Internet va thu lai.
    pause
    exit /b 1
)

:launch
echo.
echo Dang chay Gon Scan tai http://localhost:3000
echo Giu cua so nay mo trong khi su dung. Nhan Ctrl+C de dung.
echo.
start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "$limit = (Get-Date).AddSeconds(90); do { try { $response = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -eq 200) { Start-Process 'http://localhost:3000'; exit } } catch {}; Start-Sleep -Seconds 1 } while ((Get-Date) -lt $limit)"
call npm run dev -- --port 3000
if errorlevel 1 (
    echo.
    echo [LOI] Khong khoi dong duoc ung dung.
    echo Neu cong 3000 dang duoc su dung, hay dong phien cu roi chay lai.
    pause
    exit /b 1
)
endlocal
