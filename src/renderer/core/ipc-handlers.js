// Manejadores de eventos IPC
const { ipcRenderer } = require('electron');
const state = require('../core/state');
const { updateConsole, updateSystemStatus } = require('../ui/console');
const { updateStats } = require('../ui/stats');
const { unlockUI } = require('../ui/ui-controls');
const { 
    addDownloadToUI, 
    shouldShowDownload, 
    updateDownloadItem, 
    updateDownloadItemThrottled 
} = require('../ui/download-manager');

const setupIpcListeners = () => {
    // ── Auto-Update Events ──
    ipcRenderer.on('update-checking', () => {
        showUpdateBanner('checking', '🔍 Buscando actualizaciones...');
    });

    ipcRenderer.on('update-available', (event, info) => {
        showUpdateBanner('available', 
            `📦 Nueva versión disponible: ${info.version}`,
            '¿Descargar ahora?'
        );
        updateConsole(`Actualización disponible: v${info.version}`);
        updateSystemStatus(`Actualización v${info.version} disponible`, 'info');
    });

    ipcRenderer.on('update-not-available', () => {
        const banner = document.getElementById('updateBanner');
        if (banner && !banner.classList.contains('hidden')) {
            showUpdateBanner('not-available', '✅ Tienes la última versión');
            setTimeout(hideUpdateBanner, 3000);
        }
    });

    ipcRenderer.on('update-download-progress', (event, progress) => {
        const progressContainer = document.getElementById('updateProgress');
        const progressFill = document.getElementById('updateProgressFill');
        const progressText = document.getElementById('updateProgressText');
        const message = document.getElementById('updateMessage');
        
        if (progressContainer && progressFill && progressText && message) {
            progressContainer.classList.remove('hidden');
            progressFill.style.width = progress.percent + '%';
            
            const speed = formatBytes(progress.bytesPerSecond);
            const transferred = formatBytes(progress.transferred);
            const total = formatBytes(progress.total);
            progressText.textContent = `${progress.percent}% (${transferred} / ${total} @ ${speed}/s)`;
            message.textContent = `⬇️ Descargando actualización... ${progress.percent}%`;
        }
    });

    ipcRenderer.on('update-downloaded', (event, info) => {
        showUpdateBanner('downloaded', 
            `✅ Actualización ${info.version} descargada`,
            'Reinicia para instalar'
        );
        document.getElementById('updateDownloadBtn')?.classList.add('hidden');
        document.getElementById('updateInstallBtn')?.classList.remove('hidden');
        document.getElementById('updateProgress')?.classList.add('hidden');
        updateConsole(`Actualización v${info.version} descargada. Reinicia para instalar.`);
        updateSystemStatus('Actualización lista para instalar', 'success');
    });

    ipcRenderer.on('update-error', (event, error) => {
        console.error('[UPDATE] Error:', error.message);
        const banner = document.getElementById('updateBanner');
        if (banner && !banner.classList.contains('hidden')) {
            showUpdateBanner('error', `⚠️ Error: ${error.message}`);
            setTimeout(hideUpdateBanner, 5000);
        }
    });


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
        if (shouldShowDownload(data.downloadId)) {
            updateDownloadItem(data.downloadId, { state: 'COMPLETED' });
        }
        updateStats();
    });

    ipcRenderer.on('download-error', (event, data) => {
        updateConsole(`[${data.downloadId}] ERROR: ${data.error}`);
        
        if (data.error.includes('YouTube bloqueado')) {
            updateSystemStatus('YouTube bloqueado - Actualizar yt-dlp requerido', 'error');
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
        document.getElementById('downloadBtn').textContent = 'Procesando...';
    });

    ipcRenderer.on('playlist-error', (event, data) => {
        updateConsole(`Error en playlist: ${data.error}`);
        updateSystemStatus(`Error: ${data.error}`, 'error');
        state.waitingForFirstDownload = false;
        unlockUI();
    });
};

// ── Update Banner Helpers ──
function showUpdateBanner(type, message, submessage) {
    const banner = document.getElementById('updateBanner');
    const messageEl = document.getElementById('updateMessage');
    const progressContainer = document.getElementById('updateProgress');
    const downloadBtn = document.getElementById('updateDownloadBtn');
    const installBtn = document.getElementById('updateInstallBtn');
    const laterBtn = document.getElementById('updateLaterBtn');
    const closeBtn = document.getElementById('updateCloseBtn');

    if (!banner || !messageEl) return;

    banner.className = 'update-banner';
    banner.classList.add(type);
    banner.classList.remove('hidden');

    messageEl.textContent = message;

    if (progressContainer) progressContainer.classList.add('hidden');
    if (downloadBtn) downloadBtn.classList.remove('hidden');
    if (installBtn) installBtn.classList.add('hidden');
    if (closeBtn) closeBtn.classList.remove('hidden');

    if (type === 'checking') {
        if (downloadBtn) downloadBtn.classList.add('hidden');
        if (laterBtn) laterBtn.classList.add('hidden');
        if (closeBtn) closeBtn.classList.add('hidden');
    } else if (type === 'available') {
        if (downloadBtn) downloadBtn.classList.remove('hidden');
        if (laterBtn) laterBtn.classList.remove('hidden');
        if (closeBtn) closeBtn.classList.remove('hidden');
    } else if (type === 'downloaded') {
        if (downloadBtn) downloadBtn.classList.add('hidden');
        if (installBtn) installBtn.classList.remove('hidden');
        if (laterBtn) laterBtn.classList.remove('hidden');
        if (closeBtn) closeBtn.classList.add('hidden');
    } else if (type === 'error' || type === 'not-available') {
        if (downloadBtn) downloadBtn.classList.add('hidden');
        if (installBtn) installBtn.classList.add('hidden');
        if (laterBtn) laterBtn.classList.add('hidden');
        if (closeBtn) closeBtn.classList.remove('hidden');
    }
}

function hideUpdateBanner() {
    const banner = document.getElementById('updateBanner');
    if (banner) {
        banner.classList.add('hidden');
    }
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

// ── Global window handlers ──
window.downloadUpdate = () => {
    ipcRenderer.invoke('download-update');
};

window.installUpdate = () => {
    ipcRenderer.invoke('install-update');
};

window.dismissUpdate = () => {
    hideUpdateBanner();
};

window.checkForUpdates = () => {
    ipcRenderer.invoke('check-for-updates');
};

module.exports = {
    setupIpcListeners
};
