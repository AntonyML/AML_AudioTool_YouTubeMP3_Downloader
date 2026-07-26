const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const LOG_RETENTION_DAYS = 7;

class Logger {
    constructor() {
        this._logDir = null;
        this._currentLogPath = null;
        this._stream = null;
        this._date = null;
        this._contexts = new Map();
    }

    init() {
        this._logDir = path.join(app.getPath('userData'), 'logs');
        if (!fs.existsSync(this._logDir)) {
            fs.mkdirSync(this._logDir, { recursive: true });
        }
        this._cleanOldLogs();
        this._rotateLog();
    }

    _rotateLog() {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10);
        if (this._date === dateStr && this._stream) return;

        if (this._stream) {
            try { this._stream.end(); } catch {}
        }

        this._date = dateStr;
        this._currentLogPath = path.join(this._logDir, `app-${dateStr}.log`);
        this._stream = fs.createWriteStream(this._currentLogPath, { flags: 'a', encoding: 'utf8' });
    }

    _cleanOldLogs() {
        try {
            const files = fs.readdirSync(this._logDir);
            const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
            for (const file of files) {
                if (!file.startsWith('app-') || !file.endsWith('.log')) continue;
                const filePath = path.join(this._logDir, file);
                const stat = fs.statSync(filePath);
                if (stat.isFile() && stat.mtimeMs < cutoff) {
                    fs.unlinkSync(filePath);
                }
            }
        } catch {}
    }

    _formatTimestamp() {
        const now = new Date();
        return now.toISOString().replace('T', ' ').slice(0, 19);
    }

    _stringifyArgs(args) {
        return args.map(a =>
            typeof a === 'object'
                ? (a instanceof Error ? a.stack : (a.message ? a.message : JSON.stringify(a)))
                : String(a)
        ).join(' ');
    }

    _write(level, context, ...args) {
        try {
            this._rotateLog();
            const timestamp = this._formatTimestamp();
            const ctx = context ? ` [${context}]` : '';
            const message = this._stringifyArgs(args);
            const line = `[${timestamp}]${ctx} [${level}] ${message}\n`;
            this._stream.write(line);
        } catch {}
    }

    info(context, ...args)       { this._write('INFO', context, ...args); }
    warn(context, ...args)       { this._write('WARN', context, ...args); }
    error(context, ...args)      { this._write('ERROR', context, ...args); }
    debug(context, ...args)      { this._write('DEBUG', context, ...args); }

    child(context) {
        return {
            info:  (...args) => this.info(context, ...args),
            warn:  (...args) => this.warn(context, ...args),
            error: (...args) => this.error(context, ...args),
            debug: (...args) => this.debug(context, ...args)
        };
    }

    getLogPath()  { return this._currentLogPath; }
    getLogDir()   { return this._logDir; }

    close() {
        if (this._stream) {
            try { this._stream.end(); } catch {}
            this._stream = null;
        }
    }
}

module.exports = new Logger();
