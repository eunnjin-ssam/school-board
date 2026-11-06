@echo off
chcp 65001 >nul
title NEIS auto-login
cd /d "%~dp0"
if not exist "node_modules\playwright-core" (
  echo Run the setup file first.
  pause
  exit /b 1
)
rem 검은 창 없이 뒤에서 돌려요. 크롬을 닫으면 같이 꺼지고, 막히면 알림 창으로 알려 줘요.
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath node -ArgumentList 'login.mjs' -WorkingDirectory (Get-Location) -WindowStyle Hidden"
