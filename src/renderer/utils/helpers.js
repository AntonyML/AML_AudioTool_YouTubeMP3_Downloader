// Utilidades helper
const { CONFIG } = require('../config/constants');

const truncateUrl = (url) => {
    const maxLength = CONFIG.UI.URL_TRUNCATE_LENGTH;
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
};

module.exports = {
    truncateUrl
};
