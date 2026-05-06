/**
 * TIMELOGS — INITIALIZATION & BATCHING
 */

const TL_FETCH_CONCURRENCY = 5;

async function tlInit() {
    tlSetLoading(true, 'Establishing secure session...');
    tlSetConnection(false, 'Connecting...');
    try {
        await zohoprojects.init();
        TL.zohoInitialized = true;
        tlSetConnection(true, `Zoho · Portal ${TL.portalId}`);

        // 1. Portal id
        try {
            const pResp = await zohoprojects.get('portal.id_string');
            if (pResp?.data) TL.portalId = String(pResp.data);
            tlSetConnection(true, `Zoho · Portal ${TL.portalId}`);
        } catch (e) {
            console.warn('[TL] Could not retrieve portal via SDK, using fallback.');
        }

        // 2. Identity (with API fallback)
        let user;
        try {
            const userResp = await zohoprojects.get('current_user');
            user = userResp && (userResp.user || userResp.data || userResp);
        } catch (e) {}

        if (!user || (!user.email && !user.login_id)) {
            console.warn('[TL] current_user failed. Falling back to /users/me API...');
            try {
                const apiUser = await tlRequest(`${TL_API_BASE}/api/v3/portal/${TL.portalId}/users/me`);
                user = apiUser && (apiUser.users || apiUser.user || apiUser[0] || apiUser);
            } catch (e) {
                console.error('Could not retrieve identity via API');
            }
        }

        TL.currentUser = user;

        const userEmail = String(user?.email || user?.login_id || 'UNKNOWN').toLowerCase().trim();
        TL.isSuperAdmin = userEmail.includes('financeops');

        tlSetLoading(true, 'Fetching active portfolio...');
        tlSetIndeterminate('Loading portfolio');
        const all = await tlListProjects();

        // 3. Filter by ownership / management
        if (TL.isSuperAdmin) {
            TL.projects = all;
        } else {
            const uid = String(user?.zpuid || user?.id || user?.emp_id);
            TL.projects = all.filter(p => {
                const pmId = String(p.project_manager?.zpuid || p.project_manager?.id || p.project_manager_id);
                const ownerId = String(p.owner?.zpuid || p.owner?.id || p.owner_id);
                return pmId === uid || ownerId === uid;
            });
        }

        tlClearProgress();
        tlSetLoading(false);
        tlBindDateInput();
        renderToolbar(userEmail);
        tlRenderKPIs();

        if (TL.projects.length > 0) {
            tlSyncNextBatch();
        } else {
            tlRender();
        }

    } catch (err) {
        console.error('Critical Failure:', err);
        tlSetLoading(false);
        tlSetConnection(false, 'Connection failed');
        const feed = document.getElementById('tl-feed');
        if (feed) {
            feed.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-inner">
                        <div class="empty-icon">!</div>
                        <p>Initialization failed</p>
                        <small>Check the browser console for details.</small>
                    </div>
                </div>`;
        }
    }
}

function renderToolbar(email = 'admin') {
    const summary = document.getElementById('tl-summary');
    if (!summary) return;

    const remaining = TL.projects.length - TL.batchIndex;
    const roleClass = TL.isSuperAdmin ? 'role-tag' : 'role-tag role-user';
    const roleLabel = TL.isSuperAdmin ? `Superadmin · ${email}` : `User · ${email}`;

    const action = remaining > 0
        ? `<button id="tl-sync-btn" class="btn btn-primary">Sync next ${Math.min(TL.batchSize, remaining)} projects <span style="font-family:'IBM Plex Mono',monospace;opacity:0.7;font-size:12px;">→</span></button>`
        : `<span class="sync-complete">Audit pool fully synced</span>`;

    summary.innerHTML = `
        <div class="tl-toolbar">
            <div class="tl-toolbar-left">
                <span class="${roleClass}">${roleLabel}</span>
            </div>
            <div class="tl-toolbar-right">
                ${action}
            </div>
        </div>
    `;

    const btn = document.getElementById('tl-sync-btn');
    if (btn) btn.addEventListener('click', tlSyncNextBatch);
}

function tlRenderKPIs() {
    const portfolio = document.getElementById('kpi-portfolio');
    const synced = document.getElementById('kpi-synced');
    const pending = document.getElementById('kpi-pending');
    const hours = document.getElementById('kpi-hours');

    if (portfolio) portfolio.textContent = TL.projects.length;
    if (synced) synced.textContent = `${TL.batchIndex} / ${TL.projects.length}`;

    const pendingCount = TL.grouped.filter(g => g.status === 'Pending').length;
    if (pending) pending.textContent = pendingCount;

    const totalHours = TL.grouped.reduce((s, g) => s + (g.totalHours || 0), 0);
    if (hours) hours.innerHTML = `${totalHours.toFixed(2)}<span class="unit">h</span>`;

    // Update progress bar fill (in case toolbar action wasn't running)
    const wrap = document.getElementById('kpi-sync-progress');
    if (wrap && !wrap.classList.contains('indeterminate')) {
        const bar = wrap.querySelector('.cds-progress-bar');
        const pct = TL.projects.length > 0 ? Math.round((TL.batchIndex / TL.projects.length) * 100) : 0;
        if (bar) bar.style.width = pct + '%';
        if (TL.projects.length > 0 && TL.batchIndex >= TL.projects.length) {
            wrap.classList.add('success');
        }
    }

    const periodMeta = document.getElementById('tl-period-meta');
    if (periodMeta) periodMeta.textContent = tlFormatPeriod(TL.selectedDate);
}

async function tlSyncNextBatch() {
    const start = TL.batchIndex;
    const end = Math.min(start + TL.batchSize, TL.projects.length);
    const chunk = TL.projects.slice(start, end);
    if (chunk.length === 0) return;

    const btn = document.getElementById('tl-sync-btn');
    if (btn) btn.disabled = true;

    tlRenderSkeletons(Math.min(3, chunk.length));
    tlSetProgress(0, chunk.length, `Syncing batch ${start + 1}–${end}`);

    await tlPool(chunk, TL_FETCH_CONCURRENCY, async (project) => {
        try {
            const raw = await tlListLogsForProject(project.id || project.id_string);
            const flat = tlFlattenProjectLogs(project.id || project.id_string, project.name, raw);
            TL.rawLogs.push(...flat);
        } catch (e) {
            console.warn('Sync error in project:', project.id, e);
        }
    }, (done, total, item) => {
        const name = (item && item.name) ? `"${item.name}"` : '';
        tlSetProgress(done, total, `Syncing ${done}/${total} ${name}`);
    });

    TL.batchIndex = end;
    TL.grouped = tlAggregate(TL.rawLogs);

    // Final cumulative progress vs full portfolio
    tlSetProgress(TL.batchIndex, TL.projects.length, TL.batchIndex >= TL.projects.length ? 'Sync complete' : `Loaded ${TL.batchIndex} / ${TL.projects.length}`);

    renderToolbar(TL.currentUser?.email || TL.currentUser?.login_id || 'admin');
    tlRenderKPIs();
    tlRender();
}

function tlRenderSkeletons(n) {
    const feed = document.getElementById('tl-feed');
    if (!feed) return;
    if (TL.grouped.length > 0) return; // don't replace real data

    const rows = [];
    for (let i = 0; i < n; i++) {
        rows.push(`
            <div class="skeleton-row">
                <div>
                    <div class="skeleton-block tall" style="width:60%;margin-bottom:6px;"></div>
                    <div class="skeleton-block short"></div>
                </div>
                <div>
                    <div class="skeleton-block tall" style="width:50%;"></div>
                </div>
                <div>
                    <div class="skeleton-block" style="width:90%;"></div>
                </div>
                <div>
                    <div class="skeleton-block tall"></div>
                </div>
            </div>
        `);
    }
    feed.innerHTML = rows.join('');
}

function tlBindDateInput() {
    const input = document.getElementById('tl-date');
    if (!input || input.dataset.bound === '1') return;
    input.value = TL.selectedDate;
    input.dataset.bound = '1';

    const handler = tlDebounce((value) => {
        if (!value || value === TL.selectedDate) return;
        TL.selectedDate = value;
        TL.rawLogs = [];
        TL.grouped = [];
        TL.batchIndex = 0;
        tlRenderKPIs();
        renderToolbar(TL.currentUser?.email || TL.currentUser?.login_id || 'admin');
        if (TL.projects.length > 0) tlSyncNextBatch();
        else tlRender();
    }, 250);

    input.addEventListener('change', (e) => handler(e.target.value));
    input.addEventListener('input', (e) => handler(e.target.value));
}

function tlSetLoading(show, msg) {
    const el = document.getElementById('tl-loading');
    const txt = document.getElementById('tl-loading-detail');
    if (el) el.style.display = show ? 'flex' : 'none';
    if (txt) txt.textContent = msg || '';
}

document.addEventListener('DOMContentLoaded', tlInit);
