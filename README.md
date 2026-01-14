# AML Audio Tool

AML Audio Tool is a professional desktop application designed for efficient audio and video downloading from YouTube. Built with Electron and Node.js, it leverages the power of `yt-dlp` and `ffmpeg` to provide a robust, high-performance downloading experience.

## Features

- **High-Quality Downloads:** Support for various audio and video formats.
- **Playlist Support:** Intelligent handling of YouTube playlists for batch downloading.
- **Concurrent Download Manager:** Optimized performance with configurable concurrent download limits (default: 20).
- **Resource Monitoring:** Real-time system status and FFmpeg availability checks.
- **Cross-Platform:** Compatible with Windows, macOS, and Linux.
- **Modular Architecture:** Clean separation of concerns between main process, renderer, and core logic.

## Technical Stack

- **Framework:** Electron
- **Runtime:** Node.js
- **Core Tools:**
  - `yt-dlp` for media extraction.
  - `ffmpeg` for media conversion and processing.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/AntonyML/AML_AudioTool_YouTubeMP3_Downloader.git
   ```

2. Navigate to the project directory:
   ```bash
   cd AML_AudioTool_YouTubeMP3_Downloader
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Development

To start the application in development mode:

```bash
npm start
```

### Building

To build the application for production:

- **Windows:**
  ```bash
  npm run build:win
  ```

- **macOS:**
  ```bash
  npm run build:mac
  ```

- **Linux:**
  ```bash
  npm run build:linux
  ```

## License

Licensed under the Apache License, Version 2.0. See the LICENSE file for details.
