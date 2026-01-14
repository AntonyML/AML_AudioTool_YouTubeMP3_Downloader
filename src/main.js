const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const DownloadManager = require('./core/DownloadManager');

let win;
let downloadManager;

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
    
    downloadManager = new DownloadManager({ maxConcurrent: 20 });
    setupDownloadEvents();
}

function setupDownloadEvents() {
    downloadManager.on('download-created', (data) => {
        win.webContents.send('download-created', data);
    });

    downloadManager.on('state-changed', (data) => {
        win.webContents.send('download-state-changed', data);
    });

    downloadManager.on('download-progress', (data) => {
        win.webContents.send('download-progress', data);
    });

    downloadManager.on('download-finished', (data) => {
        win.webContents.send('download-finished', data);
    });

    downloadManager.on('download-error', (data) => {
        win.webContents.send('download-error', data);
    });

    downloadManager.on('download-output', (data) => {
        win.webContents.send('download-output', data);
    });

    downloadManager.on('playlist-expansion-started', (data) => {
        win.webContents.send('playlist-expansion-started', data);
    });

    downloadManager.on('playlist-info', (data) => {
        win.webContents.send('playlist-info', data);
    });

    downloadManager.on('playlist-expanded', (data) => {
        win.webContents.send('playlist-expanded', data);
    });

    downloadManager.on('playlist-error', (data) => {
        win.webContents.send('playlist-error', data);
    });
}

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
            return { 
                success: false, 
                error: 'No se puede cambiar con descargas activas' 
            };
        }
        
        downloadManager.setMaxConcurrent(maxConcurrent);
        
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (downloadManager) {
        downloadManager.clear();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});