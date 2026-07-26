# AML Audio Tool

Aplicación de escritorio para descargar música y videos de YouTube. Construida con Electron, usa `yt-dlp` y `ffmpeg` para la descarga y conversión.

## Características

- **MP3 / MP4**: selector de formato antes de cada descarga
- **Descargas concurrentes**: hasta 20 descargas simultáneas con control de rendimiento (Bajo 5 / Medio 10 / Alto 15 / Ultra 20)
- **Playlists**: expansión y descarga por lotes con límite escalable según rendimiento (100/200/400/1000 videos)
- **Auto-update**: actualizaciones automáticas vía `electron-updater` y GitHub Releases
- **Auto-bump de versión**: el pipeline incrementa la versión automáticamente en cada release
- **Binarios incluidos**: `ffmpeg` y `yt-dlp` se empaquetan dentro del EXE portable
- **Mirrors**: al publicar un Release, se sube el EXE a Catbox y GoFile como descarga rápida
- **Monitoreo en tiempo real**: estado del sistema, disponibilidad de FFmpeg, progreso de descargas

## Requisitos

- **Windows** (portable EXE, no requiere instalación)
- ffmpeg y yt-dlp vienen incluidos en el EXE

## Instalación (desarrollo)

```bash
git clone https://github.com/AntonyML/AML_AudioTool_YouTubeMP3_Downloader.git
cd AML_AudioTool_YouTubeMP3_Downloader
npm install
npm start
```

## Build

```bash
npm run build:win     # Windows portable EXE
```

## Pipeline (CI/CD)

El pipeline `release.yml` se ejecuta automáticamente al hacer push a `main` o manualmente via `workflow_dispatch`:

1. Prepara versión (auto-bump patch)
2. Descarga ffmpeg + yt-dlp
3. Sincroniza versión en `package.json`
4. Compila el portable EXE
5. Crea GitHub Release con assets (EXE, ffmpeg.exe, yt-dlp.exe, latest.yml)
6. Sube mirrors a Catbox y GoFile
7. Inyecta los links de los mirrors en el body del Release

## Arquitectura

```
Renderer (UI) ←─ IPC ─→ Main Process ─→ DownloadManager
                                           ├── DownloadRegistry
                                           ├── DownloadScheduler
                                           ├── ResourceSemaphore
                                           ├── DownloadExecutor → yt-dlp
                                           ├── PlaylistExpander
                                           └── ValidationManager
```

## Estructura del proyecto

```
├── index.html                     # UI principal
├── package.json                   # Config y build de electron-builder
├── src/
│   ├── main.js                    # Proceso principal (IPC, autoUpdater)
│   ├── core/
│   │   ├── DownloadManager.js     # Fachada del sistema de descargas
│   │   ├── DownloadExecutor.js    # Spawn y argumentos de yt-dlp
│   │   ├── DownloadScheduler.js   # Cola FIFO + semáforo
│   │   ├── DownloadRegistry.js    # Registro de descargas
│   │   ├── DownloadPathResolver.js
│   │   ├── PlaylistExpander.js    # Expansión de playlists
│   │   ├── ValidationManager.js   # Validaciones pre-descarga
│   │   ├── StateMachine.js
│   │   └── ResourceSemaphore.js   # Control de concurrencia
│   └── renderer/
│       ├── app-modular.js         # Lógica de la UI
│       ├── core/state.js          # Estado global
│       ├── ui/                    # Módulos de UI
│       ├── config/constants.js    # Constantes y config
│       └── styles/main.css
├── .github/
│   ├── workflows/release.yml      # Pipeline CI/CD
│   └── release-template.md        # Template del Release body
└── bin/                           # ffmpeg.exe + yt-dlp.exe (descargados en CI)
```

## Licencia

Apache License 2.0
