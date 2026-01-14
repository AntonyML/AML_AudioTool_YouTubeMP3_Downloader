@echo off
REM — Cambia a la carpeta donde está este .bat
pushd %~dp0

REM — Ejecuta npm start
npm start

REM — Mantiene la ventana abierta tras cerrar el proceso
pause
