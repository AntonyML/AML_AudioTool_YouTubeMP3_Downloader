const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const DownloadPathResolver = require('./DownloadPathResolver');
const ValidationManager = require('./ValidationManager');
const browserDetector = require('./BrowserDetector');
const logger = require('./Logger');

const log = logger.child('DownloadExecutor');

const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 2000,
  MAX_DELAY_MS: 8000
};

function resolveFfmpegPath() {
    const inResources = process.resourcesPath
        ? path.join(process.resourcesPath, 'ffmpeg.exe')
        : null;
    if (inResources && fs.existsSync(inResources)) return inResources;
    const devPath = path.join(__dirname, '..', '..', 'bin', 'ffmpeg.exe');
    if (fs.existsSync(devPath)) return devPath;
    try {
        execSync('ffmpeg -version', { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
        return 'ffmpeg';
    } catch {
        return null;
    }
}

function resolveYtdlpPath() {
    const inResources = process.resourcesPath
        ? path.join(process.resourcesPath, 'yt-dlp.exe')
        : null;
    if (inResources && fs.existsSync(inResources)) return inResources;
    const devPath = path.join(__dirname, '..', '..', 'bin', 'yt-dlp.exe');
    if (fs.existsSync(devPath)) return devPath;
    try {
        execSync('yt-dlp --version', { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
        return 'yt-dlp';
    } catch {
        return null;
    }
}

function isRetryableError(stderr) {
    const lower = stderr.toLowerCase();
    return lower.includes('429') ||
           lower.includes('too many requests') ||
           lower.includes('bot') ||
           lower.includes('sign in') ||
           lower.includes('temporary') ||
           lower.includes('timeout') ||
           lower.includes('connection reset') ||
           lower.includes('connection refused') ||
           lower.includes('socket') ||
           lower.includes('eof') ||
           lower.includes('unable to extract');
}

function isFatalError(stderr) {
    const lower = stderr.toLowerCase();
    return lower.includes('private video') ||
           lower.includes('video unavailable') ||
           lower.includes('this video is not available') ||
           lower.includes('copyright') ||
           lower.includes('removed by user') ||
           lower.includes('account terminated');
}

function formatErrorMessage(stderr) {
    if (isFatalError(stderr)) return 'Video no disponible (privado/borrado)';
    if (stderr.includes('Signature extraction failed') ||
        stderr.includes('HTTP Error 403') ||
        stderr.includes('SSAP') ||
        stderr.includes('downloaded file is empty')) {
        return 'YouTube bloqueado - Actualizar yt-dlp';
    }
    if (stderr.includes('database is locked') || stderr.includes('lock file')) {
        return 'Chrome/Edge abierto - Cerrá el navegador y reintentá';
    }
    return stderr || 'Error desconocido';
}

class DownloadExecutor {
    constructor(registry, eventEmitter) {
        this.registry = registry;
        this.emitter = eventEmitter;
        this.progressThrottles = new Map();
        this.pathResolver = new DownloadPathResolver();
        this.validator = new ValidationManager();
        log.info('DownloadExecutor inicializado');
    }

    buildOutputTemplate(outputPath) {
        return this.pathResolver.resolveOutputTemplate(outputPath);
    }

    buildDownloadArgs(outputTemplate, ffmpegPath, url, metadata) {
        const isMp4 = metadata && metadata.format === 'mp4';
        const cookieArgs = browserDetector.getCookieArgs();
        const args = [
            ...(isMp4
                ? ['-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]', '--merge-output-format', 'mp4']
                : ['-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '0']
            ),
            '--restrict-filenames',
            '--trim-filenames', '100',
            '--newline',
            '--no-mtime',
            '--windows-filenames',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            '--extractor-args', 'youtube:player_client=android,web',
            '--no-check-certificate',
            '--prefer-free-formats',
            '--no-warnings',
            '--socket-timeout', '30',
            '--retries', '3',
            '--fragment-retries', '3',
            '--limit-rate', '50M',
            ...cookieArgs,
            '-o', outputTemplate,
            url
        ];

        if (fs.existsSync(ffmpegPath)) {
            args.push('--ffmpeg-location', ffmpegPath);
        }

        if (metadata && !metadata.isPlaylist) {
            args.push('--no-playlist');
        }

        return args;
    }

    async execute(downloadId) {
        const task = this.registry.get(downloadId);
        if (!task) {
            log.error(`downloadId=${downloadId}`, 'execute falló: download no encontrado');
            throw new Error('Download not found');
        }

        const validationResult = await this.validator.validateBeforeExecute(this.pathResolver, this.registry, downloadId);
        if (!validationResult) {
            const summary = this.validator.getValidationSummary();
            log.error(`downloadId=${downloadId}`, 'Validación falló:', summary.errors.join('; '));
            throw new Error(summary.errors.join('; '));
        }

        if (task.state === 'ALREADY_EXISTS') {
            log.info(`downloadId=${downloadId}`, 'Archivo ya existe, omitiendo');
            this.emitter.emit('download-progress', { downloadId, progress: 100 });
            return;
        }

        let lastError;
        for (let attempt = 0; attempt <= RETRY_CONFIG.MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                const delay = Math.min(
                    RETRY_CONFIG.BASE_DELAY_MS * Math.pow(2, attempt - 1),
                    RETRY_CONFIG.MAX_DELAY_MS
                );
                const jitter = delay * (0.75 + Math.random() * 0.5);
                log.info(`downloadId=${downloadId}`, `Retry ${attempt}/${RETRY_CONFIG.MAX_RETRIES} en ${Math.round(jitter)}ms:`, lastError.message);
                await new Promise(resolve => setTimeout(resolve, jitter));
            }

            try {
                log.info(`downloadId=${downloadId}`, `Intento ${attempt + 1}/${RETRY_CONFIG.MAX_RETRIES + 1}`);
                return await this._executeOnce(downloadId, attempt);
            } catch (error) {
                lastError = error;
                if (isFatalError(error.message)) {
                    log.error(`downloadId=${downloadId}`, 'Error fatal, sin retry:', error.message);
                    break;
                }
                if (attempt >= RETRY_CONFIG.MAX_RETRIES) {
                    log.error(`downloadId=${downloadId}`, `Agotados ${RETRY_CONFIG.MAX_RETRIES} retries. Error final:`, error.message);
                    break;
                }
                log.warn(`downloadId=${downloadId}`, `Error retryable (intento ${attempt + 1}):`, error.message);
            }
        }

        throw lastError;
    }

    _executeOnce(downloadId, attempt) {
        const task = this.registry.get(downloadId);
        if (!task) throw new Error('Download not found');

        return new Promise((resolve, reject) => {
            const outputTemplate = this.buildOutputTemplate(task.outputPath);
            const ffmpegPath = resolveFfmpegPath();
            const args = this.buildDownloadArgs(outputTemplate, ffmpegPath, task.url, task.metadata);

            const ytDlpCmd = resolveYtdlpPath() || 'yt-dlp';
            log.info(`downloadId=${downloadId}`, `Spawning: ${ytDlpCmd}`, args.filter(a => !a.startsWith('--cookies')).join(' '));

            const ytdlp = spawn(ytDlpCmd, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                cwd: task.outputPath
            });

            this.registry.setProcess(downloadId, ytdlp);

            let stderr = '';

            ytdlp.stdout.on('data', (data) => {
                this.handleOutput(downloadId, data.toString());
            });

            ytdlp.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ytdlp.on('error', (error) => {
                log.error(`downloadId=${downloadId}`, 'Spawn error:', error.message);
                reject(error);
            });

            ytdlp.on('close', (code) => {
                const task = this.registry.get(downloadId);

                if (code === 0) {
                    this.registry.updateProgress(downloadId, 100);
                    this.emitter.emit('download-progress', { downloadId, progress: 100 });
                    log.info(`downloadId=${downloadId}`, 'Completado exitosamente');
                    resolve();
                } else if (task && task.state === 'CANCELLING') {
                    log.info(`downloadId=${downloadId}`, 'Cancelado por usuario');
                    resolve();
                } else {
                    const errorMessage = formatErrorMessage(stderr || `Process exited with code ${code}`);
                    log.error(`downloadId=${downloadId}`, `Código ${code}:`, errorMessage);
                    reject(new Error(errorMessage));
                }
            });
        });
    }

    handleOutput(downloadId, output) {
        const lines = output.split('\n');
        for (const line of lines) {
            const progressMatch = line.match(/(\d+\.\d+)%/);
            if (progressMatch) {
                const progress = parseFloat(progressMatch[1]);
                if (this.shouldUpdateProgress(downloadId, progress)) {
                    this.registry.updateProgress(downloadId, progress);
                    this.emitter.emit('download-progress', { downloadId, progress });
                    this.progressThrottles.set(downloadId, {
                        lastProgress: progress,
                        lastUpdate: Date.now()
                    });
                }
            }
        }
    }

    shouldUpdateProgress(downloadId, newProgress) {
        const throttle = this.progressThrottles.get(downloadId);
        if (!throttle) return true;
        const timeDiff = Date.now() - throttle.lastUpdate;
        const progressDiff = Math.abs(newProgress - throttle.lastProgress);
        if (timeDiff < 1000) return progressDiff >= 5;
        if (timeDiff >= 5000) return true;
        return progressDiff >= 2;
    }

    cancel(downloadId) {
        const task = this.registry.get(downloadId);
        if (!task || !task.process) {
            log.warn(`downloadId=${downloadId}`, 'cancel falló: sin process');
            return false;
        }
        try {
            this.progressThrottles.delete(downloadId);
            task.process.kill('SIGTERM');
            log.info(`downloadId=${downloadId}`, 'SIGTERM enviado');
            setTimeout(() => {
                if (task.process && !task.process.killed) {
                    task.process.kill('SIGKILL');
                    log.info(`downloadId=${downloadId}`, 'SIGKILL enviado (timeout 3s)');
                }
            }, 3000);
            return true;
        } catch (error) {
            log.error(`downloadId=${downloadId}`, 'Error en cancel:', error.message);
            return false;
        }
    }
}

module.exports = DownloadExecutor;
