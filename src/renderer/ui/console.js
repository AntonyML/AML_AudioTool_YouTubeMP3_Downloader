// Manejo de consola y logging
const { CONFIG } = require('../config/constants');

const updateConsole = (message) => {
    const consoleElement = document.getElementById('consoleContent');
    const timestamp = new Date().toLocaleTimeString();
    consoleElement.textContent += `[${timestamp}] ${message}\n`;
    consoleElement.scrollTop = consoleElement.scrollHeight;
};

const clearConsole = () => {
    document.getElementById('consoleContent').textContent = '';
    updateConsole('Consola limpiada');
};

const updateSystemStatus = (message, type = 'info') => {
    const statusList = document.getElementById('systemStatus');
    const colors = CONFIG.COLORS;
    
    const status = document.createElement('div');
    status.style.color = colors[type.toUpperCase()] || colors.INFO;
    status.style.marginBottom = '5px';
    status.textContent = message;
    
    statusList.prepend(status);
    
    if (statusList.children.length > CONFIG.UI.MAX_SYSTEM_STATUS) {
        statusList.removeChild(statusList.lastChild);
    }
};

module.exports = {
    updateConsole,
    clearConsole,
    updateSystemStatus
};
