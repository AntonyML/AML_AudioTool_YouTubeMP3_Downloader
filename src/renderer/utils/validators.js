// Utilidades de validación
const validateYouTubeUrl = (url) => {
    const patterns = {
        video: /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/,
        playlist: /^.*(youtu.be\/|list=)([^#\&\?]*).*/,
        channel: /^.*(youtube.com\/channel\/|user\/)([^#\&\?]*).*/,
    };

    const type = Object.entries(patterns).find(([_, regex]) => regex.test(url))?.[0];
    return { isValid: !!type, type };
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
    validateYouTubeUrl,
    checkFFmpeg
};
