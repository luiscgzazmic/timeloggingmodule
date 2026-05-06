/**
 * TIMELOGS — RENDER
 */

const TL_PROJECT_TAG_LIMIT = 4;
const TL_TARGET_HOURS = 8;

// In-memory filter state for the audit feed.
TL.filter = TL.filter || { search: '', status: 'all', sort: 'date-desc' };

function tlGetFilteredGroups() {
    const q = (TL.filter.search || '').toLowerCase().trim();
    const status = TL.filter.status || 'all';

    let list = TL.grouped;
    if (q) {
        list = list.filter(g =>
            (g.user || '').toLowerCase().includes(q) ||
            Array.from(g.projects || []).some(p => p.toLowerCase().includes(q))
        );
    }
    if (status === 'pending') list = list.filter(g => g.status === 'Pending');
    else if (status === 'approved') list = list.filter(g => g.status !== 'Pending');

    if (TL.filter.sort === 'hours-desc') {
        list = list.slice().sort((a, b) => (b.totalHours || 0) - (a.totalHours || 0));
    } else if (TL.filter.sort === 'hours-asc') {
        list = list.slice().sort((a, b) => (a.totalHours || 0) - (b.totalHours || 0));
    } else if (TL.filter.sort === 'name-asc') {
        list = list.slice().sort((a, b) => (a.user || '').localeCompare(b.user || ''));
    } // default: date-desc — already sorted by aggregator

    return list;
}

