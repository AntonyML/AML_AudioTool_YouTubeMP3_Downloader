const { toast } = require('../../lib/tml-toast-notify/index');

const NOTIFICATION_CONFIG = {
    position: 'bottom-right',
    sound: true
};

const notify = {
    success: (message) => {
        toast.success(message, NOTIFICATION_CONFIG);
    },
    error: (message) => {
        toast.error(message, NOTIFICATION_CONFIG);
    },
    info: (message) => {
        toast.info(message, NOTIFICATION_CONFIG);
    },
    warning: (message) => {
        toast.warning(message, NOTIFICATION_CONFIG);
    }
};

module.exports = { notify };
