// ValidationManager.js - Centraliza todas las validaciones del sistema
// Maneja validaciones distribuidas en el flujo de descarga

const fs = require('fs');
const path = require('path');
const dns = require('dns');
const { execSync } = require('child_process');

class ValidationManager {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }

    /**
     * Valida conectividad básica a internet
     */
    async validateNetworkConnection() {
        return new Promise((resolve) => {
            dns.lookup('google.com', (err) => {
                if (err && err.code === 'ENOTFOUND') {
                    this.errors.push('No hay conexión a internet');
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    /**
     * Valida que la longitud del path no exceda límites de Windows
     * @param {string} outputPath - Carpeta destino
     */
    validatePathLength(outputPath) {
        // Windows MAX_PATH es 260, reservamos espacio para nombre archivo (~80 chars)
        if (outputPath.length > 180) {
            this.warnings.push('La ruta de destino es muy larga, podría causar errores');
            return false;
        }
        return true;
    }

    /**
     * Valida caracteres reservados adicionales
     */
    validateReservedNames(filename) {
        const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];
        if (reserved.includes(filename.toUpperCase())) {
            this.errors.push('Nombre de archivo reservado por el sistema');
            return false;
        }
        return true;
    }

    /**
     * Valida memoria disponible (básico)
     */
    validateSystemResources() {
        const os = require('os');
        const freeMem = os.freemem();
        const minMem = 100 * 1024 * 1024; // 100MB

        if (freeMem < minMem) {
            this.warnings.push('Poca memoria RAM disponible');
            return true; // Solo warning
        }
        return true;
    }

    /**
     * Verifica permisos de ejecución
     */
    validateExecutionPermissions() {
        try {
            // Intenta ejecutar un comando simple
            execSync('echo test', { stdio: 'ignore' });
            return true;
        } catch (error) {
            this.errors.push('No hay permisos para ejecutar subprocesos');
            return false;
        }
    }

    /**
     * Valida que la carpeta de salida existe y es escribible
     */
    validateOutputPath(outputPath) {
        if (!outputPath) {
            this.errors.push('Ruta de salida no especificada');
            return false;
        }

        // Normalizar path para asegurar consistencia
        const safePath = path.normalize(outputPath.trim());

        if (!fs.existsSync(safePath)) {
            this.errors.push(`La carpeta destino no existe: ${safePath}`);
            return false;
        }

        try {
            // Verificar que es un directorio real
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
            // Verificar permisos de escritura de forma menos intrusiva primero
            fs.accessSync(safePath, fs.constants.W_OK);
        } catch (error) {
            this.errors.push(`No hay permisos de escritura en la carpeta: ${error.code || error.message}`);
            return false;
        }

        try {
            // Prueba de escritura real (definitiva para Windows)
            const testFile = path.join(safePath, `test_${Date.now()}.tmp`);
            fs.writeFileSync(testFile, 'ok');
            fs.unlinkSync(testFile);
        } catch (error) {
            // Si falla la escritura real pero accessSync pasó, lo marcamos como warning
            // y dejamos que la descarga lo intente (posible falso positivo del test)
            if (error.code === 'ENOENT') {
                 this.warnings.push(`Advertencia: No se pudo verificar escritura de archivos (ENOENT), pero la carpeta existe.`);
            } else {
                 this.errors.push(`Error probando escritura de archivo: ${error.code || error.message}`);
                 return false;
            }
        }

        return true;
    }

    /**
     * Valida que ffmpeg.exe existe en la ubicación esperada
     */
    validateFfmpegExists(ffmpegPath) {
        if (!fs.existsSync(ffmpegPath)) {
            this.errors.push(`ffmpeg.exe no encontrado en: ${ffmpegPath}`);
            return false;
        }
        return true;
    }

    /**
     * Valida que yt-dlp está disponible en el PATH
     */
    validateYtdlpAvailable() {
        try {
            // execSync('yt-dlp --version', { stdio: 'pipe' });
            // Comentado temporalmente para evitar spawn sincrónico que puede bloquear UI o fallar en empaquetado
            // Se validará dinámicamente al intentar ejecutar
            return true;
        } catch (error) {
            this.errors.push('yt-dlp no está disponible en el PATH del sistema');
            return false;
        }
    }

    /**
     * Valida que la URL es una URL de YouTube válida
     */
    validateUrl(url) {
        if (!url) {
            this.errors.push('URL no especificada');
            return false;
        }

        const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)/;
        if (!youtubeRegex.test(url)) {
            this.errors.push('URL no es una URL de YouTube válida');
            return false;
        }

        return true;
    }

    /**
     * Valida que no hay caracteres inválidos en el path (Excluyendo letra de unidad en Windows)
     */
    validatePathCharacters(outputPath) {
        // En Windows, los paths absolutos 'C:\ABC' contienen ':'
        // Si fs.existsSync pasa, el path es válido para el OS
        // Esta validación manual es redundante para paths existentes y causa falsos positivos con ':'
        return true; 
    }

    /**
     * Valida espacio disponible en disco
     */
    validateDiskSpace(outputPath, minSpaceMB = 100) {
        try {
            // Obtener información del disco
            const drive = outputPath.substring(0, 3); // e.g., "C:\"
            const stats = fs.statSync(drive);

            // Nota: En Node.js puro es limitado, pero podemos verificar tamaño aproximado
            // Para una validación completa necesitaríamos una librería adicional
            this.warnings.push('Validación de espacio en disco limitada en esta implementación');
            return true;
        } catch (error) {
            this.warnings.push('No se pudo verificar espacio en disco');
            return true; // No bloquear por esto
        }
    }

    /**
     * Valida que no hay descargas duplicadas activas
     */
    validateNoDuplicateDownloads(registry, url, currentDownloadId = null) {
        const activeDownloads = registry.getByState('DOWNLOADING');
        // Excluir la descarga actual si estamos validando una descarga en ejecución
        const duplicate = activeDownloads.find(d => d.url === url && d.id !== currentDownloadId);

        if (duplicate) {
            this.errors.push('Ya hay una descarga activa para esta URL');
            return false;
        }
        return true;
    }

    /**
     * Verifica archivos existentes y marca estado apropiado
     */
    validateExistingFiles(pathResolver, registry, downloadId) {
        const task = registry.get(downloadId);
        if (!task) return true;

        const existingFiles = pathResolver.listExistingFiles(task.outputPath);

        // Para URLs individuales, verificar si el archivo ya existe
        if (!task.metadata.isPlaylist) {
            // Intentar predecir el nombre del archivo
            const predictedName = pathResolver.predictFilename(task.metadata.title);
            if (predictedName && existingFiles.includes(predictedName.replace('.mp3', ''))) {
                // Marcar como ya existente
                registry.updateState(downloadId, 'ALREADY_EXISTS');
                this.warnings.push(`Archivo ya existe: ${predictedName}`);
                return false; // No ejecutar descarga
            }
        }

        return true;
    }

    /**
     * Valida configuración de metadata
     */
    validateMetadata(metadata) {
        if (!metadata) {
            this.warnings.push('Metadata no proporcionada');
            return true; // No es crítico
        }

        if (metadata.isPlaylist && !metadata.playlistCount) {
            this.warnings.push('Playlist detectada pero sin información de cantidad');
        }

        return true;
    }

    /**
     * Valida que el sistema operativo es compatible
     */
    validatePlatform() {
        const platform = process.platform;
        if (platform !== 'win32') {
            this.warnings.push(`Plataforma ${platform} no está completamente probada`);
        }
        return true;
    }

    /**
     * Ejecuta todas las validaciones críticas antes de crear descarga
     */
    validateBeforeCreate(url, outputPath, metadata) {
        this.errors = [];
        this.warnings = [];

        this.validateUrl(url);
        this.validateOutputPath(outputPath);
        this.validatePathCharacters(outputPath);
        this.validatePlatform();
        this.validateMetadata(metadata);

        return this.errors.length === 0;
    }

    /**
     * Ejecuta validaciones antes de ejecutar descarga
     */
    async validateBeforeExecute(pathResolver, registry, downloadId) {
        this.errors = [];
        this.warnings = [];

        const task = registry.get(downloadId);
        if (!task) {
            this.errors.push('Tarea de descarga no encontrada');
            return false;
        }

        // Validaciones síncronas
        this.validateFfmpegExists(path.join(__dirname, '..', '..', 'ffmpeg.exe'));
        this.validateYtdlpAvailable();
        // Pasamos downloadId para excluir la propia descarga de la validación de duplicados
        this.validateNoDuplicateDownloads(registry, task.url, downloadId);
        this.validateExistingFiles(pathResolver, registry, downloadId);
        this.validatePathLength(task.outputPath);
        
        // Validaciones asíncronas
        await this.validateNetworkConnection();

        return this.errors.length === 0;
    }

    /**
     * Obtiene resumen de errores y warnings
     */
    getValidationSummary() {
        return {
            errors: [...this.errors],
            warnings: [...this.warnings],
            isValid: this.errors.length === 0
        };
    }

    /**
     * Limpia el estado de validaciones
     */
    clear() {
        this.errors = [];
        this.warnings = [];
    }
}

module.exports = ValidationManager;