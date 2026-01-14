const { ToastManager } = require('./core/ToastManager');

// Singleton instance
const toast = new ToastManager();

module.exports = { toast };
