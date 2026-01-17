@echo off
echo.

echo Actualizando version...
call node version-bump.js
if %errorlevel% neq 0 (
    echo Error al actualizar la version
    pause
    exit /b %errorlevel%
)
echo.


REM — Cambia a la carpeta donde está este .bat
pushd %~dp0

REM — Ejecuta npm start
npm start

REM — Mantiene la ventana abierta tras cerrar el proceso
pause
