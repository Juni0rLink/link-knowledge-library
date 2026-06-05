@echo off
:: ============================================
:: LINK Knowledge Library - Add file to library
:: Usage: Drag & drop file onto this script
:: ============================================

if "%~1"=="" (
    echo Keo tha file vao script nay de them vao thu vien.
    pause
    exit
)

set "FILE=%~1"
set "NAME=%~nx1"
set "DEST=C:\Users\15pho.LINK\OneDrive\Desktop\link-knowledge-library\content\%NAME%"
set "REPO=C:\Users\15pho.LINK\OneDrive\Desktop\link-knowledge-library"

echo Adding: %NAME%
copy "%FILE%" "%DEST%"

cd /d "%REPO%"
git add "content/%NAME%"
git commit -m "Add file: %NAME%"
git push

echo.
echo Done! File added: %NAME%
pause
