@echo off
echo ========================================
echo   Actualizador de FFmpeg
echo ========================================
echo.
echo Descargando ultima version de FFmpeg...
echo.

curl -L https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip -o ffmpeg.zip

if %errorlevel% neq 0 (
    echo.
    echo ERROR: No se pudo descargar FFmpeg
    echo Verifica tu conexion a internet
    pause
    exit /b 1
)

echo.
echo Extrayendo FFmpeg...
powershell -command "Expand-Archive -Path ffmpeg.zip -DestinationPath temp_ffmpeg -Force"

if %errorlevel% neq 0 (
    echo.
    echo ERROR: No se pudo extraer FFmpeg
    pause
    exit /b 1
)

echo.
echo Copiando ffmpeg.exe...
copy /y temp_ffmpeg\ffmpeg-master-latest-win64-gpl\bin\ffmpeg.exe ffmpeg.exe

if %errorlevel% neq 0 (
    echo.
    echo ERROR: No se pudo copiar ffmpeg.exe
    pause
    exit /b 1
)

echo.
echo Limpiando archivos temporales...
rd /s /q temp_ffmpeg
del ffmpeg.zip

echo.
echo ========================================
echo   FFmpeg actualizado exitosamente
echo ========================================
echo.
ffmpeg -version
echo.
pause