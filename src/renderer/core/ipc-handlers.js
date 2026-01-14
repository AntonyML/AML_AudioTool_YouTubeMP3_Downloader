// Manejadores de eventos IPC
const { ipcRenderer } = require('electron');
const state = require('../core/state');
const { updateConsole, updateSystemStatus } = require('../ui/console');
const { updateStats } = require('../ui/stats');
const { unlockUI } = require('../ui/ui-controls');
const { notify } = require('../ui/notifications');
const { 
    addDownloadToUI, 
    shouldShowDownload, 
    updateDownloadItem, 
    updateDownloadItemThrottled 
} = require('../ui/download-manager');

const setupIpcListeners = () => {
    ipcRenderer.on('download-created', (event, data) => {
        requestAnimationFrame(() => {
            addDownloadToUI(data.downloadId, data.url, data.metadata);
        });
    });

    ipcRenderer.on('download-state-changed', (event, data) => {
        updateConsole(`[${data.downloadId}] ${data.fromState} -> ${data.toState}`);
        
        const downloadData = state.downloads.get(data.downloadId);
        if (downloadData) {
            downloadData.currentState = data.toState;
        }
        
        if (state.waitingForFirstDownload && data.toState === 'DOWNLOADING') {
            state.waitingForFirstDownload = false;
            unlockUI();
        }
        
        if (shouldShowDownload(data.downloadId)) {
            updateDownloadItem(data.downloadId, { state: data.toState });
        }
        updateStats();
    });

    ipcRenderer.on('download-progress', (event, data) => {
        const downloadData = state.downloads.get(data.downloadId);
        if (downloadData) {
            downloadData.currentProgress = data.progress;
        }
        
        if (shouldShowDownload(data.downloadId)) {
            updateDownloadItemThrottled(data.downloadId, { progress: data.progress });
        }
    });

    ipcRenderer.on('download-finished', (event, data) => {
        updateConsole(`[${data.downloadId}] Finalizada`);
        notify.success('Descarga finalizada');
        if (shouldShowDownload(data.downloadId)) {
            updateDownloadItem(data.downloadId, { state: 'COMPLETED' });
        }
        updateStats();
    });

    ipcRenderer.on('download-error', (event, data) => {
        updateConsole(`[${data.downloadId}] ERROR: ${data.error}`);
        
        if (data.error.includes('YouTube bloqueado')) {
            updateSystemStatus('YouTube bloqueado - Actualizar yt-dlp requerido', 'error');
            notify.error('YouTube bloqueado - Requiere actualizar yt-dlp');
        } else {
            notify.error(`Error en descarga: ${data.error.substring(0, 50)}...`);
        }
        
        if (shouldShowDownload(data.downloadId)) {
            updateDownloadItem(data.downloadId, { error: data.error });
        }
    });

    ipcRenderer.on('download-output', (event, data) => {
        // Solo loggear en consola, no saturar UI
    });

    ipcRenderer.on('playlist-expansion-started', (event, data) => {
        updateConsole(`Expandiendo playlist: ${data.url}`);
        updateSystemStatus('Expandiendo playlist...', 'info');
        document.getElementById('downloadBtn').textContent = 'Expandiendo playlist...';
    });

    ipcRenderer.on('playlist-info', (event, data) => {
        updateConsole(`Playlist: ${data.title} (${data.count} videos)`);
        updateSystemStatus(`Playlist: ${data.count} videos`, 'info');
    });

    ipcRenderer.on('playlist-expanded', (event, data) => {
        updateConsole(`Playlist expandida: ${data.videoCount} videos agregados`);
        updateSystemStatus(`${data.videoCount} videos agregados`, 'success');
        notify.success(`Playlist procesada: ${data.videoCount} videos añadidos a la cola`);
        document.getElementById('downloadBtn').textContent = 'Procesando...';
    });

    ipcRenderer.on('playlist-error', (event, data) => {
        updateConsole(`Error en playlist: ${data.error}`);
        updateSystemStatus(`Error: ${data.error}`, 'error');
        notify.error(`Error al procesar playlist: ${data.error}`);
        state.waitingForFirstDownload = false;
        unlockUI();
    });
};

module.exports = {
    setupIpcListeners
};
