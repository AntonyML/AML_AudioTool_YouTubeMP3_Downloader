// Gestión de descargas en UI
const state = require('../core/state');
const { truncateUrl } = require('../utils/helpers');
const { updatePagination } = require('./pagination');
const { notify } = require('./notifications');
const { CONFIG, isTerminalState } = require('../config/constants');

const shouldShowDownload = (downloadId) => {
    const index = state.allDownloadIds.indexOf(downloadId);
    return index >= state.visibleRange.start && index < state.visibleRange.end;
};

const addDownloadToUI = (downloadId, url, metadata) => {
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
};

const createDownloadItem = (downloadId, data) => {
    const list = document.getElementById('downloadsList');
    const emptyState = list.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    const item = document.createElement('div');
    item.className = 'download-item';
    item.id = `download-${downloadId}`;
    item.dataset.id = downloadId;
    
    const isTerminal = isTerminalState(data.state);
    const cancelButton = isTerminal ? '' : `
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
};

const updateDownloadItemThrottled = (downloadId, updates) => {
    const throttle = state.uiUpdateThrottle.get(downloadId);
    const now = Date.now();
    
    if (throttle && throttle.timeoutId) {
        clearTimeout(throttle.timeoutId);
    }
    
    if (!throttle || (now - throttle.lastUpdate) >= CONFIG.UI.UPDATE_THROTTLE_MS) {
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
        }, CONFIG.UI.UPDATE_THROTTLE_MS);
        
        state.uiUpdateThrottle.set(downloadId, {
            lastUpdate: throttle.lastUpdate,
            timeoutId
        });
    }
};

const updateDownloadItem = (downloadId, updates) => {
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
        
        if (isTerminalState(updates.state)) {
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
};

const renderVisibleDownloads = () => {
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
};

const updateEmptyState = () => {
    const list = document.getElementById('downloadsList');
    if (list.children.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <p>No hay descargas activas</p>
                <small>Agrega una URL para comenzar</small>
            </div>
        `;
    }
};

const clearCompleted = () => {
    const items = document.querySelectorAll('.download-item.completed, .download-item.error, .download-item.stopped, .download-item.already_exists');
    
    if (items.length === 0) {
        notify.info('No hay descargas finalizadas para limpiar');
        return;
    }

    notify.success(`${items.length} descargas limpiadas del historial`);

    const idsToRemove = [];
    items.forEach(item => {
        const downloadId = parseInt(item.dataset.id);
        idsToRemove.push(downloadId);
        
        item.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => item.remove(), CONFIG.UI.ANIMATION_DURATION_MS);
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
            const itemsPerPage = CONFIG.PAGINATION.ITEMS_PER_PAGE;
            const totalPages = Math.ceil(state.allDownloadIds.length / itemsPerPage);
            const currentPage = Math.floor(state.visibleRange.start / itemsPerPage);
            
            if (currentPage >= totalPages) {
                state.visibleRange.start = Math.max(0, (totalPages - 1) * itemsPerPage);
                state.visibleRange.end = Math.min(state.visibleRange.start + itemsPerPage, state.allDownloadIds.length);
            } else {
                state.visibleRange.end = Math.min(state.visibleRange.start + itemsPerPage, state.allDownloadIds.length);
            }
            
            renderVisibleDownloads();
        } else {
            state.visibleRange.start = 0;
            state.visibleRange.end = CONFIG.PAGINATION.ITEMS_PER_PAGE;
            updateEmptyState();
            updatePagination();
        }
    }, CONFIG.UI.ANIMATION_DURATION_MS + 50);
};

module.exports = {
    shouldShowDownload,
    addDownloadToUI,
    createDownloadItem,
    updateDownloadItemThrottled,
    updateDownloadItem,
    renderVisibleDownloads,
    updateEmptyState,
    clearCompleted
};
