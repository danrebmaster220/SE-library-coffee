@echo off
title POS-58 Print Server

:: Auto-elevate to Admin if not already
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator access...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: One-time: register HTTP listener (safe to run multiple times)
netsh http add urlacl url=http://+:9100/ user=Everyone >nul 2>&1

echo.
echo   Starting POS-58 Print Server...
echo   (Keep this window open while using the POS)
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0PrintServer.ps1"
pause
