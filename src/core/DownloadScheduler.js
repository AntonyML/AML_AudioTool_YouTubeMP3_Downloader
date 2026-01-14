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

        this.emitter.on('download-finished', () => this.processQueue());
        this.emitter.on('slot-available', () => this.processQueue());
    }

    enqueue(downloadId) {
        const result = this.stateMachine.transition(downloadId, 'QUEUED');
        if (!result.success) {
            return result;
        }

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

                const queuedTasks = this.registry.getByState('QUEUED');
                if (queuedTasks.length === 0) break;

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
                if (currentTask.state !== 'ALREADY_EXISTS') {
                    this.stateMachine.transition(downloadId, 'COMPLETED');
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

        return { success: false, error: 'Cannot cancel in current state' };
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
