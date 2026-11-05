@echo off
chcp 65001 >nul
title NEIS setup
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*
echo.
pause
