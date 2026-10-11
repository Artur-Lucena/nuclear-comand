@echo off
rem Atalho de inicialização do app desktop "Império".
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron nao encontrado. Rode primeiro: npm install
  pause
  exit /b 1
)
start "" "node_modules\electron\dist\electron.exe" .
