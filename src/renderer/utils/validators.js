// Utilidades de validación
// Nota: Las regex se definen aquí porque el renderer no puede acceder a archivos del core

const validateUrl = (url) => {
    const patterns = {
        youtube: {
            video: /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/,
            playlist: /^.*(youtu.be\/|list=)([^#\&\?]*).*/,
            channel: /^.*(youtube.com\/channel\/|user\/)([^#\&\?]*).*/,
        },
        soundcloud: /^https?:\/\/(www\.)?soundcloud\.com\//
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
