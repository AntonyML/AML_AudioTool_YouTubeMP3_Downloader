// DownloadManager.js - Fachada que integra todos los componentes
// Punto de entrada único para el sistema de descargas

const EventEmitter = require('events');
const DownloadRegistry = require('./DownloadRegistry');
const StateMachine = require('./StateMachine');
const ResourceSemaphore = require('./ResourceSemaphore');
const DownloadScheduler = require('./DownloadScheduler');
const DownloadExecutor = require('./DownloadExecutor');
const PlaylistExpander = require('./PlaylistExpander');
const ValidationManager = require('./ValidationManager');

class DownloadManager extends EventEmitter {
    constructor(config = {}) {
        super();
        
        const maxConcurrent = config.maxConcurrent || 20;
        
        this.registry = new DownloadRegistry();
        this.stateMachine = new StateMachine(this.registry, this);
        this.semaphore = new ResourceSemaphore(maxConcurrent);
        this.executor = new DownloadExecutor(this.registry, this);
        this.scheduler = new DownloadScheduler(
            this.registry,
            this.stateMachine,
            this.semaphore,
            this.executor,
            this
        );
        this.playlistExpander = new PlaylistExpander(100);
        this.validator = new ValidationManager();

        this.setupEventForwarding();
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
                console.log(`[DownloadManager] ${event}:`, data);
            });
        });
    }

    addDownload(url, outputPath, metadata = {}) {
        // Validaciones iniciales antes de crear la descarga
        if (!this.validator.validateBeforeCreate(url, outputPath, metadata)) {
            const summary = this.validator.getValidationSummary();
            return { success: false, error: summary.errors.join('; ') };
        }

        const downloadId = this.registry.create(url, outputPath, metadata);
        
        const result = this.scheduler.enqueue(downloadId);
        
        if (!result.success) {
            console.error(`[DownloadManager] Failed to enqueue download ${downloadId}:`, result.error);
            this.registry.remove(downloadId);
            return { success: false, error: result.error };
        }

        console.log(`[DownloadManager] Successfully enqueued download ${downloadId}`);
        
        this.emit('download-created', { downloadId, url, metadata });
        
        return { success: true, downloadId };
    }

    async addPlaylist(url, outputPath, metadata = {}, performance = 20) {
        try {
            this.emit('playlist-expansion-started', { url });
            
            const info = await this.playlistExpander.getPlaylistInfo(url);
            
            this.emit('playlist-info', { 
                url, 
                count: info.count, 
                title: info.title 
            });

            // Calculate max playlist size based on performance
            const maxPlaylistSize = Math.floor(performance * 50); // 5->250, 10->500, 15->750, 20->1000
            
            // Set the max size in the expander
            this.playlistExpander.setMaxPlaylistSize(maxPlaylistSize);
            
            if (info.count > maxPlaylistSize) {
                return { 
                    success: false, 
                    error: `Playlist demasiado grande: ${info.count} videos (max ${maxPlaylistSize})` 
                };
            }

            const videos = await this.playlistExpander.expandPlaylist(url);
            
            this.emit('playlist-expanded', { 
                url, 
                videoCount: videos.length 
            });

            const playlistId = `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const downloadIds = [];
            for (const video of videos) {
                const videoMetadata = {
                    ...metadata,
                    isPlaylist: false,
                    playlistUrl: url,
                    playlistTitle: info.title,
                    playlistId: playlistId,
                    videoTitle: video.title
                };

                const result = this.addDownload(video.url, outputPath, videoMetadata);
                if (result.success) {
                    downloadIds.push(result.downloadId);
                }
            }

            return { 
                success: true, 
                playlistTitle: info.title,
                videoCount: videos.length,
                downloadIds 
            };

        } catch (error) {
            this.emit('playlist-error', { url, error: error.message });
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
            throw new Error('No se puede cambiar maxConcurrent con descargas activas');
        }
        
        this.semaphore.setMaxConcurrent(maxConcurrent);
        this.emit('max-concurrent-changed', { maxConcurrent });
    }

    clear() {
        this.registry.clear();
    }
}

module.exports = DownloadManager;
