// Configuración y constantes de la aplicación
const CONFIG = {
    // Configuración de rendimiento
    PERFORMANCE: {
        LOW: 5,
        MEDIUM: 10,
        HIGH: 15,
        ULTRA: 20,
        DEFAULT: 20
    },
    
    // Configuración de paginación
    PAGINATION: {
        ITEMS_PER_PAGE: 5
    },
    
    // Configuración de UI
    UI: {
        UPDATE_THROTTLE_MS: 500,        // Throttle para updates de progreso
        STATS_POLLING_INTERVAL_MS: 3000, // Intervalo de actualización de stats
        ANIMATION_DURATION_MS: 300,      // Duración de animaciones
        MAX_CONSOLE_MESSAGES: 100,       // Máximo de mensajes en consola
        MAX_SYSTEM_STATUS: 5,            // Máximo de mensajes de estado
        URL_TRUNCATE_LENGTH: 60          // Longitud para truncar URLs
    },
    
    // Configuración de playlist
    PLAYLIST: {
        MAX_SIZE: 100,                   // Máximo de videos por playlist
        MAX_TOTAL_DOWNLOADS: 1000        // Máximo de descargas totales
    },
    
    // Configuración de progreso
    PROGRESS: {
        THROTTLE_THRESHOLD_PERCENT: 5,   // Actualizar si cambió >= 5%
        THROTTLE_TIME_SECONDS: 1,        // Dentro de 1 segundo
        THROTTLE_THRESHOLD_PERCENT_2: 2, // O si cambió >= 2%
        THROTTLE_TIME_SECONDS_2: 5       // Dentro de 5 segundos
    },
    
    // Estados de descarga
    DOWNLOAD_STATES: {
        CREATED: 'CREATED',
        QUEUED: 'QUEUED',
        DOWNLOADING: 'DOWNLOADING',
        CANCELLING: 'CANCELLING',
        COMPLETED: 'COMPLETED',
        ERROR: 'ERROR',
        STOPPED: 'STOPPED',
        ALREADY_EXISTS: 'ALREADY_EXISTS'
    },
    
    // Estados terminales (no se pueden cancelar)
    TERMINAL_STATES: ['COMPLETED', 'ERROR', 'STOPPED', 'ALREADY_EXISTS'],
    
    // Colores de estado
    COLORS: {
        INFO: '#888',
        SUCCESS: '#00aa00',
        ERROR: '#cc0000',
        WARNING: '#ff8800'
    },
    
    // Configuración de slots
    SLOTS: {
        COLOR_THRESHOLD_HIGH: 0.5,  // >50% = verde
        COLOR_THRESHOLD_MEDIUM: 0.25 // >25% = naranja, <25% = rojo
    }
};

// Helpers para acceso rápido
const PERFORMANCE_LEVELS = Object.values(CONFIG.PERFORMANCE).filter(v => typeof v === 'number' && v !== CONFIG.PERFORMANCE.DEFAULT);

const isTerminalState = (state) => {
    return CONFIG.TERMINAL_STATES.includes(state);
};

const getSlotColor = (available, max) => {
    if (available > max * CONFIG.SLOTS.COLOR_THRESHOLD_HIGH) return CONFIG.COLORS.SUCCESS;
    if (available > max * CONFIG.SLOTS.COLOR_THRESHOLD_MEDIUM) return CONFIG.COLORS.WARNING;
    return CONFIG.COLORS.ERROR;
};

module.exports = {
    CONFIG,
    PERFORMANCE_LEVELS,
    isTerminalState,
    getSlotColor
};
