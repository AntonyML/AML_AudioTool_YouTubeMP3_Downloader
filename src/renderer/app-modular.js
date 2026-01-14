// app.js - Orquestador principal
console.log('[APP] Iniciando carga de modulos...');

const { ipcRenderer } = require('electron');
console.log('[APP] ipcRenderer cargado');

// Config
const { CONFIG } = require('./src/renderer/config/constants');
console.log('[APP] CONFIG cargado');

// Core
const state = require('./src/renderer/core/state');
console.log('[APP] state cargado');

const { setupIpcListeners } = require('./src/renderer/core/ipc-handlers');
console.log('[APP] ipc-handlers cargado');

// Utils
const { validateYouTubeUrl, checkFFmpeg } = require('./src/renderer/utils/validators');
console.log('[APP] validators cargado');

// UI
const { updateConsole, clearConsole, updateSystemStatus } = require('./src/renderer/ui/console');
console.log('[APP] console cargado');

const { updateStats, startStatsPolling } = require('./src/renderer/ui/stats');
console.log('[APP] stats cargado');

const { lockUI, unlockUI } = require('./src/renderer/ui/ui-controls');
console.log('[APP] ui-controls cargado');

const { clearCompleted } = require('./src/renderer/ui/download-manager');
console.log('[APP] download-manager cargado');

const { nextPage, previousPage } = require('./src/renderer/ui/pagination');
console.log('[APP] pagination cargado');

const { notify } = require('./src/renderer/ui/notifications');
console.log('[APP] notifications cargado');

console.log('[APP] Todos los modulos cargados exitosamente');

// ==================== Inicialización ====================
setupIpcListeners();
console.log('[APP] IPC listeners configurados');

document.addEventListener('DOMContentLoaded', async () => {
    updateConsole('Inicializando aplicacion...');
    state.ffmpegAvailable = await checkFFmpeg();
    
    if (!state.ffmpegAvailable) {
        updateConsole('ADVERTENCIA: FFmpeg no encontrado');
        updateSystemStatus('FFmpeg: NO DISPONIBLE', 'error');
        notify.error('FFmpeg no encontrado. Funcionalidad limitada.');
    } else {
        updateConsole('FFmpeg disponible');
        updateSystemStatus('FFmpeg: Disponible', 'success');
        // notify.success('Sistema listo - FFmpeg detectado');
    }
    
    updateConsole('Sistema de descargas concurrentes activo');
    updateConsole(`Maximo: ${CONFIG.PERFORMANCE.DEFAULT} descargas simultaneas`);
    updateSystemStatus(`Max concurrentes: ${CONFIG.PERFORMANCE.DEFAULT}`, 'info');
    updateConsole('Aplicacion lista');
    
    updateStats();
    startStatsPolling();
});

// ==================== Handlers Globales ====================
console.log('[APP] Definiendo window.validateUrl');
window.validateUrl = async () => {
    console.log('[VALIDATE] Funcion llamada');
    const urlInput = document.getElementById('urlInput');
    const url = urlInput.value.trim();
    
    console.log('[VALIDATE] URL:', url);
    updateConsole('Validando URL: ' + url);
    
    if (!url) {
        updateConsole('ERROR: URL vacia');
        notify.warning('Por favor ingresa una URL');
        return;
    }
    
    const { isValid, type } = validateYouTubeUrl(url);
    if (!isValid) {
        updateConsole('ERROR: URL de YouTube invalida');
        notify.error('URL no válida. Debe ser de YouTube.');
        return;
    }

    state.currentUrl = url;
    state.isPlaylist = type === 'playlist';
    
    document.getElementById('optionsSection').classList.remove('hidden');
    updateConsole('URL valida - Tipo: ' + type);
    notify.success(`URL válida detectada (${type})`);
};

window.changePerformance = async (slots) => {
    const stats = await ipcRenderer.invoke('get-stats');
    
    if (stats.registry.active > 0 || stats.registry.queued > 0) {
        notify.warning('No puedes cambiar el rendimiento mientras hay descargas activas.');
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
        notify.success(`Rendimiento ajustado a nivel ${slots}`);
    } else {
        updateConsole(`ERROR: ${result.error}`);
        notify.error(`Error al cambiar rendimiento: ${result.error}`);
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

// Eliminar lógica de createFolder manual (Revertir parche)

window.startDownload = async () => {
    if (!state.currentUrl || !state.folder) {
        updateConsole('ERROR: Faltan datos');
        notify.warning('Selecciona una carpeta de destino primero');
        return;
    }
    
    if (!state.ffmpegAvailable) {
        updateConsole('ERROR: FFmpeg requerido');
        notify.error('No se puede iniciar: FFmpeg no encontrado');
        return;
    }

    state.waitingForFirstDownload = true;
    lockUI();
    
    const result = await ipcRenderer.invoke('add-download', {
        url: state.currentUrl,
        outputPath: state.folder,
        metadata: { 
            addedAt: new Date().toISOString(),
            isPlaylist: state.isPlaylist,
            performance: state.currentPerformance
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

window.clearCompleted = clearCompleted;
window.clearConsole = clearConsole;
window.nextPage = nextPage;
window.previousPage = previousPage;
