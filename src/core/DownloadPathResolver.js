// DownloadPathResolver.js - Resuelve rutas de descarga con CWD teleport
// Separa la responsabilidad de manejo de paths del executor

const path = require('path');
const fs = require('fs');

class DownloadPathResolver {
    constructor() {
        // Configuración del template de salida
        this.outputTemplate = '%(title).80s.%(ext)s';
    }

    /**
     * Resuelve el template de salida para yt-dlp
     * @param {string} outputPath - Ruta completa de destino
     * @returns {string} Template relativo para yt-dlp
     */
    resolveOutputTemplate(outputPath) {
        // Para CWD teleport: solo el nombre del archivo, sin ruta completa
        return this.outputTemplate;
    }

    /**
     * Obtiene la ruta completa esperada del archivo descargado
     * @param {string} outputPath - Carpeta destino
     * @param {string} filename - Nombre del archivo generado
     * @returns {string} Ruta completa del archivo
     */
    getFullOutputPath(outputPath, filename) {
        return path.join(outputPath, filename);
    }

    /**
     * Verifica si un archivo ya existe en la ruta destino
     * @param {string} outputPath - Carpeta destino
     * @param {string} expectedFilename - Nombre esperado del archivo
     * @returns {boolean} True si existe
     */
    fileExists(outputPath, expectedFilename) {
        const fullPath = this.getFullOutputPath(outputPath, expectedFilename);
        return fs.existsSync(fullPath);
    }

    /**
     * Lista archivos existentes en la carpeta destino
     * @param {string} outputPath - Carpeta destino
     * @returns {string[]} Lista de archivos MP3 existentes
     */
    listExistingFiles(outputPath) {
        try {
            if (!fs.existsSync(outputPath)) {
                return [];
            }

            return fs.readdirSync(outputPath)
                .filter(file => file.endsWith('.mp3'))
                .map(file => file.replace('.mp3', '')); // Remover extensión para comparación
        } catch (error) {
            console.warn(`Error listando archivos en ${outputPath}:`, error.message);
            return [];
        }
    }

    /**
     * Predice el nombre del archivo basado en el título (aproximado)
     * @param {string} title - Título del video
     * @returns {string} Nombre esperado del archivo
     */
    predictFilename(title) {
        if (!title) return '';

        // Simular la sanitización de yt-dlp
        let sanitized = title
            .replace(/[^\w\s-]/g, '') // Remover caracteres especiales
            .replace(/\s+/g, '_') // Espacios a guiones bajos
            .substring(0, 80); // Limitar a 80 chars

        return sanitized + '.mp3';
    }
}

module.exports = DownloadPathResolver;