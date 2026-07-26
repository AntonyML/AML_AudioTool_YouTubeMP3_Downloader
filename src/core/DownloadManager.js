const EventEmitter = require('events');
const DownloadRegistry = require('./DownloadRegistry');
const StateMachine = require('./StateMachine');
const ResourceSemaphore = require('./ResourceSemaphore');
const DownloadScheduler = require('./DownloadScheduler');
const DownloadExecutor = require('./DownloadExecutor');
const PlaylistExpander = require('./PlaylistExpander');
const ValidationManager = require('./ValidationManager');
const logger = require('./Logger');

const log = logger.child('DownloadManager');

class DownloadManager extends EventEmitter {
    constructor(config = {}) {
        super();

        const maxConcurrent = config.maxConcurrent || 5;
        const staggerDelayMs = config.staggerDelayMs || 800;

        this.registry = new DownloadRegistry();
        this.stateMachine = new StateMachine(this.registry, this);
        this.semaphore = new ResourceSemaphore(maxConcurrent);
        this.executor = new DownloadExecutor(this.registry, this);
        this.scheduler = new DownloadScheduler(
            this.registry,
            this.stateMachine,
            this.semaphore,
            this.executor,
            this,
            staggerDelayMs
        );
        this.playlistExpander = new PlaylistExpander();
        this.validator = new ValidationManager();

        this.setupEventForwarding();
        log.info(`Inicializado: maxConcurrent=${maxConcurrent}, stagger=${staggerDelayMs}ms`);
    }

    setupEventForwarding() {
        const events = [
            'state-changed',
            'download-queued',
            'download-progress',
            'download-finished',
            'download-error',
            'download-output'
        ];

        events.forEach(event => {
            this.on(event, (data) => {
                log.debug(`Evento: ${event}`, data);
            });
        });
    }

    addDownload(url, outputPath, metadata = {}) {
        if (!this.validator.validateBeforeCreate(url, outputPath, metadata)) {
            const summary = this.validator.getValidationSummary();
            log.warn('addDownload falló:', summary.errors.join('; '));
            return { success: false, error: summary.errors.join('; ') };
        }

        const downloadId = this.registry.create(url, outputPath, metadata);

        this.emit('download-created', { downloadId, url, metadata });

        const result = this.scheduler.enqueue(downloadId);

        if (!result.success) {
            this.registry.remove(downloadId);
            return { success: false, error: result.error };
        }

        log.info(`downloadId=${downloadId}`, 'addDownload OK:', url.substring(0, 80));
        return { success: true, downloadId };
    }

    getPlaylistMax() {
        const slots = this.semaphore.maxConcurrent;
        if (slots <= 3) return 50;
        if (slots <= 5) return 100;
        if (slots <= 10) return 200;
        if (slots <= 15) return 400;
        return 1000;
    }

    async addPlaylist(url, outputPath, metadata = {}) {
        try {
            const playlistMax = this.getPlaylistMax();
            this.playlistExpander.maxPlaylistSize = playlistMax;

            this.emit('playlist-expansion-started', { url });
            log.info('Expandiendo playlist:', url.substring(0, 80));

            const info = await this.playlistExpander.getPlaylistInfo(url);

            this.emit('playlist-info', {
                url,
                count: info.count,
                title: info.title
            });

            if (info.count > playlistMax) {
                log.warn('Playlist excede máximo:', info.count, '>', playlistMax);
                return {
                    success: false,
                    error: `Playlist demasiado grande: ${info.count} videos (max ${playlistMax})`
                };
            }

            const videos = await this.playlistExpander.expandPlaylist(url);

            this.emit('playlist-expanded', {
                url,
                videoCount: videos.length
            });

            const downloadIds = [];
            for (const video of videos) {
                const videoMetadata = {
                    ...metadata,
                    isPlaylist: false,
                    playlistUrl: url,
                    playlistTitle: info.title,
                    videoTitle: video.title
                };

                const result = this.addDownload(video.url, outputPath, videoMetadata);
                if (result.success) {
                    downloadIds.push(result.downloadId);
                }
            }

            log.info(`Playlist "${info.title}": ${downloadIds.length}/${videos.length} videos agregados`);
            return {
                success: true,
                playlistTitle: info.title,
                videoCount: videos.length,
                downloadIds
            };

        } catch (error) {
            this.emit('playlist-error', { url, error: error.message });
            log.error('Error expandiendo playlist:', error.message);
            return {
                success: false,
                error: `Error expandiendo playlist: ${error.message}`
            };
        }
    }

    cancelDownload(downloadId) {
        return this.scheduler.cancel(downloadId);
    }

    getDownload(downloadId) {
        return this.registry.get(downloadId);
    }

    getAllDownloads() {
        return this.registry.getAll();
    }

    getStats() {
        return {
            registry: this.registry.getStats(),
            queue: this.scheduler.getQueueInfo(),
            semaphore: this.semaphore.getStats()
        };
    }

    setMaxConcurrent(maxConcurrent) {
        const stats = this.registry.getStats();

        if (stats.active > 0 || stats.queued > 0) {
            log.warn('Rechazado cambio maxConcurrent:', 'descargas activas');
            throw new Error('No se puede cambiar maxConcurrent con descargas activas');
        }

        this.semaphore.setMaxConcurrent(maxConcurrent);
        log.info('maxConcurrent cambiado a:', maxConcurrent);
        this.emit('max-concurrent-changed', { maxConcurrent });
    }

    clear() {
        this.registry.clear();
        log.info('DownloadManager limpiado');
    }
}

module.exports = DownloadManager;
