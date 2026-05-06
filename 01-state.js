/**
 * TIMELOGS — INFRASTRUCTURE STATE
 */

if (typeof TL === 'undefined') {
    window.TL = {};
}

const date = new Date();
date.setMonth(date.getMonth() - 1);

Object.assign(TL, {
    portalId: '858892430', // Fallback ID
    currentUser: null,
    projects: [],
    rawLogs: [],
    grouped: [],
    selectedDate: date.toISOString().slice(0, 7),

    // Configuración de Carga por Lotes
    batchIndex: 0,
    batchSize: 20,
    isSuperAdmin: false,
    zohoInitialized: false
});

window.TL_CONNECTION = 'projects';
window.TL_API_BASE = 'https://projectsapi.zoho.com';
