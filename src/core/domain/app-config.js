// app-config.js - Configuraciones numéricas y límites de la aplicación
// Centraliza valores que podrían cambiar

const APP_CONFIG = {
    // Límites de descarga
    MAX_CONCURRENT_DOWNLOADS: 20,

    // Validación de paths
    MAX_PATH_LENGTH_WARNING: 220, // Windows MAX_PATH es 260, advertir antes

    // Validación de disco
    MIN_DISK_SPACE_MB: 100,

    // yt-dlp template
    OUTPUT_TEMPLATE: '%(title).80s.%(ext)s',

    // Recorte de filenames
    MAX_FILENAME_LENGTH: 100,

    // Timeouts y delays
    NETWORK_TIMEOUT_MS: 5000,
    DOWNLOAD_THROTTLE_MS: 100,

    // Version bump
    VERSION_INCREMENT: 1
};

module.exports = APP_CONFIG;