@echo off
cd /d "%~dp0"
echo Subir el portfolio a GitHub (te preguntara antes de subir nada)
node herramientas/subir.mjs
pause
