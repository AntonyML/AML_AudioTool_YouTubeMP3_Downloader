// DownloadScheduler.js - Orquestador de Descargas
// Gestiona cola FIFO y controla concurrencia

class DownloadScheduler {
    constructor(registry, stateMachine, semaphore, executor, eventEmitter) {
        this.registry = registry;
        this.stateMachine = stateMachine;
        this.semaphore = semaphore;
        this.executor = executor;
        this.emitter = eventEmitter;
        this.running = false;
        
        // Cola de playlists activas (FIFO por playlist)
        this.activePlaylists = [];
        this.currentPlaylist = null;

        this.emitter.on('download-finished', (data) => {
            // Verificar si la playlist actual terminó
            if (this.currentPlaylist) {
                const activeDownloads = this.currentPlaylist.downloads.filter(id => {
                    const task = this.registry.get(id);
                    return task && !['COMPLETED', 'ERROR', 'STOPPED', 'ALREADY_EXISTS'].includes(task.state);
                });
                
                if (activeDownloads.length === 0) {
                    // Playlist terminó, activar la siguiente
                    console.log(`[DownloadScheduler] Playlist ${this.currentPlaylist.id} finished, activating next`);
                    this.currentPlaylist = null;
                }
            }
            
            this.processQueue();
        });
        this.emitter.on('slot-available', () => this.processQueue());
        
        // Forzar procesamiento inicial después de un delay
        setTimeout(() => this.processQueue(), 100);
        
        // Verificar periódicamente si hay descargas atascadas
        setInterval(() => {
            const queuedTasks = this.registry.getByState('QUEUED');
            if (queuedTasks.length > 0 && !this.running) {
                console.log(`[DownloadScheduler] Found ${queuedTasks.length} queued tasks, forcing processQueue`);
                this.processQueue();
            }
        }, 5000);
    }

    enqueue(downloadId) {
        console.log(`[DownloadScheduler] Attempting to enqueue download ${downloadId}`);
        
        const result = this.stateMachine.transition(downloadId, 'QUEUED');
        if (!result.success) {
            console.error(`[DownloadScheduler] Failed to transition ${downloadId} to QUEUED:`, result.error);
            return result;
        }

        const task = this.registry.get(downloadId);
        const playlistId = task.metadata?.playlistId || `single_${downloadId}`;
        
        console.log(`[DownloadScheduler] Download ${downloadId} belongs to playlist ${playlistId}`);
        
        // Agregar a la cola de playlists si no existe
        if (!this.activePlaylists.find(p => p.id === playlistId)) {
            this.activePlaylists.push({
                id: playlistId,
                downloads: []
            });
            console.log(`[DownloadScheduler] Created new playlist ${playlistId}`);
        }
        
        // Agregar la descarga a su playlist
        const playlist = this.activePlaylists.find(p => p.id === playlistId);
        playlist.downloads.push(downloadId);
        
        console.log(`[DownloadScheduler] Added download ${downloadId} to playlist ${playlistId}. Total downloads in playlist: ${playlist.downloads.length}`);

        this.emitter.emit('download-queued', { downloadId });
        
        setImmediate(() => this.processQueue());
        
        return { success: true };
    }

    async processQueue() {
        if (this.running) return;
        this.running = true;

        console.log(`[DownloadScheduler] Processing queue. Active playlists: ${this.activePlaylists.length}, Current playlist: ${this.currentPlaylist ? this.currentPlaylist.id : 'none'}`);

        try {
            while (true) {
                const available = this.semaphore.getAvailable();
                console.log(`[DownloadScheduler] Available slots: ${available}`);
                if (available === 0) break;

                // Si no hay playlist activa, activar la primera
                if (!this.currentPlaylist && this.activePlaylists.length > 0) {
                    this.currentPlaylist = this.activePlaylists.shift();
                    console.log(`[DownloadScheduler] Activated playlist ${this.currentPlaylist.id} with ${this.currentPlaylist.downloads.length} downloads`);
                }

                if (!this.currentPlaylist) {
                    console.log(`[DownloadScheduler] No active playlist, breaking`);
                    break;
                }

                // Solo procesar descargas de la playlist activa
                const queuedTasks = this.currentPlaylist.downloads
                    .map(id => this.registry.get(id))
                    .filter(task => task && task.state === 'QUEUED');

                console.log(`[DownloadScheduler] Found ${queuedTasks.length} queued tasks in current playlist`);

                if (queuedTasks.length === 0) {
                    // Si no hay más descargas en esta playlist, pasar a la siguiente
                    console.log(`[DownloadScheduler] No more queued tasks in playlist ${this.currentPlaylist.id}, deactivating`);
                    this.currentPlaylist = null;
                    continue;
                }

                const nextTask = queuedTasks[0];
                console.log(`[DownloadScheduler] Starting download ${nextTask.id}`);
                
                await this.semaphore.acquire();
                
                const transitionResult = this.stateMachine.transition(nextTask.id, 'DOWNLOADING');
                if (!transitionResult.success) {
                    console.error(`[DownloadScheduler] Failed to transition ${nextTask.id} to DOWNLOADING:`, transitionResult.error);
                    this.semaphore.release();
                    continue;
                }

                this.startDownload(nextTask.id);
            }
        } finally {
            this.running = false;
        }
    }

    startDownload(downloadId) {
        const task = this.registry.get(downloadId);
        if (!task) {
            this.semaphore.release();
            return;
        }

        this.executor.execute(downloadId)
            .then(() => {
                const currentTask = this.registry.get(downloadId);
                // Si ya está en estado final (ej. ALREADY_EXISTS), no forzar COMPLETED
                if (currentTask.state !== 'ALREADY_EXISTS' && currentTask.state !== 'CANCELLING') {
                    this.stateMachine.transition(downloadId, 'COMPLETED');
                } else if (currentTask.state === 'CANCELLING') {
                    this.stateMachine.transition(downloadId, 'STOPPED');
                }
            })
            .catch(error => {
                if (task.state === 'CANCELLING') {
                    this.stateMachine.transition(downloadId, 'STOPPED');
                } else {
                    this.registry.setError(downloadId, error.message);
                    this.stateMachine.transition(downloadId, 'ERROR');
                }
            })
            .finally(() => {
                this.semaphore.release();
                this.emitter.emit('download-finished', { downloadId });
            });
    }

    async cancel(downloadId) {
        const task = this.registry.get(downloadId);
        if (!task) {
            return { success: false, error: 'Download not found' };
        }

        if (task.state === 'QUEUED') {
            this.stateMachine.transition(downloadId, 'CANCELLING');
            this.stateMachine.transition(downloadId, 'STOPPED');
            return { success: true };
        }

        if (task.state === 'DOWNLOADING') {
            const result = this.stateMachine.transition(downloadId, 'CANCELLING');
            if (result.success && task.process) {
                this.executor.cancel(downloadId);
            }
            return result;
        }

        // Permitir cancelar descargas en otros estados que no sean terminales
        if (task.state === 'CREATED') {
            this.stateMachine.transition(downloadId, 'STOPPED');
            return { success: true };
        }

        return { success: false, error: `Cannot cancel in current state: ${task.state}` };
    }

    getQueueInfo() {
        return {
            queued: this.registry.getByState('QUEUED').length,
            downloading: this.registry.getByState('DOWNLOADING').length,
            semaphore: this.semaphore.getStats()
        };
    }
}

module.exports = DownloadScheduler;
