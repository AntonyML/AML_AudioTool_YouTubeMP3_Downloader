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
                    this.currentPlaylist = null;
                }
            }
            
            this.processQueue();
        });
        this.emitter.on('slot-available', () => this.processQueue());
    }

    enqueue(downloadId) {
        const result = this.stateMachine.transition(downloadId, 'QUEUED');
        if (!result.success) {
            return result;
        }

        const task = this.registry.get(downloadId);
        const playlistId = task.metadata?.playlistId || `single_${downloadId}`;
        
        // Agregar a la cola de playlists si no existe
        if (!this.activePlaylists.find(p => p.id === playlistId)) {
            this.activePlaylists.push({
                id: playlistId,
                downloads: []
            });
        }
        
        // Agregar la descarga a su playlist
        const playlist = this.activePlaylists.find(p => p.id === playlistId);
        playlist.downloads.push(downloadId);

        this.emitter.emit('download-queued', { downloadId });
        
        setImmediate(() => this.processQueue());
        
        return { success: true };
    }

    async processQueue() {
        if (this.running) return;
        this.running = true;

        try {
            while (true) {
                const available = this.semaphore.getAvailable();
                if (available === 0) break;

                // Si no hay playlist activa, activar la primera
                if (!this.currentPlaylist && this.activePlaylists.length > 0) {
                    this.currentPlaylist = this.activePlaylists.shift();
                }

                if (!this.currentPlaylist) break;

                // Solo procesar descargas de la playlist activa
                const queuedTasks = this.currentPlaylist.downloads
                    .map(id => this.registry.get(id))
                    .filter(task => task && task.state === 'QUEUED');

                if (queuedTasks.length === 0) {
                    // Si no hay más descargas en esta playlist, pasar a la siguiente
                    this.currentPlaylist = null;
                    continue;
                }

                const nextTask = queuedTasks[0];
                
                await this.semaphore.acquire();
                
                const transitionResult = this.stateMachine.transition(nextTask.id, 'DOWNLOADING');
                if (!transitionResult.success) {
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
