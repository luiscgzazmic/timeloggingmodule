/**
 * TIMELOGS — RENDER
 */

const TL_PROJECT_TAG_LIMIT = 4;
const TL_TARGET_HOURS = 8;

function tlRender() {
    const feed = document.getElementById('tl-feed');
    if (!feed) return;

    if (TL.grouped.length === 0) {
        feed.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-inner">
                    <div class="empty-icon">[ ]</div>
                    <p>No time logs in this batch</p>
                    <small>No timesheet entries were found for the current audit period yet.</small>
                </div>
            </div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    for (const g of TL.grouped) {
        fragment.appendChild(tlBuildCard(g));
    }
    feed.replaceChildren(fragment);
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
            <span class="name">${tlEscape(g.user)}</span>
            <span class="date">${tlFormatShortDate(g.date)}</span>
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

function tlUtilClass(hours) {
    if (hours < 4) return 'util-low';
    if (hours < 7) return 'util-mid';
    if (hours <= 9) return 'util-target';
    return 'util-over';
}

function tlEscape(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Backwards-compat: keep old name available.
function tlFormatFriendlyDate(dateStr) {
    return tlFormatShortDate(dateStr);
}
