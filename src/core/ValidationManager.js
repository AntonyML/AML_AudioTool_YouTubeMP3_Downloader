const fs = require('fs');
const path = require('path');
const dns = require('dns');
const { execSync } = require('child_process');
const logger = require('./Logger');

const log = logger.child('ValidationManager');

class ValidationManager {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }

    async validateNetworkConnection() {
        return new Promise((resolve) => {
            dns.lookup('google.com', (err) => {
                if (err && err.code === 'ENOTFOUND') {
                    this.errors.push('No hay conexión a internet');
                    log.error('Red: no hay conexión a internet');
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    validatePathLength(outputPath) {
        if (outputPath.length > 180) {
            this.warnings.push('La ruta de destino es muy larga, podría causar errores');
            log.warn('Path largo:', outputPath.length, 'caracteres');
            return false;
        }
        return true;
    }

    validateReservedNames(filename) {
        const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];
        if (reserved.includes(filename.toUpperCase())) {
            this.errors.push('Nombre de archivo reservado por el sistema');
            return false;
        }
        return true;
    }

    validateSystemResources() {
        const os = require('os');
        const freeMem = os.freemem();
        const minMem = 100 * 1024 * 1024;

        if (freeMem < minMem) {
            this.warnings.push('Poca memoria RAM disponible');
            log.warn('RAM baja:', Math.round(freeMem / 1024 / 1024), 'MB libre');
            return true;
        }
        return true;
    }

    validateExecutionPermissions() {
        try {
            execSync('echo test', { stdio: 'ignore' });
            return true;
        } catch (error) {
            this.errors.push('No hay permisos para ejecutar subprocesos');
            log.error('Permisos de ejecución:', error.message);
            return false;
        }
    }

    validateOutputPath(outputPath) {
        if (!outputPath) {
            this.errors.push('Ruta de salida no especificada');
            return false;
        }

        const safePath = path.normalize(outputPath.trim());

        if (!fs.existsSync(safePath)) {
            this.errors.push(`La carpeta destino no existe: ${safePath}`);
            log.error('Carpeta destino no existe:', safePath);
            return false;
        }

        try {
            const stats = fs.statSync(safePath);
            if (!stats.isDirectory()) {
                this.errors.push(`La ruta seleccionada no es una carpeta válida: ${safePath}`);
                return false;
            }
        } catch (error) {
            this.errors.push(`Error verificando carpeta: ${error.message}`);
            return false;
        }

        try {
            fs.accessSync(safePath, fs.constants.W_OK);
        } catch (error) {
            this.errors.push(`No hay permisos de escritura en la carpeta: ${error.code || error.message}`);
            return false;
        }

        try {
            const testFile = path.join(safePath, `test_${Date.now()}.tmp`);
            fs.writeFileSync(testFile, 'ok');
            fs.unlinkSync(testFile);
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.warnings.push('Advertencia: No se pudo verificar escritura de archivos (ENOENT), pero la carpeta existe.');
            } else {
                this.errors.push(`Error probando escritura de archivo: ${error.code || error.message}`);
                return false;
            }
        }

        return true;
    }

    resolveFfmpegPath() {
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

    resolveYtdlpPath() {
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

    validateFfmpegExists(ffmpegPath) {
        if (ffmpegPath && fs.existsSync(ffmpegPath)) return true;
        const fromPath = this.resolveFfmpegPath();
        if (fromPath) return true;
        this.errors.push('ffmpeg.exe no encontrado. Instálalo con: winget install ffmpeg');
        log.error('ffmpeg.exe no encontrado');
        return false;
    }

    validateYtdlpAvailable() {
        try {
            execSync('yt-dlp --version', { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
            return true;
        } catch {
            this.errors.push('yt-dlp no disponible. Instálalo con: winget install yt-dlp');
            log.error('yt-dlp no disponible');
            return false;
        }
    }

    validateUrl(url) {
        if (!url) {
            this.errors.push('URL no especificada');
            return false;
        }

        const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)/;
        if (!youtubeRegex.test(url)) {
            this.errors.push('URL no es una URL de YouTube válida');
            log.warn('URL inválida:', url ? url.substring(0, 80) : 'null');
            return false;
        }

        return true;
    }

    validatePathCharacters(outputPath) {
        return true;
    }

    validateDiskSpace(outputPath, minSpaceMB = 100) {
        try {
            const drive = outputPath.substring(0, 3);
            const stats = fs.statSync(drive);
            this.warnings.push('Validación de espacio en disco limitada en esta implementación');
            return true;
        } catch (error) {
            this.warnings.push('No se pudo verificar espacio en disco');
            return true;
        }
    }

    validateNoDuplicateDownloads(registry, url, currentDownloadId = null) {
        const activeDownloads = registry.getByState('DOWNLOADING');
        const duplicate = activeDownloads.find(d => d.url === url && d.id !== currentDownloadId);

        if (duplicate) {
            this.errors.push('Ya hay una descarga activa para esta URL');
            log.warn('Descarga duplicada detectada:', url.substring(0, 80));
            return false;
        }
        return true;
    }

    validateExistingFiles(pathResolver, registry, downloadId) {
        const task = registry.get(downloadId);
        if (!task) return true;

        const format = (task.metadata && task.metadata.format) || 'mp3';
        const existingFiles = pathResolver.listExistingFiles(task.outputPath, format);

        if (!task.metadata.isPlaylist) {
            const predictedName = pathResolver.predictFilename(task.metadata.title, format);
            const ext = '.' + format;
            if (predictedName && existingFiles.includes(predictedName.replace(ext, ''))) {
                registry.updateState(downloadId, 'ALREADY_EXISTS');
                this.warnings.push(`Archivo ya existe: ${predictedName}`);
                log.info(`downloadId=${downloadId}`, 'Archivo ya existe, salteando:', predictedName);
                return false;
            }
        }

        return true;
    }

    validateMetadata(metadata) {
        if (!metadata) {
            this.warnings.push('Metadata no proporcionada');
            return true;
        }

        if (metadata.isPlaylist && !metadata.playlistCount) {
            this.warnings.push('Playlist detectada pero sin información de cantidad');
        }

        return true;
    }

    validatePlatform() {
        const platform = process.platform;
        if (platform !== 'win32') {
            this.warnings.push(`Plataforma ${platform} no está completamente probada`);
        }
        return true;
    }

    validateBeforeCreate(url, outputPath, metadata) {
        this.errors = [];
        this.warnings = [];

        this.validateUrl(url);
        this.validateOutputPath(outputPath);
        this.validatePathCharacters(outputPath);
        this.validatePlatform();
        this.validateMetadata(metadata);

        if (this.errors.length > 0) {
            log.warn('validateBeforeCreate falló:', this.errors.join('; '));
        }
        return this.errors.length === 0;
    }

    async validateBeforeExecute(pathResolver, registry, downloadId) {
        this.errors = [];
        this.warnings = [];

        const task = registry.get(downloadId);
        if (!task) {
            this.errors.push('Tarea de descarga no encontrada');
            log.error(`downloadId=${downloadId}`, 'validateBeforeExecute: tarea no encontrada');
            return false;
        }

        this.validateFfmpegExists(path.join(__dirname, '..', '..', 'ffmpeg.exe'));
        this.validateYtdlpAvailable();
        this.validateNoDuplicateDownloads(registry, task.url, downloadId);
        this.validateExistingFiles(pathResolver, registry, downloadId);
        this.validatePathLength(task.outputPath);

        await this.validateNetworkConnection();

        if (this.errors.length > 0) {
            log.warn(`downloadId=${downloadId}`, 'validateBeforeExecute falló:', this.errors.join('; '));
        }
        return this.errors.length === 0;
    }

    getValidationSummary() {
        return {
            errors: [...this.errors],
            warnings: [...this.warnings],
            isValid: this.errors.length === 0
        };
    }

    clear() {
        this.errors = [];
        this.warnings = [];
    }
}

module.exports = ValidationManager;
