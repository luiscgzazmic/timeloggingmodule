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

    // Project pools
    allProjects: [],   // Full active portfolio from API
    projects: [],      // Currently in-scope (after admin filter toggle)

    rawLogs: [],
    grouped: [],
    selectedDate: date.toISOString().slice(0, 7),

    // Batch loading config
    batchIndex: 0,
    batchSize: 20,

    // Pagination (audit feed)
    pageIndex: 0,
    pageSize: 25,

    // Roles
    isSuperAdmin: false,
    adminMyOnly: false,   // Admins toggle: when true, only show PM projects

    zohoInitialized: false
});

window.TL_CONNECTION = 'projects';
window.TL_API_BASE = 'https://projectsapi.zoho.com';

// Recognized admin identifiers (matched substring, lowercased).
window.TL_ADMIN_EMAILS = [
    'financeops@zazmic',
    'federico.prats',
    'chris.hote'
];
