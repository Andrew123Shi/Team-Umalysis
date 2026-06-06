@echo off
echo Starting Team Umalysis...
cd /d "%~dp0"
start http://localhost:5173
npm run dev
