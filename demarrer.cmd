@echo off
setlocal
cd /d "%~dp0"
set "SELLAI_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%SELLAI_NODE%" goto bundled
where node >nul 2>nul
if errorlevel 1 goto missing
node "%~dp0node_modules\next\dist\bin\next" dev --port 3000
goto end
:bundled
"%SELLAI_NODE%" "%~dp0node_modules\next\dist\bin\next" dev --port 3000
goto end
:missing
echo Node.js est introuvable. Installez Node.js puis relancez ce fichier.
:end
pause
