// Control de UI (lock/unlock)
const state = require('../core/state');
const { updateStats } = require('./stats');

const lockUI = () => {
    document.querySelectorAll('.perf-btn').forEach(btn => btn.disabled = true);
    document.getElementById('urlInput').disabled = true;
    document.getElementById('validateBtn').disabled = true;
    document.getElementById('folderBtn').disabled = true;
    document.getElementById('downloadBtn').disabled = true;
    document.getElementById('downloadBtn').textContent = 'Procesando...';
};

const unlockUI = () => {
    document.getElementById('urlInput').disabled = false;
    document.getElementById('urlInput').value = '';
    document.getElementById('validateBtn').disabled = false;
    document.getElementById('folderBtn').disabled = false;
    document.getElementById('downloadBtn').textContent = 'Descargar MP3';
    
    // Habilitar botones de rendimiento por defecto al inicio
    document.querySelectorAll('.perf-btn').forEach(btn => {
        btn.disabled = false;
    });
    
    // Luego verificar si hay descargas activas y deshabilitar si es necesario
    updateStats().then(stats => {
        if (stats && stats.registry) {
            const hasActiveOrQueued = stats.registry.active > 0 || stats.registry.queued > 0;
            document.querySelectorAll('.perf-btn').forEach(btn => {
                btn.disabled = hasActiveOrQueued;
            });
        }
    }).catch(() => {
        // Si falla, mantener habilitados
    });
};

module.exports = {
    lockUI,
    unlockUI
};
