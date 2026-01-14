const { ipcRenderer } = require('electron');

let state = {
    currentUrl: null,
    folder: null,
    isPlaylist: false,
    ffmpegAvailable: false,
    downloads: new Map(),
    uiUpdateThrottle: new Map(),
    visibleRange: { start: 0, end: 5 },
    allDownloadIds: []
};

const validateYouTubeUrl = (url) => {
    const patterns = {
        video: /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/,
        playlist: /^.*(youtu.be\/|list=)([^#\&\?]*).*/,
        channel: /^.*(youtube.com\/channel\/|user\/)([^#\&\?]*).*/,
    };

    const type = Object.entries(patterns).find(([_, regex]) => regex.test(url))?.[0];
    return { isValid: !!type, type };
};

const checkFFmpeg = async () => {
    return new Promise((resolve) => {
        const { exec } = require('child_process');
        exec('ffmpeg -version', (error) => {
            resolve(!error);
        });
    });
};

const updateConsole = (message) => {
    const consoleElement = document.getElementById('consoleContent');
    const timestamp = new Date().toLocaleTimeString();
    consoleElement.textContent += `[${timestamp}] ${message}\n`;
    consoleElement.scrollTop = consoleElement.scrollHeight;
};

setupIpcListeners();

document.addEventListener('DOMContentLoaded', async () => {
    updateConsole('Inicializando aplicacion...');
    state.ffmpegAvailable = await checkFFmpeg();
    
    if (!state.ffmpegAvailable) {
        updateConsole('ADVERTENCIA: FFmpeg no encontrado');
        updateSystemStatus('FFmpeg: NO DISPONIBLE', 'error');
    } else {
        updateConsole('FFmpeg disponible');
        updateSystemStatus('FFmpeg: Disponible', 'success');
    }
    
    updateConsole('Sistema de descargas concurrentes activo');
    updateConsole('Maximo: 20 descargas simultaneas');
    updateSystemStatus('Max concurrentes: 20', 'info');
    updateConsole('Aplicacion lista');
    
    updateStats();
});

function setupIpcListeners() {
    ipcRenderer.on('download-created', (event, data) => {
        addDownloadToUI(data.downloadId, data.url, data.metadata);
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

    ipcRenderer.on('download-created', (event, data) => {
        requestAnimationFrame(() => {
            addDownloadToUI(data.downloadId, data.url, data.metadata);
        });
    });
}

window.validateUrl = async () => {
    const urlInput = document.getElementById('urlInput');
    const url = urlInput.value.trim();
    
    updateConsole('Validando URL: ' + url);
    
    if (!url) {
        updateConsole('ERROR: URL vacia');
        return;
    }
    
    const { isValid, type } = validateYouTubeUrl(url);
    if (!isValid) {
        updateConsole('ERROR: URL de YouTube invalida');
        return;
    }

    state.currentUrl = url;
    state.isPlaylist = type === 'playlist';
    
    document.getElementById('optionsSection').classList.remove('hidden');
    updateConsole('URL valida - Tipo: ' + type);
};

window.changePerformance = async (slots) => {
    const stats = await ipcRenderer.invoke('get-stats');
    
    if (stats.active > 0 || stats.queued > 0) {
        alert('No puedes cambiar el rendimiento mientras hay descargas activas o en cola.\n\nEspera a que terminen todas las descargas.');
        return;
    }
    
    const result = await ipcRenderer.invoke('change-max-concurrent', { maxConcurrent: slots });
    
    if (result.success) {
        state.currentPerformance = slots;
        
        document.querySelectorAll('.perf-btn').forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.dataset.level) === slots) {
                btn.classList.add('active');
            }
        });
        
        updateConsole(`Rendimiento cambiado: ${slots} descargas simultaneas`);
        updateSystemStatus(`Max concurrentes: ${slots}`, 'success');
    } else {
        updateConsole(`ERROR: ${result.error}`);
    }
};

window.selectFolder = async () => {
    const folder = await ipcRenderer.invoke('select-folder');
    if (!folder) {
        updateConsole('Seleccion cancelada');
        return;
    }

    state.folder = folder;
    updateConsole('Carpeta: ' + folder);
    
    const folderDisplay = document.getElementById('folderPath');
    folderDisplay.textContent = folder;
    
    document.getElementById('downloadBtn').disabled = false;
};

window.startDownload = async () => {
    if (!state.currentUrl || !state.folder) {
        updateConsole('ERROR: Faltan datos');
        return;
    }
    
    if (!state.ffmpegAvailable) {
        updateConsole('ERROR: FFmpeg requerido');
        alert('FFmpeg no esta instalado');
        return;
    }

    state.waitingForFirstDownload = true;
    lockUI();
    
    const result = await ipcRenderer.invoke('add-download', {
        url: state.currentUrl,
        outputPath: state.folder,
        metadata: { 
            addedAt: new Date().toISOString(),
            isPlaylist: state.isPlaylist
        }
    });

    if (result.success) {
        if (state.isPlaylist) {
            updateConsole(`Playlist agregada: ${result.videoCount} videos`);
        } else {
            updateConsole(`Agregada: ID ${result.downloadId}`);
        }
        
        document.getElementById('urlInput').value = '';
        document.getElementById('optionsSection').classList.add('hidden');
        state.currentUrl = null;
        
        updateStats();
    } else {
        updateConsole(`ERROR: ${result.error}`);
        state.waitingForFirstDownload = false;
        unlockUI();
    }
};

window.cancelDownload = async (downloadId) => {
    const result = await ipcRenderer.invoke('cancel-download', { downloadId });
    if (result.success) {
        updateConsole(`Cancelando ${downloadId}...`);
    } else {
        updateConsole(`ERROR al cancelar: ${result.error}`);
    }
};

window.clearCompleted = () => {
    const items = document.querySelectorAll('.download-item.completed, .download-item.error, .download-item.stopped');
    
    const idsToRemove = [];
    items.forEach(item => {
        const downloadId = parseInt(item.dataset.id);
        idsToRemove.push(downloadId);
        
        item.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => item.remove(), 300);
    });
    
    setTimeout(() => {
        idsToRemove.forEach(id => {
            state.downloads.delete(id);
            const index = state.allDownloadIds.indexOf(id);
            if (index > -1) {
                state.allDownloadIds.splice(index, 1);
            }
        });
        
        if (state.allDownloadIds.length > 0) {
            const totalPages = Math.ceil(state.allDownloadIds.length / 5);
            const currentPage = Math.floor(state.visibleRange.start / 5);
            
            if (currentPage >= totalPages) {
                state.visibleRange.start = Math.max(0, (totalPages - 1) * 5);
                state.visibleRange.end = Math.min(state.visibleRange.start + 5, state.allDownloadIds.length);
            } else {
                state.visibleRange.end = Math.min(state.visibleRange.start + 5, state.allDownloadIds.length);
            }
            
            renderVisibleDownloads();
        } else {
            state.visibleRange.start = 0;
            state.visibleRange.end = 5;
            updateEmptyState();
            updatePagination();
        }
    }, 350);
};

window.clearConsole = () => {
    document.getElementById('consoleContent').textContent = '';
    updateConsole('Consola limpiada');
};

function addDownloadToUI(downloadId, url, metadata) {
    state.downloads.set(downloadId, {
        url,
        metadata,
        startTime: Date.now(),
        currentState: 'CREATED',
        currentProgress: 0
    });
    
    state.allDownloadIds.push(downloadId);
    
    if (shouldShowDownload(downloadId)) {
        createDownloadItem(downloadId, {
            url: metadata?.videoTitle || url,
            state: 'CREATED',
            progress: 0
        });
    }
    
    updatePagination();
}

function shouldShowDownload(downloadId) {
    const index = state.allDownloadIds.indexOf(downloadId);
    return index >= state.visibleRange.start && index < state.visibleRange.end;
}

function createDownloadItem(downloadId, data) {
    const list = document.getElementById('downloadsList');
    const emptyState = list.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    const item = document.createElement('div');
    item.className = 'download-item';
    item.id = `download-${downloadId}`;
    item.dataset.id = downloadId;
    
    const isTerminalState = ['COMPLETED', 'ERROR', 'STOPPED'].includes(data.state);
    const cancelButton = isTerminalState ? '' : `
        <button class="btn-cancel" onclick="cancelDownload(${downloadId})">
            Cancelar
        </button>
    `;
    
    item.innerHTML = `
        <div class="download-header">
            <div class="download-info">
                <div class="download-url">${truncateUrl(data.url)}</div>
                <span class="download-state ${data.state}">${data.state}</span>
            </div>
            <div class="download-actions">
                ${cancelButton}
            </div>
        </div>
        <div class="progress-container">
            <div class="progress-bar-item">
                <div class="progress-fill-item" style="width: ${data.progress}%"></div>
            </div>
            <div class="progress-text-item">${data.progress.toFixed(1)}%</div>
        </div>
    `;
    
    if (data.state === 'COMPLETED') {
        item.classList.add('completed');
        const progressFill = item.querySelector('.progress-fill-item');
        if (progressFill) progressFill.classList.add('completed');
    } else if (data.state === 'ERROR') {
        item.classList.add('error');
        const progressFill = item.querySelector('.progress-fill-item');
        if (progressFill) progressFill.classList.add('error');
    }
    
    list.prepend(item);
}

function updateDownloadItemThrottled(downloadId, updates) {
    const throttle = state.uiUpdateThrottle.get(downloadId);
    const now = Date.now();
    
    if (throttle && throttle.timeoutId) {
        clearTimeout(throttle.timeoutId);
    }
    
    if (!throttle || (now - throttle.lastUpdate) >= 500) {
        updateDownloadItem(downloadId, updates);
        state.uiUpdateThrottle.set(downloadId, {
            lastUpdate: now,
            timeoutId: null
        });
    } else {
        const timeoutId = setTimeout(() => {
            updateDownloadItem(downloadId, updates);
            state.uiUpdateThrottle.set(downloadId, {
                lastUpdate: Date.now(),
                timeoutId: null
            });
        }, 500);
        
        state.uiUpdateThrottle.set(downloadId, {
            lastUpdate: throttle.lastUpdate,
            timeoutId
        });
    }
}

function updateDownloadItem(downloadId, updates) {
    const item = document.getElementById(`download-${downloadId}`);
    
    if (!item && shouldShowDownload(downloadId)) {
        const downloadData = state.downloads.get(downloadId);
        if (downloadData) {
            createDownloadItem(downloadId, {
                url: downloadData.metadata?.videoTitle || downloadData.url,
                state: updates.state || 'QUEUED',
                progress: updates.progress || 0
            });
        }
        return;
    }
    
    if (!item) return;
    
    if (updates.state) {
        const stateSpan = item.querySelector('.download-state');
        stateSpan.className = `download-state ${updates.state}`;
        stateSpan.textContent = updates.state;
        
        item.className = `download-item ${updates.state.toLowerCase()}`;
        
        if (['COMPLETED', 'ERROR', 'STOPPED'].includes(updates.state)) {
            const cancelBtn = item.querySelector('.btn-cancel');
            if (cancelBtn) cancelBtn.remove();
        }
    }
    
    if (updates.progress !== undefined) {
        const progressFill = item.querySelector('.progress-fill-item');
        const progressText = item.querySelector('.progress-text-item');
        
        if (progressFill) {
            progressFill.style.width = updates.progress + '%';
            
            if (updates.progress === 100) {
                progressFill.classList.add('completed');
            }
        }
        
        if (progressText) {
            progressText.textContent = updates.progress.toFixed(1) + '%';
        }
    }
    
    if (updates.error) {
        const progressFill = item.querySelector('.progress-fill-item');
        if (progressFill) progressFill.classList.add('error');
    }
}

async function updateStats() {
    const stats = await ipcRenderer.invoke('get-stats');
    
    if (stats) {
        const active = stats.registry?.active || stats.registry?.downloading || 0;
        const queued = stats.registry?.queued || 0;
        
        document.getElementById('activeCount').textContent = active;
        document.getElementById('queueCount').textContent = queued;
        
        const available = stats.semaphore.available || 0;
        const max = stats.semaphore.maxConcurrent || 20;
        document.getElementById('slotsAvailable').textContent = 
            `${available}/${max}`;
        
        const statusColor = available > max * 0.5 ? '#00aa00' : 
                          available > max * 0.25 ? '#ff8800' : '#cc0000';
        document.getElementById('slotsAvailable').style.color = statusColor;
    }
    
    return stats;
}

function updateSystemStatus(message, type = 'info') {
    const statusList = document.getElementById('systemStatus');
    const colors = {
        info: '#888',
        success: '#00aa00',
        error: '#cc0000',
        warning: '#ff8800'
    };
    
    const status = document.createElement('div');
    status.style.color = colors[type];
    status.style.marginBottom = '5px';
    status.textContent = message;
    
    statusList.prepend(status);
    
    if (statusList.children.length > 5) {
        statusList.removeChild(statusList.lastChild);
    }
}

function updatePagination() {
    const total = state.allDownloadIds.length;
    const container = document.getElementById('downloadsList');
    
    let paginationDiv = document.getElementById('pagination-controls');
    
    if (total === 0) {
        if (paginationDiv) {
            paginationDiv.remove();
        }
        return;
    }
    
    if (!paginationDiv && total > 5) {
        paginationDiv = document.createElement('div');
        paginationDiv.id = 'pagination-controls';
        paginationDiv.className = 'pagination-controls';
        paginationDiv.innerHTML = `
            <button onclick="previousPage()" id="prevBtn" disabled>◀ Anterior</button>
            <span id="pageInfo">1-5 de ${total}</span>
            <button onclick="nextPage()" id="nextBtn">Siguiente ▶</button>
        `;
        container.parentElement.insertBefore(paginationDiv, container);
    }
    
    if (paginationDiv) {
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        const start = state.visibleRange.start + 1;
        const end = Math.min(state.visibleRange.end, total);
        
        pageInfo.textContent = `${start}-${end} de ${total}`;
        prevBtn.disabled = state.visibleRange.start === 0;
        nextBtn.disabled = state.visibleRange.end >= total;
        
        if (total <= 5) {
            paginationDiv.style.display = 'none';
        } else {
            paginationDiv.style.display = 'flex';
        }
    }
}

window.nextPage = () => {
    const total = state.allDownloadIds.length;
    if (state.visibleRange.end < total) {
        state.visibleRange.start += 5;
        state.visibleRange.end = Math.min(state.visibleRange.end + 5, total);
        renderVisibleDownloads();
    }
};

window.previousPage = () => {
    if (state.visibleRange.start > 0) {
        state.visibleRange.start = Math.max(0, state.visibleRange.start - 5);
        state.visibleRange.end = state.visibleRange.start + 5;
        renderVisibleDownloads();
    }
};

function renderVisibleDownloads() {
    const container = document.getElementById('downloadsList');
    const existingItems = container.querySelectorAll('.download-item');
    existingItems.forEach(item => item.remove());
    
    const visibleIds = state.allDownloadIds.slice(
        state.visibleRange.start, 
        state.visibleRange.end
    );
    
    for (const id of visibleIds) {
        const downloadData = state.downloads.get(id);
        if (downloadData) {
            const currentState = downloadData.currentState || 'CREATED';
            let progress = downloadData.currentProgress || 0;
            
            if (currentState === 'COMPLETED') {
                progress = 100;
            }
            
            createDownloadItem(id, {
                url: downloadData.metadata?.videoTitle || downloadData.url,
                state: currentState,
                progress: progress
            });
        }
    }
    
    updatePagination();
}

function truncateUrl(url) {
    if (url.length <= 60) return url;
    return url.substring(0, 57) + '...';
}

function updateEmptyState() {
    const list = document.getElementById('downloadsList');
    if (list.children.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <p>No hay descargas activas</p>
                <small>Agrega una URL para comenzar</small>
            </div>
        `;
    }
}

function lockUI() {
    document.querySelectorAll('.perf-btn').forEach(btn => btn.disabled = true);
    document.getElementById('urlInput').disabled = true;
    document.getElementById('validateBtn').disabled = true;
    document.getElementById('folderBtn').disabled = true;
    document.getElementById('downloadBtn').disabled = true;
    document.getElementById('downloadBtn').textContent = 'Procesando...';
}

function unlockUI() {
    document.getElementById('urlInput').disabled = false;
    document.getElementById('urlInput').value = '';
    document.getElementById('validateBtn').disabled = false;
    document.getElementById('folderBtn').disabled = false;
    document.getElementById('downloadBtn').textContent = 'Descargar MP3';
    
    updateStats().then(stats => {
        const hasActiveOrQueued = stats && (stats.registry.active > 0 || stats.registry.queued > 0);
        document.querySelectorAll('.perf-btn').forEach(btn => {
            btn.disabled = hasActiveOrQueued;
        });
    });
}

setInterval(updateStats, 3000);