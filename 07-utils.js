/**
 * TIMELOGS — UTILITIES
 */

const TL_MONTHS_EN = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const TL_MONTHS_FULL_EN = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Convert "HH:mm" to decimal hours.
 */
function tlTimeToDecimal(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [hrs, mins] = timeStr.split(':').map(Number);
    return hrs + (mins / 60);
}

/**
 * Format YYYY-MM-DD → "30 Apr".
 */
function tlFormatShortDate(dateStr) {
    if (!dateStr) return '';
    const [, m, d] = dateStr.split('-');
    return `${parseInt(d, 10)} ${TL_MONTHS_EN[parseInt(m, 10) - 1]}`;
}

/**
 * Format YYYY-MM → "April 2025".
 */
function tlFormatPeriod(periodStr) {
    if (!periodStr) return '—';
    const [y, m] = periodStr.split('-');
    return `${TL_MONTHS_FULL_EN[parseInt(m, 10) - 1]} ${y}`;
}

/**
 * Concurrency-limited async pool.
 * Runs `fn(item)` for each item, with at most `limit` in flight.
 * Calls onProgress(done, total, item) after each completion.
 */
async function tlPool(items, limit, fn, onProgress) {
    const total = items.length;
    let cursor = 0;
    let done = 0;
    const results = new Array(total);

    async function worker() {
        while (cursor < total) {
            const idx = cursor++;
            try {
                results[idx] = { ok: true, value: await fn(items[idx], idx) };
            } catch (err) {
                results[idx] = { ok: false, error: err };
            }
            done++;
            if (onProgress) {
                try { onProgress(done, total, items[idx]); } catch (_) {}
            }
        }
    }

    const workers = Array.from({ length: Math.min(limit, total) }, worker);
    await Promise.all(workers);
    return results;
}

/**
 * Drive the determinate progress bar in the KPI strip.
 */
function tlSetProgress(done, total, label) {
    const wrap = document.getElementById('kpi-sync-progress');
    if (!wrap) return;
    const bar = wrap.querySelector('.cds-progress-bar');
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    wrap.classList.remove('indeterminate');
    if (done >= total && total > 0) {
        wrap.classList.add('success');
    } else {
        wrap.classList.remove('success');
    }
    if (bar) bar.style.width = pct + '%';

    const synced = document.getElementById('kpi-synced');
    if (synced) synced.textContent = `${done} / ${total}`;

    if (label) {
        let meta = wrap.querySelector('.cds-progress-label');
        if (!meta) {
            meta = document.createElement('div');
            meta.className = 'cds-progress-label';
            wrap.appendChild(meta);
        }
        meta.innerHTML = `<span>${label}</span><span>${pct}%</span>`;
    }
}

function tlSetIndeterminate(label) {
    const wrap = document.getElementById('kpi-sync-progress');
    if (!wrap) return;
    wrap.classList.add('indeterminate');
    wrap.classList.remove('success');
    const bar = wrap.querySelector('.cds-progress-bar');
    if (bar) bar.style.width = '30%';
    let meta = wrap.querySelector('.cds-progress-label');
    if (label) {
        if (!meta) {
            meta = document.createElement('div');
            meta.className = 'cds-progress-label';
            wrap.appendChild(meta);
        }
        meta.innerHTML = `<span>${label}</span><span>—</span>`;
    }
}

function tlClearProgress() {
    const wrap = document.getElementById('kpi-sync-progress');
    if (!wrap) return;
    wrap.classList.remove('indeterminate');
    const meta = wrap.querySelector('.cds-progress-label');
    if (meta) meta.remove();
}

/**
 * Update the connection status pill in the header.
 */
function tlSetConnection(online, label) {
    const el = document.getElementById('tl-conn');
    if (!el) return;
    el.classList.toggle('online', !!online);
    const txt = el.querySelector('.label');
    if (txt) txt.textContent = label || (online ? 'Connected' : 'Disconnected');
}

/**
 * Debounce helper.
 */
function tlDebounce(fn, ms) {
    let t = null;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(null, args), ms);
    };
}

/**
 * Flatten Zoho consolidated report rows into per-day entries.
 */
function tlFlattenProjectLogs(projectId, projectName, raw) {
    let data = raw;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { return []; }
    }

    if (!Array.isArray(data)) return [];

    const flat = [];
    data.forEach(userReport => {
        const userName = userReport.name || 'Unknown';
        const userId = userReport.id || userReport.zuid || '0';

        const dayEntries = userReport.log_hours?.consolidated_report || [];

        dayEntries.forEach(entry => {
            flat.push({
                id: `rep-${userId}-${entry.date}`,
                projectId: projectId,
                projectName: projectName,
                user: userName,
                userId: userId,
                date: entry.date,
                hours: tlTimeToDecimal(entry.total),
                status: 'Pending',
                kind: 'general'
            });
        });
    });

    return flat;
}
