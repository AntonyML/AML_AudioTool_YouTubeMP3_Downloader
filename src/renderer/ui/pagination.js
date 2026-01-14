// Sistema de paginación (carrusel)
const state = require('../core/state');
const { CONFIG } = require('../config/constants');

const updatePagination = () => {
    const total = state.allDownloadIds.length;
    const container = document.getElementById('downloadsList');
    
    let paginationDiv = document.getElementById('pagination-controls');
    
    if (total === 0) {
        if (paginationDiv) {
            paginationDiv.remove();
        }
        return;
    }
    
    const itemsPerPage = CONFIG.PAGINATION.ITEMS_PER_PAGE;
    
    if (!paginationDiv && total > itemsPerPage) {
        paginationDiv = document.createElement('div');
        paginationDiv.id = 'pagination-controls';
        paginationDiv.className = 'pagination-controls';
        paginationDiv.innerHTML = `
            <button onclick="previousPage()" id="prevBtn" disabled>◀ Anterior</button>
            <span id="pageInfo">1-5 de ${total}</span>
            <button onclick="nextPage()" id="nextBtn">Siguiente ▶</button>
        `;
        container.parentElement.insertBefore(paginationDiv, container);
    }
    
    if (paginationDiv) {
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        const start = state.visibleRange.start + 1;
        const end = Math.min(state.visibleRange.end, total);
        
        pageInfo.textContent = `${start}-${end} de ${total}`;
        prevBtn.disabled = state.visibleRange.start === 0;
        nextBtn.disabled = state.visibleRange.end >= total;
        
        if (total <= itemsPerPage) {
            paginationDiv.style.display = 'none';
        } else {
            paginationDiv.style.display = 'flex';
        }
    }
};

const nextPage = () => {
    const total = state.allDownloadIds.length;
    const itemsPerPage = CONFIG.PAGINATION.ITEMS_PER_PAGE;
    if (state.visibleRange.end < total) {
        state.visibleRange.start += itemsPerPage;
        state.visibleRange.end = Math.min(state.visibleRange.end + itemsPerPage, total);
        const { renderVisibleDownloads } = require('./download-manager');
        renderVisibleDownloads();
    }
};

const previousPage = () => {
    const itemsPerPage = CONFIG.PAGINATION.ITEMS_PER_PAGE;
    if (state.visibleRange.start > 0) {
        state.visibleRange.start = Math.max(0, state.visibleRange.start - itemsPerPage);
        state.visibleRange.end = state.visibleRange.start + itemsPerPage;
        const { renderVisibleDownloads } = require('./download-manager');
        renderVisibleDownloads();
    }
};

module.exports = {
    updatePagination,
    nextPage,
    previousPage
};
