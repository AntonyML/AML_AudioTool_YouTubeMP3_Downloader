const { ipcRenderer } = require('electron');

const origConsole = { log: console.log, warn: console.warn, error: console.error };

function sendToMain(level, args) {
    try {
        ipcRenderer.send('renderer-log', { level, args: args.map(a =>
            typeof a === 'object' ? (a instanceof Error ? a.stack : JSON.stringify(a)) : String(a)
        )});
    } catch {}
}

console.log = (...args) => {
    origConsole.log.apply(console, args);
    sendToMain('info', args);
};

console.warn = (...args) => {
    origConsole.warn.apply(console, args);
    sendToMain('warn', args);
};

console.error = (...args) => {
    origConsole.error.apply(console, args);
    sendToMain('error', args);
};
