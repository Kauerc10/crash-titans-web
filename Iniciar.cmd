@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Abrir-menu.ps1"
if errorlevel 1 pause
