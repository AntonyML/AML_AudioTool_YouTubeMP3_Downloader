const path = require('path');
const fs = require('fs');
const logger = require('./Logger');

const log = logger.child('DownloadPathResolver');

class DownloadPathResolver {
    constructor() {
        this.outputTemplate = '%(title).80s.%(ext)s';
    }

    resolveOutputTemplate(outputPath) {
        return this.outputTemplate;
    }

    getFullOutputPath(outputPath, filename) {
        return path.join(outputPath, filename);
    }

    fileExists(outputPath, expectedFilename) {
        const fullPath = this.getFullOutputPath(outputPath, expectedFilename);
        return fs.existsSync(fullPath);
    }

    listExistingFiles(outputPath, format = 'mp3') {
        try {
            if (!fs.existsSync(outputPath)) return [];
            const ext = format === 'mp4' ? '.mp4' : '.mp3';
            return fs.readdirSync(outputPath)
                .filter(file => file.endsWith(ext))
                .map(file => file.replace(ext, ''));
        } catch (error) {
            log.warn('Error listando archivos en', outputPath, error.message);
            return [];
        }
    }

    predictFilename(title, format = 'mp3') {
        if (!title) return '';
        let sanitized = title
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 80);
        return sanitized + '.' + (format === 'mp4' ? 'mp4' : 'mp3');
    }
}

module.exports = DownloadPathResolver;
