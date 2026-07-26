const logger = require('./Logger');
const log = logger.child('DownloadScheduler');

class DownloadScheduler {
    constructor(registry, stateMachine, semaphore, executor, eventEmitter, staggerDelayMs = 800) {
        this.registry = registry;
        this.stateMachine = stateMachine;
        this.semaphore = semaphore;
        this.executor = executor;
        this.emitter = eventEmitter;
        this.staggerDelayMs = staggerDelayMs;
        this.running = false;

        this.emitter.on('download-finished', () => this.processQueue());
        this.emitter.on('slot-available', () => this.processQueue());

        log.info(`Inicializado: stagger=${staggerDelayMs}ms`);
    }

    enqueue(downloadId) {
        const result = this.stateMachine.transition(downloadId, 'QUEUED');
        if (!result.success) {
            log.warn(`downloadId=${downloadId}`, 'Enqueue falló:', result.error);
            return result;
        }

        this.emitter.emit('download-queued', { downloadId });
        log.info(`downloadId=${downloadId}`, 'Encolada');

        setImmediate(() => this.processQueue());

        return { success: true };
    }

    async processQueue() {
        if (this.running) return;
        this.running = true;

        try {
            while (true) {
                const available = this.semaphore.getAvailable();
                if (available === 0) {
                    log.debug('processQueue: sin slots disponibles');
                    break;
                }

                const queuedTasks = this.registry.getByState('QUEUED');
                if (queuedTasks.length === 0) break;

                const nextTask = queuedTasks[0];
                log.debug(`downloadId=${nextTask.id}`, 'Adquiriendo slot...');

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

    async startDownload(downloadId) {
        const task = this.registry.get(downloadId);
        if (!task) {
            this.semaphore.release();
            return;
        }

        await new Promise(resolve => setTimeout(resolve, this.staggerDelayMs));

        this.executor.execute(downloadId)
            .then(() => {
                const currentTask = this.registry.get(downloadId);
                if (currentTask.state !== 'ALREADY_EXISTS') {
                    this.stateMachine.transition(downloadId, 'COMPLETED');
                }
                log.info(`downloadId=${downloadId}`, 'Finalizada exitosamente');
            })
            .catch(error => {
                if (task.state === 'CANCELLING') {
                    this.stateMachine.transition(downloadId, 'STOPPED');
                    log.info(`downloadId=${downloadId}`, 'Detenida por cancelación');
                } else {
                    this.registry.setError(downloadId, error.message);
                    this.stateMachine.transition(downloadId, 'ERROR');
                    log.error(`downloadId=${downloadId}`, 'Error en descarga:', error.message);
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
            log.info(`downloadId=${downloadId}`, 'Cancelada desde cola');
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
