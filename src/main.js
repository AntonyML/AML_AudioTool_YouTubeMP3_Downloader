const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const DownloadManager = require('./core/DownloadManager');
const logger = require('./core/Logger');

let win;
let downloadManager;

const log = logger.child('Main');

// ── File logger: intercept bare console.* calls ──
const origConsole = { log: console.log, warn: console.warn, error: console.error };
console.log = (...args) => { origConsole.log.apply(console, args); logger.info('Console', ...args); };
console.warn = (...args) => { origConsole.warn.apply(console, args); logger.warn('Console', ...args); };
console.error = (...args) => { origConsole.error.apply(console, args); logger.error('Console', ...args); };

process.on('uncaughtException', (err) => {
    log.error('UNCAUGHT EXCEPTION:', err.stack || err.message || err);
});
process.on('unhandledRejection', (reason) => {
    log.error('UNHANDLED REJECTION:', reason instanceof Error ? reason.stack : reason);
});

function createWindow() {
    win = new BrowserWindow({
        width: 1000,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('index.html');

    // Security: CSP
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
                    "style-src 'self' 'unsafe-inline'; " +
                    "img-src 'self' data:; " +
                    "connect-src 'self' https:; " +
                    "media-src 'none'; " +
                    "frame-src 'none'; " +
                    "child-src 'none'; " +
                    "object-src 'none'"
                ]
            }
        });
    });

    // Security: block external navigation
    win.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('file://')) {
            event.preventDefault();
        }
    });

    // Security: block window.open
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    downloadManager = new DownloadManager({ maxConcurrent: 5 });
    setupDownloadEvents();
    const updateConfigPath = path.join(process.resourcesPath, 'app-update.yml');
    if (fs.existsSync(updateConfigPath)) {
        setupAutoUpdater();
    }

    log.info(`Logs: ${logger.getLogPath()}`);
}

function safeSend(channel, data) {
    if (win && !win.isDestroyed()) {
        win.webContents.send(channel, data);
    }
}

function setupDownloadEvents() {
    downloadManager.on('download-created', (data) => safeSend('download-created', data));
    downloadManager.on('state-changed', (data) => safeSend('download-state-changed', data));
    downloadManager.on('download-progress', (data) => safeSend('download-progress', data));
    downloadManager.on('download-finished', (data) => safeSend('download-finished', data));
    downloadManager.on('download-error', (data) => safeSend('download-error', data));
    downloadManager.on('download-output', (data) => safeSend('download-output', data));
    downloadManager.on('playlist-expansion-started', (data) => safeSend('playlist-expansion-started', data));
    downloadManager.on('playlist-info', (data) => safeSend('playlist-info', data));
    downloadManager.on('playlist-expanded', (data) => safeSend('playlist-expanded', data));
    downloadManager.on('playlist-error', (data) => safeSend('playlist-error', data));
}

// ── IPC: pipe renderer logs to file ──
ipcMain.on('renderer-log', (event, { level, args }) => {
    const method = logger[level] || logger.info;
    method('Renderer', ...args);
});

ipcMain.handle('select-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    return canceled ? '' : filePaths[0];
});

ipcMain.handle('add-download', async (event, { url, outputPath, metadata }) => {
    if (metadata && metadata.isPlaylist) {
        return downloadManager.addPlaylist(url, outputPath, metadata);
    }
    return downloadManager.addDownload(url, outputPath, metadata);
});

ipcMain.handle('cancel-download', async (event, { downloadId }) => {
    return downloadManager.cancelDownload(downloadId);
});

ipcMain.handle('get-download', async (event, { downloadId }) => {
    return downloadManager.getDownload(downloadId);
});

ipcMain.handle('get-all-downloads', async () => {
    return downloadManager.getAllDownloads();
});

ipcMain.handle('get-stats', async () => {
    return downloadManager.getStats();
});

ipcMain.handle('change-max-concurrent', async (event, { maxConcurrent }) => {
    try {
        const stats = downloadManager.getStats();
        if (stats.registry.active > 0 || stats.registry.queued > 0) {
            return { success: false, error: 'No se puede cambiar con descargas activas' };
        }
        downloadManager.setMaxConcurrent(maxConcurrent);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ── Auto-Updater IPC ──
ipcMain.handle('check-for-updates', async () => {
    try {
        autoUpdater.checkForUpdates();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('download-update', async () => {
    try {
        autoUpdater.downloadUpdate();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('install-update', async () => {
    try {
        autoUpdater.quitAndInstall();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ── Auto-Updater Events ──
let isSilentCheck = false;

function setupAutoUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
        if (isSilentCheck) {
            isSilentCheck = false;
            return;
        }
        safeSend('update-checking');
    });

    autoUpdater.on('update-available', (info) => {
        safeSend('update-available', {
            version: info.version,
            releaseDate: info.releaseDate,
            releaseNotes: info.releaseNotes
        });
    });

    autoUpdater.on('update-not-available', (info) => {
        safeSend('update-not-available', info);
    });

    autoUpdater.on('download-progress', (progress) => {
        safeSend('update-download-progress', {
            percent: Math.round(progress.percent),
            bytesPerSecond: progress.bytesPerSecond,
            total: progress.total,
            transferred: progress.transferred
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        safeSend('update-downloaded', { version: info.version });
    });

    autoUpdater.on('error', (err) => {
        safeSend('update-error', {
            message: err.message || 'Error de actualización desconocido'
        });
    });

    // ── Silent update check on startup ──
    setTimeout(() => {
        isSilentCheck = true;
        autoUpdater.checkForUpdates().catch(() => {});
    }, 5000);
}

app.whenReady().then(() => {
    logger.init();
    createWindow();
});

app.on('window-all-closed', () => {
    if (downloadManager) {
        downloadManager.clear();
    }
    logger.close();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
