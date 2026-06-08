@echo off
setlocal

cd /d "%~dp0..\.."

if "%1"=="" (
  set "MASTERMDB=%APPDATA%\..\LocalLow\Cygames\Umamusume\master\master.mdb"
) else (
  set "MASTERMDB=%~1"
)

if not exist "%MASTERMDB%" (
  echo ERROR: master.mdb not found at:
  echo   %MASTERMDB%
  exit /b 1
)

echo.
echo === Team Umalysis: updating game data from master.mdb ===
echo Source: %MASTERMDB%
echo.

echo [1/4] Generating umdb.json...
python "%~dp0generate_umdb.py" --db_path "%MASTERMDB%"
if errorlevel 1 exit /b 1

echo.
echo [2/4] Packing umdb.binarypb.gz...
npx tsx "%~dp0pack_umdb.mjs"
if errorlevel 1 exit /b 1

echo.
echo [3/5] Extracting new course geometry from game assets...
python "%~dp0extract_courseeventparams.py" --db_path "%MASTERMDB%"
if errorlevel 1 exit /b 1

echo.
echo [4/5] Updating gamedata assets...
python "%~dp0update_gamedata.py" --db_path "%MASTERMDB%"
if errorlevel 1 exit /b 1

echo.
echo [5/5] Packing gamedata.bin.gz...
python "%~dp0pack_gamedata.py"
if errorlevel 1 exit /b 1

echo.
echo Done. Refresh Team Umalysis in your browser to load the new data.
echo.
pause
