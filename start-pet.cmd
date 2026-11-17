@echo off
setlocal
set "ELECTRON_RUN_AS_NODE="
if exist "%~dp0dist\LUNA桌宠-win64\LUNA桌宠.exe" (
  start "LUNA" "%~dp0dist\LUNA桌宠-win64\LUNA桌宠.exe"
  exit /b 0
)
set "ELECTRON_HOME=D:\FORDS\hermestools\wb40-luna-electron"
set "ELECTRON_EXE=%ELECTRON_HOME%\node_modules\electron\dist\electron.exe"
if exist "%ELECTRON_EXE%" (
  start "LUNA" "%ELECTRON_EXE%" "%~dp0"
  exit /b 0
)
where electron >nul 2>nul
if %errorlevel%==0 (
  start "LUNA" electron "%~dp0"
  exit /b 0
)
echo Electron is not installed. Run: npm install
echo Then start with: npm start
pause
