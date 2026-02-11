// Utilidades de validación
const REGEX_PATTERNS = require('../../core/domain/regex-patterns');

const validateUrl = (url) => {
    const patterns = {
        youtube: {
            video: REGEX_PATTERNS.URL.YOUTUBE.VIDEO,
            playlist: REGEX_PATTERNS.URL.YOUTUBE.PLAYLIST,
            channel: REGEX_PATTERNS.URL.YOUTUBE.CHANNEL,
        },
        soundcloud: REGEX_PATTERNS.URL.SOUNDCLOUD
    };

    // Check YouTube
    const youtubeType = Object.entries(patterns.youtube).find(([_, regex]) => regex.test(url))?.[0];
    if (youtubeType) {
        return { isValid: true, type: youtubeType, platform: 'youtube' };
    }

    // Check SoundCloud
    if (patterns.soundcloud.test(url)) {
        return { isValid: true, type: 'track', platform: 'soundcloud' };
    }

    return { isValid: false, type: null, platform: null };
};

const checkFFmpeg = async () => {
    return new Promise((resolve) => {
        const { exec } = require('child_process');
        exec('ffmpeg -version', (error) => {
            resolve(!error);
        });
    });
};

module.exports = {
    validateUrl,
    checkFFmpeg
};