function tlRender() {
    const feed = document.getElementById('tl-feed');
    if (!feed) return;

    const filtered = tlGetFilteredGroups();
    tlRenderFilterBar(filtered.length);

    if (filtered.length === 0) {
        feed.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-inner">
                    <div class="empty-icon">[ ]</div>
                    <p>${TL.grouped.length === 0 ? 'No time logs in this batch' : 'No results match your filters'}</p>
                    <small>${TL.grouped.length === 0 ? 'No timesheet entries were found for the current audit period yet.' : 'Try clearing the search or status filter.'}</small>
                </div>
            </div>`;
        tlRenderPager(0, 0);
        return;
    }

    // Pagination
    const pageSize = TL.pageSize || 25;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (TL.pageIndex >= totalPages) TL.pageIndex = totalPages - 1;
    if (TL.pageIndex < 0) TL.pageIndex = 0;
    const start = TL.pageIndex * pageSize;
    const slice = filtered.slice(start, start + pageSize);

    const fragment = document.createDocumentFragment();
    for (const g of slice) {
        fragment.appendChild(tlBuildCard(g));
    }
    feed.replaceChildren(fragment);

    tlRenderPager(filtered.length, totalPages);
}

function tlBuildCard(g) {
    const card = document.createElement('div');
    card.className = 'audit-card';
    card.dataset.key = `${g.userId}-${g.date}`;

    const isApproved = g.status !== 'Pending';
    const projects = Array.from(g.projects);
    const visible = projects.slice(0, TL_PROJECT_TAG_LIMIT);
    const overflow = projects.length - visible.length;

    const projectTagsHTML = visible
        .map(p => `<span class="project-tag" title="${tlEscape(p)}">${tlEscape(p)}</span>`)
        .join('') +
        (overflow > 0 ? `<span class="project-tag more" title="${overflow} more">+${overflow} more</span>` : '');

    const utilClass = tlUtilClass(g.totalHours);
    const utilWidth = Math.min(100, Math.round((g.totalHours / TL_TARGET_HOURS) * 100));

    card.innerHTML = `
        <div class="user-info">
            <span class="user-avatar" style="background:${tlAvatarColor(g.user)}">${tlInitials(g.user)}</span>
            <div class="user-meta">
                <span class="name">${tlEscape(g.user)}</span>
                <span class="date">${tlFormatShortDate(g.date)}</span>
            </div>
        </div>

        <div class="hours-info">
            <div class="hours-badge">${g.totalHours.toFixed(2)}<small>h</small></div>
            <div class="util-bar" title="${g.totalHours.toFixed(2)}h of ${TL_TARGET_HOURS}h target">
                <div class="util-bar-fill ${utilClass}" style="width:${utilWidth}%"></div>
            </div>
            <span class="status-pill ${isApproved ? 'approved' : ''}">${isApproved ? 'Approved' : 'Pending'}</span>
        </div>

        <div class="project-list">${projectTagsHTML}</div>

        <div class="actions">
            ${!isApproved
                ? `<button class="btn-approve" data-action="approve" data-user="${tlEscape(g.userId)}" data-date="${g.date}">Approve day</button>`
                : `<span class="approved-label">Approved</span>`}
        </div>
    `;

    const btn = card.querySelector('[data-action="approve"]');
    if (btn) {
        btn.addEventListener('click', () => {
            if (typeof tlApproveGroup === 'function') {
                tlApproveGroup(btn.dataset.user, btn.dataset.date);
            } else if (typeof tlOnApproveClick === 'function') {
                tlOnApproveClick(`${btn.dataset.user}-${btn.dataset.date}`);
            }
        });
    }

    return card;
}

function tlRenderFilterBar(filteredCount) {
    const bar = document.getElementById('tl-filter-bar');
    if (!bar) return;

    const total = TL.grouped.length;
    if (total === 0 && !TL.filter.search) {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = '';

    if (bar.dataset.built === '1') {
        // Just refresh count + active state
        const countEl = bar.querySelector('.tl-filter-count');
        if (countEl) countEl.textContent = `${filteredCount} of ${total}`;
        return;
    }

    bar.innerHTML = `
        <div class="tl-search">
            <span class="tl-search-icon">⌕</span>
            <input type="search" id="tl-search-input" class="tl-search-input"
                   placeholder="Search consultant or project..."
                   value="${tlEscape(TL.filter.search)}">
        </div>

        <div class="tl-filter-chips" role="tablist" aria-label="Status filter">
            <button class="tl-chip ${TL.filter.status === 'all' ? 'active' : ''}" data-status="all">All</button>
            <button class="tl-chip ${TL.filter.status === 'pending' ? 'active' : ''}" data-status="pending">Pending</button>
            <button class="tl-chip ${TL.filter.status === 'approved' ? 'active' : ''}" data-status="approved">Approved</button>
        </div>

        <div class="tl-sort">
            <label for="tl-sort-select">Sort</label>
            <select id="tl-sort-select" class="tl-select">
                <option value="date-desc"${TL.filter.sort === 'date-desc' ? ' selected' : ''}>Most recent</option>
                <option value="hours-desc"${TL.filter.sort === 'hours-desc' ? ' selected' : ''}>Hours (high → low)</option>
                <option value="hours-asc"${TL.filter.sort === 'hours-asc' ? ' selected' : ''}>Hours (low → high)</option>
                <option value="name-asc"${TL.filter.sort === 'name-asc' ? ' selected' : ''}>Consultant (A → Z)</option>
            </select>
        </div>

        <span class="tl-filter-count">${filteredCount} of ${total}</span>
    `;
    bar.dataset.built = '1';

    const search = bar.querySelector('#tl-search-input');
    const debounced = tlDebounce((v) => {
        TL.filter.search = v;
        TL.pageIndex = 0;
        tlRender();
    }, 150);
    search.addEventListener('input', (e) => debounced(e.target.value));

    bar.querySelectorAll('.tl-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            TL.filter.status = chip.dataset.status;
            TL.pageIndex = 0;
            bar.querySelectorAll('.tl-chip').forEach(c => c.classList.toggle('active', c === chip));
            tlRender();
        });
    });

    bar.querySelector('#tl-sort-select').addEventListener('change', (e) => {
        TL.filter.sort = e.target.value;
        TL.pageIndex = 0;
        tlRender();
    });
}

function tlRenderPager(totalItems, totalPages) {
    const pager = document.getElementById('tl-pager');
    if (!pager) return;

    if (totalItems === 0 || totalPages <= 1) {
        pager.innerHTML = '';
        pager.style.display = totalItems === 0 ? 'none' : '';
        if (totalItems > 0 && totalPages <= 1) {
            pager.innerHTML = `<span class="tl-pager-info">Showing ${totalItems} item${totalItems === 1 ? '' : 's'}</span>`;
        }
        return;
    }
    pager.style.display = '';

    const pageSize = TL.pageSize || 25;
    const start = TL.pageIndex * pageSize + 1;
    const end = Math.min(totalItems, start + pageSize - 1);

    pager.innerHTML = `
        <div class="tl-pager-info">${start}–${end} of ${totalItems}</div>
        <div class="tl-pager-controls">
            <label class="tl-pager-size">
                <span>Items per page</span>
                <select id="tl-pager-size-select" class="tl-select">
                    <option value="10"${pageSize === 10 ? ' selected' : ''}>10</option>
                    <option value="25"${pageSize === 25 ? ' selected' : ''}>25</option>
                    <option value="50"${pageSize === 50 ? ' selected' : ''}>50</option>
                    <option value="100"${pageSize === 100 ? ' selected' : ''}>100</option>
                </select>
            </label>
            <button class="tl-pager-btn" data-action="prev" ${TL.pageIndex === 0 ? 'disabled' : ''} aria-label="Previous page">‹</button>
            <span class="tl-pager-pos">Page ${TL.pageIndex + 1} of ${totalPages}</span>
            <button class="tl-pager-btn" data-action="next" ${TL.pageIndex >= totalPages - 1 ? 'disabled' : ''} aria-label="Next page">›</button>
        </div>
    `;

    pager.querySelector('[data-action="prev"]').addEventListener('click', () => {
        if (TL.pageIndex > 0) { TL.pageIndex--; tlRender(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
    pager.querySelector('[data-action="next"]').addEventListener('click', () => {
        if (TL.pageIndex < totalPages - 1) { TL.pageIndex++; tlRender(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
    pager.querySelector('#tl-pager-size-select').addEventListener('change', (e) => {
        TL.pageSize = parseInt(e.target.value, 10) || 25;
        TL.pageIndex = 0;
        tlRender();
    });
}

function tlUtilClass(hours) {
    if (hours < 4) return 'util-low';
    if (hours < 7) return 'util-mid';
    if (hours <= 9) return 'util-target';
    return 'util-over';
}

function tlInitials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    const first = parts[0][0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase() || '?';
}

const TL_AVATAR_COLORS = [
    '#0f62fe', '#6929c4', '#1192e8', '#005d5d',
    '#9f1853', '#fa4d56', '#570408', '#198038',
    '#002d9c', '#ee538b', '#b28600', '#009d9a',
    '#012749', '#8a3800', '#a56eff'
];
function tlAvatarColor(name) {
    if (!name) return TL_AVATAR_COLORS[0];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    return TL_AVATAR_COLORS[Math.abs(h) % TL_AVATAR_COLORS.length];
}

function tlEscape(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Backwards-compat
function tlFormatFriendlyDate(dateStr) {
    return tlFormatShortDate(dateStr);
}
