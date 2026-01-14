// Lógica individual de cada Toast
const { ICONS } = require('../assets/icons');

class Toast {
    constructor(message, type, config, onClose) {
        this.message = message;
        this.type = type;
        this.config = config;
        this.onClose = onClose;
        this.element = null;
        this.render();
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = `toast ${this.type}`;
        
        this.element.innerHTML = `
            <div class="toast-icon">${ICONS[this.type] || ICONS.info}</div>
            <div class="toast-content">
                <div class="toast-message">${this.message}</div>
            </div>
            <button class="toast-close">&times;</button>
            <div class="toast-progress">
                <div class="toast-progress-bar" style="animation-duration: ${this.config.duration}ms"></div>
            </div>
        `;

        // Event Listeners
        const closeBtn = this.element.querySelector('.toast-close');
        closeBtn.onclick = () => this.dismiss();

        // Auto dismiss
        setTimeout(() => this.dismiss(), this.config.duration);
    }

    show(container) {
        container.appendChild(this.element);
        // Force reflow
        this.element.offsetHeight;
        this.element.classList.add('show');
    }

    dismiss() {
        if (!this.element) return;
        
        this.element.classList.remove('show');
        this.element.addEventListener('transitionend', () => {
            if (this.element && this.element.parentElement) {
                this.element.remove();
            }
            if (this.onClose) this.onClose();
        });
    }
}

module.exports = { Toast };
