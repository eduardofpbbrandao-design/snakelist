@echo off
setlocal
cd /d "%~dp0"

echo.
echo   Connect SnakeList to GitHub
echo   ---------------------------
echo   Open your repo on github.com and copy the address bar.
echo   It looks like:  https://github.com/yourname/snakelist
echo.
set /p REPO=  Paste it here and press Enter:

if "%REPO%"=="" (
  echo.
  echo   Nothing pasted. Run this again when you have the URL.
  pause
  exit /b 1
)

echo.
echo   Connecting to %REPO%
git remote remove origin >nul 2>&1
git remote add origin "%REPO%"
git branch -M main

echo   Pushing...
git push -u origin main
if errorlevel 1 (
  echo.
  echo   The repo already has something in it. Merging that in first...
  git pull --rebase origin main
  git push -u origin main
)

if errorlevel 1 (
  echo.
  echo   Push did not complete. Copy whatever is printed above and send it to Claude.
) else (
  echo.
  echo   Done. Your project is on GitHub.
)

echo.
pause
