// Gestor principal
const { DEFAULTS } = require('../config/defaults');
const { SOUND_SRC } = require('../assets/sounds');
const { Toast } = require('./Toast');

class ToastManager {
    constructor() {
        this.container = null;
        this.audio = null;
        this.activeToasts = [];
        // Delay initialization to ensure DOM is ready
        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
            } else {
                this.init();
            }
        }
    }

    init() {
        if (typeof document === 'undefined') return;
        
        try {
            this.injectStyles();
            this.createContainer();
            this.audio = new Audio(SOUND_SRC);
            this.audio.volume = 0.5;
        } catch (e) {
            console.error('ToastManager init error:', e);
        }
    }

    injectStyles() {
        if (document.getElementById('tml-toast-styles')) return;

        // Inyección dinámica de CSS para evitar tags link manuales
        // Esto permite que la librería funcione solo con el require en JS
        const styles = [
            './src/lib/tml-toast-notify/styles/layout.css',
            './src/lib/tml-toast-notify/styles/themes.css',
            './src/lib/tml-toast-notify/styles/animations.css'
        ];

        styles.forEach(href => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        });
        
        // Marcador para no repetir
        const marker = document.createElement('meta');
        marker.id = 'tml-toast-styles';
        document.head.appendChild(marker);
    }

    createContainer() {
        if (document.querySelector('.toast-container')) return;
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', options = {}) {
        const config = { ...DEFAULTS, ...options };
        
        const toast = new Toast(message, type, config, () => {
            // Cleanup si fuera necesario
        });

        toast.show(this.container);

        if (config.sound) {
            this.playSound();
        }
    }

    playSound() {
        if (this.audio) {
            this.audio.currentTime = 0;
            this.audio.play().catch(() => {});
        }
    }

    success(msg, opts) { this.show(msg, 'success', opts); }
    error(msg, opts) { this.show(msg, 'error', opts); }
    warning(msg, opts) { this.show(msg, 'warning', opts); }
    info(msg, opts) { this.show(msg, 'info', opts); }
}

module.exports = { ToastManager };
