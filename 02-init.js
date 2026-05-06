/**
 * TIMELOGS — INITIALIZATION & BATCHING
 */

async function tlInit() {
    tlSetLoading(true, 'AUTHENTICATING SECURE SESSION...');
    try {
        await zohoprojects.init();
        TL.zohoInitialized = true;

        // 1. Recuperar Portal PRIMERO (necesario por si requerimos API fallback)
        try {
            const pResp = await zohoprojects.get("portal.id_string");
            if (pResp?.data) TL.portalId = String(pResp.data);
        } catch (e) {
            console.warn("[TL] No se pudo obtener el portal por SDK, usando fallback.");
        }

        // 2. Recuperar Identidad con Fallback directo a la API
        let user;
        try {
            const userResp = await zohoprojects.get('current_user');
            user = userResp && (userResp.user || userResp.data || userResp);
        } catch (e) {}

        if (!user || (!user.email && !user.login_id)) {
            console.warn("[TL] current_user falló. Intentando /users/me por API...");
            try {
                const apiUser = await tlRequest(`${TL_API_BASE}/api/v3/portal/${TL.portalId}/users/me`);
                user = apiUser && (apiUser.users || apiUser.user || apiUser[0] || apiUser);
            } catch (e) {
                console.error("Fallo obteniendo identidad via API");
            }
        }

        TL.currentUser = user;

        // Identificar Admin
        const userEmail = String(user?.email || user?.login_id || "UNKNOWN").toLowerCase().trim();
        TL.isSuperAdmin = userEmail.includes('financeops');

        tlSetLoading(true, 'FETCHING ENTIRE PORTFOLIO...');
        const all = await tlListProjects();

        // 3. Filtrado Corregido (Soportando owner_id y project_manager_id)
        if (TL.isSuperAdmin) {
            TL.projects = all; // Acceso Total
        } else {
            const uid = String(user?.zpuid || user?.id || user?.emp_id);
            TL.projects = all.filter(p => {
                const pmId = String(p.project_manager?.zpuid || p.project_manager?.id || p.project_manager_id);
                const ownerId = String(p.owner?.zpuid || p.owner?.id || p.owner_id);

                return pmId === uid || ownerId === uid;
            });
        }

        tlSetLoading(false);
        renderBatchControls(userEmail);

        // Opcional: Auto-iniciar el primer bloque de sincronización para que no se quede "esperando"
        if (TL.projects.length > 0) {
            tlSyncNextBatch();
        } else {
            tlRender(); // Mostrar estado vacío si realmente no tiene proyectos
        }

    } catch (err) {
        console.error("Critical Failure:", err);
        tlSetLoading(false);
        document.getElementById('tl-tbody').innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Initialization Failed. Check Console.</td></tr>`;
    }
}

function renderBatchControls(email = "Admin") {
    const summary = document.getElementById('tl-summary');
    if (!summary) return;

    const remaining = TL.projects.length - TL.batchIndex;
    const roleTag = TL.isSuperAdmin ? `<span style="color:#0f62fe; font-weight:bold;">[SUPERADMIN: ${email}]</span>` : `[USER: ${email}]`;

    summary.innerHTML = `
        <div class="batch-bar">
            <div class="batch-status">
                ${roleTag} 
                <span class="divider"></span>
                <strong>PORTFOLIO:</strong> ${TL.projects.length} 
                <span class="divider"></span> 
                <strong>LOADED:</strong> ${TL.batchIndex}
            </div>
            <div class="batch-actions">
                ${remaining > 0 ? 
                    `<button class="btn btn-primary" onclick="tlSyncNextBatch()">SYNC NEXT ${Math.min(TL.batchSize, remaining)} PROJECTS</button>` : 
                    `<span class="sync-complete">AUDIT POOL FULLY SYNCED</span>`}
            </div>
        </div>
    `;
}

async function tlSyncNextBatch() {
    const start = TL.batchIndex;
    const end = Math.min(start + TL.batchSize, TL.projects.length);
    const chunk = TL.projects.slice(start, end);

    tlSetLoading(true, `SYNCING CHUNK ${start + 1} TO ${end}...`);

    for (const project of chunk) {
        try {
            const raw = await tlListLogsForProject(project.id || project.id_string);
            const flat = tlFlattenProjectLogs(project.id || project.id_string, project.name, raw);
            TL.rawLogs.push(...flat);
        } catch (e) {
            console.warn("Sync error in project:", project.id);
        }
    }

    TL.batchIndex = end;
    TL.grouped = tlAggregate(TL.rawLogs);

    tlSetLoading(false);
    renderBatchControls(TL.currentUser?.email || TL.currentUser?.login_id || "Admin");
    tlRender();
}

function tlSetLoading(show, msg) {
    const el = document.getElementById('tl-loading');
    const txt = document.getElementById('tl-loading-detail');
    if (el) el.style.display = show ? 'flex' : 'none';
    if (txt) txt.textContent = msg || '';
}

document.addEventListener('DOMContentLoaded', tlInit);
