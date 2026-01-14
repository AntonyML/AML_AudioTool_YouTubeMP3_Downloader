// ResourceSemaphore.js - Semáforo Contador para Control de Concurrencia
// Garantiza máximo de descargas simultáneas sin busy-waiting

class ResourceSemaphore {
    constructor(maxConcurrent) {
        this.maxConcurrent = maxConcurrent;
        this.available = maxConcurrent;
        this.waiting = [];
    }

    async acquire() {
        if (this.available > 0) {
            this.available--;
            return Promise.resolve();
        }

        return new Promise(resolve => {
            this.waiting.push(resolve);
        });
    }

    release() {
        if (this.waiting.length > 0) {
            const resolve = this.waiting.shift();
            resolve();
        } else {
            this.available = Math.min(this.available + 1, this.maxConcurrent);
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
            throw new Error('No se puede cambiar maxConcurrent con recursos en uso');
        }
        
        this.maxConcurrent = newMax;
        this.available = newMax;
    }
}

module.exports = ResourceSemaphore;
