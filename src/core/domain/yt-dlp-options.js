// yt-dlp-options.js - Constantes para argumentos de yt-dlp
// Organiza las opciones en objetos para mejor mantenibilidad

const APP_CONFIG = require('./app-config');

const YTDLP_OPTIONS = {
    // Formato de salida
    FORMAT: {
        flag: '-f',
        value: 'bestaudio/best'
    },

    // Extracción de audio
    EXTRACT_AUDIO: '-x',

    // Formato de audio
    AUDIO_FORMAT: {
        flag: '--audio-format',
        value: 'mp3'
    },

    // Calidad de audio
    AUDIO_QUALITY: {
        flag: '--audio-quality',
        value: '0'
    },

    // Restricciones de nombres de archivo
    RESTRICT_FILENAMES: '--restrict-filenames',

    // Recorte de nombres de archivo
    TRIM_FILENAMES: {
        flag: '--trim-filenames',
        value: APP_CONFIG.MAX_FILENAME_LENGTH
    },

    // Nueva línea
    NEWLINE: '--newline',

    // Sin modificación de tiempo
    NO_MTIME: '--no-mtime',

    // Nombres de archivo de Windows
    WINDOWS_FILENAMES: '--windows-filenames',

    // Agente de usuario
    USER_AGENT: {
        flag: '--user-agent',
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    },

    // Argumentos del extractor para YouTube
    EXTRACTOR_ARGS: {
        flag: '--extractor-args',
        value: 'youtube:player_client=android,web'
    },

    // Sin verificación de certificado
    NO_CHECK_CERTIFICATE: '--no-check-certificate',

    // Preferir formatos libres
    PREFER_FREE_FORMATS: '--prefer-free-formats',

    // Sin warnings
    NO_WARNINGS: '--no-warnings',

    // Template de salida
    OUTPUT_TEMPLATE: {
        flag: '-o',
        // El valor se construye dinámicamente
    },

    // Ubicación de FFmpeg
    FFMPEG_LOCATION: {
        flag: '--ffmpeg-location',
        // El valor es la ruta a ffmpeg.exe
    },

    // No playlist para videos individuales
    NO_PLAYLIST: '--no-playlist'
};

module.exports = YTDLP_OPTIONS;