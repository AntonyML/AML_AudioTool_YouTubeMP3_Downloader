// DownloadExecutor.js - Capa de Ejecución con yt-dlp
// Maneja spawning, streams, progreso y cancelación

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const DownloadPathResolver = require('./DownloadPathResolver');
const ValidationManager = require('./ValidationManager');
const YTDLP_OPTIONS = require('./domain/yt-dlp-options');
const ERROR_MESSAGES = require('./domain/error-messages');

class DownloadExecutor {
    constructor(registry, eventEmitter) {
        this.registry = registry;
        this.emitter = eventEmitter;
        this.progressThrottles = new Map();
        this.pathResolver = new DownloadPathResolver();
        this.validator = new ValidationManager();
    }

    buildOutputTemplate(outputPath) {
        // Usar ruta completa para evitar problemas con CWD
        return path.join(outputPath, this.pathResolver.outputTemplate);
    }

    buildDownloadArgs(outputTemplate, ffmpegPath, url, metadata) {
        const args = [
            YTDLP_OPTIONS.FORMAT.flag, YTDLP_OPTIONS.FORMAT.value,
            YTDLP_OPTIONS.EXTRACT_AUDIO,
            YTDLP_OPTIONS.AUDIO_FORMAT.flag, YTDLP_OPTIONS.AUDIO_FORMAT.value,
            YTDLP_OPTIONS.AUDIO_QUALITY.flag, YTDLP_OPTIONS.AUDIO_QUALITY.value,
            YTDLP_OPTIONS.RESTRICT_FILENAMES,
            YTDLP_OPTIONS.TRIM_FILENAMES.flag, YTDLP_OPTIONS.TRIM_FILENAMES.value,
            YTDLP_OPTIONS.NEWLINE,
            YTDLP_OPTIONS.NO_MTIME,
            YTDLP_OPTIONS.WINDOWS_FILENAMES,
            YTDLP_OPTIONS.USER_AGENT.flag, YTDLP_OPTIONS.USER_AGENT.value,
            YTDLP_OPTIONS.EXTRACTOR_ARGS.flag, YTDLP_OPTIONS.EXTRACTOR_ARGS.value,
            YTDLP_OPTIONS.NO_CHECK_CERTIFICATE,
            YTDLP_OPTIONS.PREFER_FREE_FORMATS,
            YTDLP_OPTIONS.NO_WARNINGS,
            YTDLP_OPTIONS.OUTPUT_TEMPLATE.flag, outputTemplate,
            url
        ];

        if (fs.existsSync(ffmpegPath)) {
            args.splice(8, 0, YTDLP_OPTIONS.FFMPEG_LOCATION.flag, ffmpegPath);
        }

        if (metadata && !metadata.isPlaylist) {
            args.push(YTDLP_OPTIONS.NO_PLAYLIST);
        }
        
        return args;
    }

    async execute(downloadId) {
        const task = this.registry.get(downloadId);
        if (!task) {
            throw new Error(ERROR_MESSAGES.TASK_NOT_FOUND);
        }

        // Validaciones antes de ejecutar
        const validationResult = await this.validator.validateBeforeExecute(this.pathResolver, this.registry, downloadId);
        if (!validationResult) {
            const summary = this.validator.getValidationSummary();
            const errorMessage = summary.errors.join('; ');
            this.emitter.emit('download-error', {
                downloadId,
                error: errorMessage
            });
            throw new Error(errorMessage);
        }

        // Asegurar que el directorio de salida existe
        if (!fs.existsSync(task.outputPath)) {
            fs.mkdirSync(task.outputPath, { recursive: true });
        }

        // Si la validación marcó como ALREADY_EXISTS, resolver exitosamente
        if (task.state === 'ALREADY_EXISTS') {
            this.emitter.emit('download-progress', {
                downloadId,
                progress: 100
            });
            return;
        }

        return new Promise((resolve, reject) => {
            const outputTemplate = this.buildOutputTemplate(task.outputPath);
            const ffmpegPath = path.join(__dirname, '..', '..', 'ffmpeg.exe');
            const args = this.buildDownloadArgs(outputTemplate, ffmpegPath, task.url, task.metadata);

            const ytdlp = spawn('yt-dlp', args, {
                stdio: ['ignore', 'pipe', 'pipe']
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
                this.emitter.emit('download-error', {
                    downloadId,
                    error: error.message
                });
                reject(error);
            });

            ytdlp.on('close', (code) => {
                const task = this.registry.get(downloadId);
                
                if (code === 0) {
                    this.registry.updateProgress(downloadId, 100);
                    this.emitter.emit('download-progress', {
                        downloadId,
                        progress: 100
                    });
                    resolve();
                } else if (task && task.state === 'CANCELLING') {
                    resolve();
                } else {
                    let errorMessage = stderr || `Process exited with code ${code}`;
                    
                    if (stderr.includes('Signature extraction failed') || 
                        stderr.includes('HTTP Error 403') ||
                        stderr.includes('SSAP') ||
                        stderr.includes('downloaded file is empty')) {
                        errorMessage = 'YouTube bloqueado - Actualizar yt-dlp: https://github.com/yt-dlp/yt-dlp/releases';
                    }
                    
                    this.emitter.emit('download-error', {
                        downloadId,
                        error: errorMessage
                    });
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
                    
                    this.emitter.emit('download-progress', {
                        downloadId,
                        progress
                    });
                    
                    this.progressThrottles.set(downloadId, {
                        lastProgress: progress,
                        lastUpdate: Date.now()
                    });
                }
            }

            this.emitter.emit('download-output', {
                downloadId,
                line: line.trim()
            });
        }
    }

    shouldUpdateProgress(downloadId, newProgress) {
        const throttle = this.progressThrottles.get(downloadId);
        
        if (!throttle) {
            return true;
        }

        const timeDiff = Date.now() - throttle.lastUpdate;
        const progressDiff = Math.abs(newProgress - throttle.lastProgress);
        
        if (timeDiff < 1000) {
            return progressDiff >= 5;
        }
        
        if (timeDiff >= 5000) {
            return true;
        }
        
        return progressDiff >= 2;
    }

    cancel(downloadId) {
        const task = this.registry.get(downloadId);
        if (!task || !task.process) {
            return false;
        }

        try {
            this.progressThrottles.delete(downloadId);
            
            task.process.kill('SIGTERM');
            
            setTimeout(() => {
                if (task.process && !task.process.killed) {
                    task.process.kill('SIGKILL');
                }
            }, 3000);

            return true;
        } catch (error) {
            console.error(`Failed to cancel download ${downloadId}:`, error);
            return false;
        }
    }
}

module.exports = DownloadExecutor;
