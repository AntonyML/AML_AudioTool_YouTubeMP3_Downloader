// Gestión de estadísticas en UI
const { ipcRenderer } = require('electron');
const { CONFIG, getSlotColor } = require('../config/constants');

const updateStats = async () => {
    const stats = await ipcRenderer.invoke('get-stats');
    
    if (stats) {
        const active = stats.registry?.active || stats.registry?.downloading || 0;
        const queued = stats.registry?.queued || 0;
        
        document.getElementById('activeCount').textContent = active;
        document.getElementById('queueCount').textContent = queued;
        
        const available = stats.semaphore.available || 0;
        const max = stats.semaphore.maxConcurrent || CONFIG.PERFORMANCE.DEFAULT;
        document.getElementById('slotsAvailable').textContent = 
            `${available}/${max}`;
        
        const statusColor = getSlotColor(available, max);
        document.getElementById('slotsAvailable').style.color = statusColor;
    }
    
    return stats;
};

const startStatsPolling = () => {
    setInterval(updateStats, CONFIG.UI.STATS_POLLING_INTERVAL_MS);
};

module.exports = {
    updateStats,
    startStatsPolling
};
