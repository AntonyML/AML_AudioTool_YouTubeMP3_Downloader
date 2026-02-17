// error-messages.js - Constantes para mensajes de error
// Centraliza los mensajes para facilitar mantenimiento y traducción

const ERROR_MESSAGES = {
    // Validación de URL
    URL_NOT_SPECIFIED: 'URL no especificada',
    INVALID_URL: 'URL no es una URL de YouTube o SoundCloud válida',

    // Validación de archivos
    FFMPEG_NOT_FOUND: 'FFmpeg no encontrado en la ruta esperada',
    YTDLP_NOT_AVAILABLE: 'yt-dlp no está disponible en el sistema',

    // Validación de duplicados
    DUPLICATE_DOWNLOAD: 'Ya existe una descarga para esta URL',

    // Validación de archivos existentes
    FILE_ALREADY_EXISTS: 'Archivo ya existe',

    // Validación de red
    NO_INTERNET_CONNECTION: 'No hay conexión a internet',

    // Validación de path
    PATH_TOO_LONG: 'La ruta es muy larga. Se usará soporte extendido de Windows.',

    // Errores de ejecución
    DOWNLOAD_NOT_FOUND: 'Tarea de descarga no encontrada',
    TASK_NOT_FOUND: 'Tarea de descarga no encontrada'
};

module.exports = ERROR_MESSAGES;