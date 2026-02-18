// Slim left menu component (debug-only)
// - Inserts a slim left menu into `.main-content`
// - Collapsed shows only an SVG icon; expanded shows title + subtitle
// - Clicking title/subtitle prints to console and uses the app's `notify` to show toasts

const initSlimMenu = ({ title = 'Debug: Menú Izquierdo', subtitle = 'Subtítulo de prueba' } = {}) => {
    if (document.getElementById('slimMenu')) return; // already initialized

    const mainContent = document.querySelector('.main-content');
    if (!mainContent) {
        console.warn('[slim-menu] .main-content no encontrado');
        return;
    }

    const nav = document.createElement('nav');
    nav.id = 'slimMenu';
    nav.className = 'slim-menu collapsed';

    nav.innerHTML = `
        <button class="menu-toggle" title="Abrir menú" aria-expanded="false">
            <!-- simple SVG icon (music / list) -->
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M3 10h2v7H3zM7 7h2v10H7zM11 4h2v13h-2zM15 2h2v15h-2zM19 5h2v12h-2z" />
            </svg>
        </button>
        <div class="menu-content">
            <div class="menu-title" id="slimMenuTitle">${title}</div>
            <div class="menu-subtitle" id="slimMenuSubtitle">${subtitle}</div>
        </div>
    `;

    // Insert as first child of .main-content so it sits left of control panel
    mainContent.insertBefore(nav, mainContent.firstChild);

    const toggleBtn = nav.querySelector('.menu-toggle');
    const titleEl = nav.querySelector('#slimMenuTitle');
    const subtitleEl = nav.querySelector('#slimMenuSubtitle');

    let lockedOpen = false; // user toggled open/close state

    const setExpanded = (expanded) => {
        nav.classList.toggle('expanded', expanded);
        nav.classList.toggle('collapsed', !expanded);
        toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    };

    toggleBtn.addEventListener('click', () => {
        lockedOpen = !nav.classList.contains('expanded');
        setExpanded(lockedOpen);
    });

    // temporary hover expand unless user explicitly toggled
    nav.addEventListener('mouseenter', () => { if (!lockedOpen) setExpanded(true); });
    nav.addEventListener('mouseleave', () => { if (!lockedOpen) setExpanded(false); });

    titleEl.addEventListener('click', () => {
        console.log('[slim-menu] Título clickeado:', title);
        try {
            const { notify } = require('./notifications');
            notify.success(`Título: ${title}`);
        } catch (err) {
            // silent fallback for tests
        }
    });

    subtitleEl.addEventListener('click', () => {
        console.log('[slim-menu] Subtítulo clickeado:', subtitle);
        try {
            const { notify } = require('./notifications');
            notify.info(`Subtítulo: ${subtitle}`);
        } catch (err) {
            // silent fallback for tests
        }
    });

    console.log('[slim-menu] inicializado — Título y subtítulo listos para depuración');
};

module.exports = { initSlimMenu };