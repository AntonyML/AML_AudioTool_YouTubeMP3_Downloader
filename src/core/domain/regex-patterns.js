// regex-patterns.js - Patrones regex centralizados
// Para validación de URLs y otros

const REGEX_PATTERNS = {
    URL: {
        YOUTUBE: {
            VIDEO: /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/,
            PLAYLIST: /^.*(youtu.be\/|list=)([^#\&\?]*).*/,
            CHANNEL: /^.*(youtube.com\/channel\/|user\/)([^#\&\?]*).*/,
            MUSIC: /^.*music\.youtube\.com\/watch\?v=/
        },
        SOUNDCLOUD: /^https?:\/\/(www\.)?soundcloud\.com\//
    }
};

module.exports = REGEX_PATTERNS;