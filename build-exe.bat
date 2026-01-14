@echo off
echo ====================================
echo   Generando ejecutable Windows
echo ====================================
echo.

echo Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo Error al instalar dependencias
    pause
    exit /b %errorlevel%
)
echo.

echo Generando ejecutable...
call npm run build:win
if %errorlevel% neq 0 (
    echo Error al generar el ejecutable
    pause
    exit /b %errorlevel%
)
echo.

echo ====================================
echo   Ejecutable generado exitosamente
echo   Ubicacion: dist\
echo ====================================
pause
