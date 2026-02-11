// app.js - Orquestador principal
console.log('[APP] Iniciando carga de modulos...');

const { ipcRenderer } = require('electron');
console.log('[APP] ipcRenderer cargado');

// Config
const { CONFIG } = require('./config/constants');
console.log('[APP] CONFIG cargado');

// Core
const state = require('./core/state');
console.log('[APP] state cargado');

const { setupIpcListeners } = require('./core/ipc-handlers');
console.log('[APP] ipc-handlers cargado');

// Utils
const { validateUrl, checkFFmpeg } = require('./utils/validators');
console.log('[APP] validators cargado');

// UI
const { updateConsole, clearConsole, updateSystemStatus } = require('./ui/console');
console.log('[APP] console cargado');

const { updateStats, startStatsPolling } = require('./ui/stats');
console.log('[APP] stats cargado');

const { lockUI, unlockUI } = require('./ui/ui-controls');
console.log('[APP] ui-controls cargado');

const { clearCompleted } = require('./ui/download-manager');
console.log('[APP] download-manager cargado');

const { nextPage, previousPage } = require('./ui/pagination');
console.log('[APP] pagination cargado');

const { notify } = require('./ui/notifications');
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
    
    // Habilitar UI al finalizar inicialización
    unlockUI();
});

// ==================== Funciones Auxiliares ====================
const showSoundCloudConfirmation = async () => {
    return new Promise((resolve) => {
        const confirmed = confirm('Esta URL es de SoundCloud. ¿Estás seguro de que quieres descargar desde SoundCloud?');
        resolve(confirmed);
    });
};

// ==================== Handlers Globales ====================
console.log('[APP] Definiendo window.validateUrl');
window.validateUrl = async () => {
    try {
        const urlInput = document.getElementById('urlInput');
        if (!urlInput) {
            console.error('[VALIDATE] urlInput no encontrado');
            return;
        }
        
        const url = urlInput.value.trim();
        updateConsole('Validando URL: ' + url);
        
        if (!url) {
            updateConsole('ERROR: URL vacia');
            notify.warning('Por favor ingresa una URL');
            return;
        }
        
        const { isValid, type, platform } = validateUrl(url);
        if (!isValid) {
            updateConsole('ERROR: URL invalida');
            notify.error('URL no válida. Debe ser de YouTube o SoundCloud.');
            return;
        }

        // Si es SoundCloud, pedir confirmación
        if (platform === 'soundcloud') {
            const confirmed = await showSoundCloudConfirmation();
            if (!confirmed) {
                updateConsole('Descarga de SoundCloud cancelada por el usuario');
                notify.info('Descarga cancelada');
                return;
            }
        }

        state.currentUrl = url;
        state.isPlaylist = type === 'playlist';
        
        document.getElementById('optionsSection').classList.remove('hidden');
        updateConsole('URL valida - Tipo: ' + type + ' - Plataforma: ' + platform);
        notify.success(`URL válida detectada (${type} en ${platform})`);
    } catch (error) {
        console.error('[VALIDATE] Error:', error);
        updateConsole('ERROR: ' + error.message);
        notify.error('Error al validar URL: ' + error.message);
    }
};

console.log('[APP] window.validateUrl definido:', typeof window.validateUrl);

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
        unlockUI(); // Desbloquear UI después de agregar exitosamente
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
