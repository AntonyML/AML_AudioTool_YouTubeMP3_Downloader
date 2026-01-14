// DownloadRegistry.js - Registro Central en Memoria
// Fuente única de verdad para todas las descargas

class DownloadRegistry {
    constructor() {
        this.downloads = new Map();
        this.nextId = 1;
    }

    create(url, outputPath, metadata = {}) {
        const id = this.nextId++;
        const task = {
            id,
            url,
            outputPath,
            metadata,
            state: 'CREATED',
            progress: 0,
            error: null,
            process: null,
            createdAt: Date.now(),
            startedAt: null,
            finishedAt: null
        };
        
        this.downloads.set(id, task);
        return id;
    }

    get(id) {
        return this.downloads.get(id);
    }

    getAll() {
        return Array.from(this.downloads.values());
    }

    getByState(state) {
        return Array.from(this.downloads.values()).filter(d => d.state === state);
    }

    exists(id) {
        return this.downloads.has(id);
    }

    updateState(id, newState) {
        const task = this.downloads.get(id);
        if (!task) return false;
        
        task.state = newState;
        
        if (newState === 'DOWNLOADING' && !task.startedAt) {
            task.startedAt = Date.now();
        }
        
        if (['COMPLETED', 'ERROR', 'STOPPED'].includes(newState)) {
            task.finishedAt = Date.now();
            task.process = null;
        }
        
        return true;
    }

    updateProgress(id, progress) {
        const task = this.downloads.get(id);
        if (!task) return false;
        task.progress = Math.min(100, Math.max(0, progress));
        return true;
    }

    setError(id, error) {
        const task = this.downloads.get(id);
        if (!task) return false;
        task.error = error;
        return true;
    }

    setProcess(id, process) {
        const task = this.downloads.get(id);
        if (!task) return false;
        task.process = process;
        return true;
    }

    remove(id) {
        const task = this.downloads.get(id);
        if (task && task.process) {
            task.process.kill();
        }
        return this.downloads.delete(id);
    }

    clear() {
        this.downloads.forEach(task => {
            if (task.process) {
                task.process.kill();
            }
        });
        this.downloads.clear();
    }

    getStats() {
        const all = this.getAll();
        return {
            total: all.length,
            created: all.filter(d => d.state === 'CREATED').length,
            queued: all.filter(d => d.state === 'QUEUED').length,
            downloading: all.filter(d => d.state === 'DOWNLOADING').length,
            completed: all.filter(d => d.state === 'COMPLETED').length,
            error: all.filter(d => d.state === 'ERROR').length,
            stopped: all.filter(d => d.state === 'STOPPED').length,
            cancelling: all.filter(d => d.state === 'CANCELLING').length
        };
    }
}

module.exports = DownloadRegistry;
