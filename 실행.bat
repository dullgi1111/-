@echo off
cd /d "%~dp0"

echo Starting Maintenance Term Normalizer...
echo.

start "Backend Server" cmd /k "cd server && npm run dev"
start "Frontend Server" cmd /k "cd client && npm run dev"

echo Waiting for the app to be ready...
:waitloop
curl -s -o nul http://localhost:5173
if errorlevel 1 (
  timeout /t 1 /nobreak >nul
  goto waitloop
)

start "" "http://localhost:5173"
echo Browser opened. You can close this window.
echo (To stop the app, close the two new console windows that opened.)
timeout /t 3 >nul
