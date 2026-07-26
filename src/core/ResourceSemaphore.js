const logger = require('./Logger');
const log = logger.child('ResourceSemaphore');

class ResourceSemaphore {
    constructor(maxConcurrent) {
        this.maxConcurrent = maxConcurrent;
        this.available = maxConcurrent;
        this.waiting = [];
        log.info(`Inicializado: max=${maxConcurrent}`);
    }

    async acquire() {
        if (this.available > 0) {
            this.available--;
            log.debug('Adquirido sin espera, disponible:', this.available);
            return Promise.resolve();
        }

        log.debug('Sin slots disponibles, encolando espera');
        return new Promise(resolve => {
            this.waiting.push(resolve);
        });
    }

    release() {
        if (this.waiting.length > 0) {
            const resolve = this.waiting.shift();
            log.debug('Liberado, despertando waiting (restan:', this.waiting.length, ')');
            resolve();
        } else {
            this.available = Math.min(this.available + 1, this.maxConcurrent);
            log.debug('Liberado, disponible:', this.available);
        }
    }

    getAvailable() {
        return this.available;
    }

    getWaiting() {
        return this.waiting.length;
    }

    getStats() {
        return {
            maxConcurrent: this.maxConcurrent,
            available: this.available,
            inUse: this.maxConcurrent - this.available,
            waiting: this.waiting.length
        };
    }

    setMaxConcurrent(newMax) {
        if (this.available !== this.maxConcurrent) {
            log.warn('Rechazado cambio maxConcurrent: recursos en uso');
            throw new Error('No se puede cambiar maxConcurrent con recursos en uso');
        }

        this.maxConcurrent = newMax;
        this.available = newMax;
        log.info('maxConcurrent cambiado a:', newMax);
    }
}

module.exports = ResourceSemaphore;
