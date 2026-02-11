// download-states.js - Constantes para estados de descarga
// Centraliza los estados para evitar typos y facilitar cambios

const DOWNLOAD_STATES = {
    CREATED: 'CREATED',
    QUEUED: 'QUEUED',
    DOWNLOADING: 'DOWNLOADING',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR',
    CANCELLED: 'CANCELLED',
    CANCELLING: 'CANCELLING',
    ALREADY_EXISTS: 'ALREADY_EXISTS'
};

module.exports = DOWNLOAD_STATES;