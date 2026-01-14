@echo off
echo ========================================
echo   Actualizador de yt-dlp
echo ========================================
echo.
echo Descargando ultima version de yt-dlp...
echo.

curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -o yt-dlp.exe.new

if %errorlevel% neq 0 (
    echo.
    echo ERROR: No se pudo descargar yt-dlp
    echo Verifica tu conexion a internet
    pause
    exit /b 1
)

echo.
echo Reemplazando archivo antiguo...
move /y yt-dlp.exe.new yt-dlp.exe

if %errorlevel% neq 0 (
    echo.
    echo ERROR: No se pudo reemplazar el archivo
    echo Cierra la aplicacion e intenta de nuevo
    pause
    exit /b 1
)

echo.
echo ========================================
echo   yt-dlp actualizado exitosamente
echo ========================================
echo.
yt-dlp --version
echo.
pause
