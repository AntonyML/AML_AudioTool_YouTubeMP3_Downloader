// Estado global de la aplicación
const { CONFIG } = require('../config/constants');

const state = {
    currentUrl: null,
    folder: null,
    isPlaylist: false,
    ffmpegAvailable: false,
    downloads: new Map(),
    uiUpdateThrottle: new Map(),
    visibleRange: { start: 0, end: CONFIG.PAGINATION.ITEMS_PER_PAGE },
    allDownloadIds: [],
    currentPerformance: CONFIG.PERFORMANCE.DEFAULT,
    waitingForFirstDownload: false
};

module.exports = state;
