@echo off
chcp 65001 >nul
title NEIS auto-login
cd /d "%~dp0"
if not exist "node_modules\playwright-core" (
  echo Run the setup file first.
  pause
  exit /b 1
)
node login.mjs
if errorlevel 1 pause
